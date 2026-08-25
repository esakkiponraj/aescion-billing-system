import { Injectable, OnModuleInit, OnModuleDestroy, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PresenceGateway } from './presence.gateway';

export interface CashierPresencePayload {
  cashierId: string;
  isOnline: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  lastSeenAt: string;
}

export const PRESENCE_CONSTANTS = {
  HEARTBEAT_INTERVAL_MS: 20_000, // 20s frontend heartbeat
  HEARTBEAT_TIMEOUT_MS: 90_000, // 90s backend heartbeat timeout
  SWEEP_INTERVAL_MS: 15_000, // 15s backend stale check interval
  DISCONNECT_GRACE_MS: 10_000, // 10s reconnection grace period on socket drop
  DB_PERSIST_THROTTLE_MS: 60_000, // 60s DB write throttle for lastSeenAt
};

export interface UserPresenceRecord {
  userId: string;
  orgIds: string[];
  isCashier: boolean;
  sockets: Set<string>;
  lastHeartbeat: number;
  lastDbPersist: number;
  status: 'ACTIVE' | 'INACTIVE';
  disconnectGraceTimer: NodeJS.Timeout | null;
}

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  // userId -> UserPresenceRecord
  private presenceRecords = new Map<string, UserPresenceRecord>();

  // socketId -> userId
  private socketToUserId = new Map<string, string>();

  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PresenceGateway))
    private presenceGateway: PresenceGateway,
  ) {}

  onModuleInit() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
    // Sweep every 15 seconds to check for heartbeats older than 90 seconds
    this.sweepInterval = setInterval(() => {
      this.sweepStaleConnections();
    }, PRESENCE_CONSTANTS.SWEEP_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }

    // Clean up all pending disconnect grace timers
    for (const record of this.presenceRecords.values()) {
      if (record.disconnectGraceTimer) {
        clearTimeout(record.disconnectGraceTimer);
        record.disconnectGraceTimer = null;
      }
    }
    this.presenceRecords.clear();
    this.socketToUserId.clear();
  }

  /**
   * Register a new socket connection for a user.
   */
  addConnection(
    userId: string,
    socketId: string,
    orgIds: string[],
    isCashier: boolean,
  ): { isFirstConnection: boolean } {
    this.socketToUserId.set(socketId, userId);

    let record = this.presenceRecords.get(userId);
    const wasInactive = !record || record.status === 'INACTIVE';

    if (record) {
      // Cancel pending disconnect grace period if reconnecting
      if (record.disconnectGraceTimer) {
        clearTimeout(record.disconnectGraceTimer);
        record.disconnectGraceTimer = null;
      }

      record.sockets.add(socketId);
      record.lastHeartbeat = Date.now();
      record.orgIds = Array.from(new Set([...record.orgIds, ...orgIds]));
      if (isCashier) record.isCashier = true;

      if (record.status === 'INACTIVE') {
        record.status = 'ACTIVE';
        if (record.isCashier && record.orgIds.length > 0) {
          const nowIso = new Date().toISOString();
          for (const orgId of record.orgIds) {
            this.presenceGateway.broadcastCashierPresence(orgId, {
              cashierId: userId,
              isOnline: true,
              status: 'ACTIVE',
              lastSeenAt: nowIso,
            });
          }
        }
        this.persistLastSeenAt(userId);
      }
    } else {
      record = {
        userId,
        orgIds,
        isCashier,
        sockets: new Set([socketId]),
        lastHeartbeat: Date.now(),
        lastDbPersist: Date.now(),
        status: 'ACTIVE',
        disconnectGraceTimer: null,
      };
      this.presenceRecords.set(userId, record);

      if (isCashier && orgIds.length > 0) {
        const nowIso = new Date().toISOString();
        for (const orgId of orgIds) {
          this.presenceGateway.broadcastCashierPresence(orgId, {
            cashierId: userId,
            isOnline: true,
            status: 'ACTIVE',
            lastSeenAt: nowIso,
          });
        }
      }
      this.persistLastSeenAt(userId);
    }

    this.logger.log(
      `[Presence] User ${userId} connected (socket: ${socketId}, total tabs: ${record.sockets.size}, isCashier: ${isCashier})`,
    );

    return { isFirstConnection: wasInactive };
  }

  /**
   * Handle incoming heartbeat from cashier or authenticated client.
   */
  recordHeartbeat(userId: string) {
    let record = this.presenceRecords.get(userId);

    if (!record) {
      record = {
        userId,
        orgIds: [],
        isCashier: false,
        sockets: new Set(),
        lastHeartbeat: Date.now(),
        lastDbPersist: Date.now(),
        status: 'ACTIVE',
        disconnectGraceTimer: null,
      };
      this.presenceRecords.set(userId, record);
    } else {
      record.lastHeartbeat = Date.now();

      if (record.disconnectGraceTimer) {
        clearTimeout(record.disconnectGraceTimer);
        record.disconnectGraceTimer = null;
      }

      if (record.status === 'INACTIVE') {
        record.status = 'ACTIVE';
        if (record.isCashier && record.orgIds.length > 0) {
          const nowIso = new Date().toISOString();
          for (const orgId of record.orgIds) {
            this.presenceGateway.broadcastCashierPresence(orgId, {
              cashierId: userId,
              isOnline: true,
              status: 'ACTIVE',
              lastSeenAt: nowIso,
            });
          }
        }
      }
    }

    // Throttled database update (at most once every 60s)
    const now = Date.now();
    if (now - record.lastDbPersist >= PRESENCE_CONSTANTS.DB_PERSIST_THROTTLE_MS) {
      record.lastDbPersist = now;
      this.persistLastSeenAt(userId);
    }
  }

  /**
   * Remove a socket connection when a tab or socket disconnects.
   * Uses a grace period before marking INACTIVE to support page refreshes/reconnections.
   */
  removeConnection(socketId: string): {
    userId: string;
    orgIds: string[];
    isCashier: boolean;
    isLastConnection: boolean;
  } | null {
    const userId = this.socketToUserId.get(socketId);
    if (!userId) return null;

    this.socketToUserId.delete(socketId);
    const record = this.presenceRecords.get(userId);
    if (!record) return null;

    record.sockets.delete(socketId);

    this.logger.log(
      `[Presence] Socket ${socketId} disconnected for user ${userId} (remaining tabs: ${record.sockets.size})`,
    );

    const isLastConnection = record.sockets.size === 0;

    if (isLastConnection) {
      // Start reconnection grace period (10s) before marking INACTIVE
      if (record.disconnectGraceTimer) {
        clearTimeout(record.disconnectGraceTimer);
      }

      record.disconnectGraceTimer = setTimeout(() => {
        record.disconnectGraceTimer = null;
        if (record.sockets.size === 0 && record.status === 'ACTIVE') {
          this.transitionToInactive(record, 'grace_period_expired');
        }
      }, PRESENCE_CONSTANTS.DISCONNECT_GRACE_MS);
    }

    return {
      userId: record.userId,
      orgIds: record.orgIds,
      isCashier: record.isCashier,
      isLastConnection,
    };
  }

  /**
   * Manual logout: instantly marks user offline across all sessions.
   */
  manualLogout(userId: string, orgIds?: string[]) {
    const record = this.presenceRecords.get(userId);
    if (record) {
      if (record.disconnectGraceTimer) {
        clearTimeout(record.disconnectGraceTimer);
        record.disconnectGraceTimer = null;
      }

      for (const sId of record.sockets) {
        this.socketToUserId.delete(sId);
      }
      record.sockets.clear();

      if (record.status === 'ACTIVE') {
        this.transitionToInactive(record, 'manual_logout');
      }

      this.presenceRecords.delete(userId);
    } else {
      this.persistLastSeenAt(userId);
    }

    this.logger.log(`[Presence] Manual logout executed for user ${userId}`);
  }

  /**
   * Check if a cashier is currently live and active.
   */
  isCashierOnline(
    userId: string,
    user: { isActive: boolean; lastSeenAt?: Date | null },
  ): boolean {
    if (user.isActive === false) return false;

    const record = this.presenceRecords.get(userId);
    if (!record) return false;
    if (record.status !== 'ACTIVE') return false;
    if (record.sockets.size === 0 && !record.disconnectGraceTimer) return false;

    const elapsed = Date.now() - record.lastHeartbeat;
    return elapsed <= PRESENCE_CONSTANTS.HEARTBEAT_TIMEOUT_MS;
  }

  /**
   * Transition presence record to INACTIVE (single transition with single DB update & broadcast).
   */
  private transitionToInactive(record: UserPresenceRecord, reason: string) {
    if (record.status === 'INACTIVE') return;

    record.status = 'INACTIVE';
    this.persistLastSeenAt(record.userId);

    this.logger.log(
      `[Presence] User ${record.userId} (cashier: ${record.isCashier}) transitioned to INACTIVE (reason: ${reason})`,
    );

    if (record.isCashier && record.orgIds.length > 0) {
      const nowIso = new Date().toISOString();
      for (const orgId of record.orgIds) {
        this.presenceGateway.broadcastCashierPresence(orgId, {
          cashierId: record.userId,
          isOnline: false,
          status: 'INACTIVE',
          lastSeenAt: nowIso,
        });
      }
    }
  }

  /**
   * Periodic sweep to detect missed heartbeats (> 90s).
   */
  private sweepStaleConnections() {
    const now = Date.now();

    for (const record of this.presenceRecords.values()) {
      // If already INACTIVE, skip immediately to prevent repeated logs/work
      if (record.status !== 'ACTIVE') continue;

      if (now - record.lastHeartbeat > PRESENCE_CONSTANTS.HEARTBEAT_TIMEOUT_MS) {
        if (record.disconnectGraceTimer) {
          clearTimeout(record.disconnectGraceTimer);
          record.disconnectGraceTimer = null;
        }

        for (const sId of record.sockets) {
          this.socketToUserId.delete(sId);
        }
        record.sockets.clear();

        this.transitionToInactive(record, 'heartbeat_timeout');
      }
    }
  }

  /**
   * Persist lastSeenAt timestamp in PostgreSQL safely.
   */
  private persistLastSeenAt(userId: string) {
    const now = new Date();
    this.prisma.user
      .update({
        where: { id: userId },
        data: { lastSeenAt: now } as any,
      })
      .catch((err) => {
        this.logger.debug(`Failed to update lastSeenAt for user ${userId}: ${err.message}`);
      });
  }
}
