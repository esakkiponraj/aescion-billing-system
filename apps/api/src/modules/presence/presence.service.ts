import { Injectable, OnModuleInit, OnModuleDestroy, Logger, forwardRef, Inject } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PresenceGateway } from './presence.gateway';

export interface CashierPresencePayload {
  cashierId: string;
  isOnline: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  lastSeenAt: string;
}

@Injectable()
export class PresenceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PresenceService.name);

  // userId -> Set<socketId>
  private userConnections = new Map<string, Set<string>>();

  // socketId -> metadata
  private socketToUser = new Map<
    string,
    { userId: string; orgIds: string[]; isCashier: boolean }
  >();

  // userId -> last heartbeat timestamp in ms
  private userLastHeartbeat = new Map<string, number>();

  private sweepInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => PresenceGateway))
    private presenceGateway: PresenceGateway,
  ) {}

  onModuleInit() {
    // Sweep every 10 seconds to check for heartbeats older than 45 seconds
    this.sweepInterval = setInterval(() => {
      this.sweepStaleConnections();
    }, 10000);
  }

  onModuleDestroy() {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
    }
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
    let sockets = this.userConnections.get(userId);
    const isFirstConnection = !sockets || sockets.size === 0;

    if (!sockets) {
      sockets = new Set<string>();
      this.userConnections.set(userId, sockets);
    }

    sockets.add(socketId);
    this.socketToUser.set(socketId, { userId, orgIds, isCashier });
    this.userLastHeartbeat.set(userId, Date.now());

    this.logger.log(
      `[Presence] User ${userId} connected (socket: ${socketId}, total tabs: ${sockets.size}, isCashier: ${isCashier})`,
    );

    return { isFirstConnection };
  }

  /**
   * Handle incoming heartbeat from cashier client.
   */
  recordHeartbeat(userId: string) {
    this.userLastHeartbeat.set(userId, Date.now());
    const now = new Date();

    // Asynchronously update lastSeenAt in DB without blocking
    this.prisma.user
      .update({
        where: { id: userId },
        data: { lastSeenAt: now } as any,
      })
      .catch((err) => {
        this.logger.warn(`Failed to update lastSeenAt for user ${userId}: ${err.message}`);
      });
  }

  /**
   * Remove a socket connection when a tab or socket disconnects.
   */
  removeConnection(socketId: string): {
    userId: string;
    orgIds: string[];
    isCashier: boolean;
    isLastConnection: boolean;
  } | null {
    const meta = this.socketToUser.get(socketId);
    if (!meta) return null;

    this.socketToUser.delete(socketId);
    const sockets = this.userConnections.get(meta.userId);

    let isLastConnection = false;
    if (sockets) {
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userConnections.delete(meta.userId);
        this.userLastHeartbeat.delete(meta.userId);
        isLastConnection = true;

        const now = new Date();
        this.prisma.user
          .update({
            where: { id: meta.userId },
            data: { lastSeenAt: now } as any,
          })
          .catch(() => {});
      }
    } else {
      isLastConnection = true;
    }

    this.logger.log(
      `[Presence] Socket ${socketId} disconnected for user ${meta.userId} (isLastConnection: ${isLastConnection})`,
    );

    return {
      userId: meta.userId,
      orgIds: meta.orgIds,
      isCashier: meta.isCashier,
      isLastConnection,
    };
  }

  /**
   * Manual logout: instantly marks user offline across all sessions.
   */
  manualLogout(userId: string, orgIds: string[]) {
    this.userConnections.delete(userId);
    this.userLastHeartbeat.delete(userId);

    const now = new Date();
    this.prisma.user
      .update({
        where: { id: userId },
        data: { lastSeenAt: now } as any,
      })
      .catch(() => {});

    this.logger.log(`[Presence] Manual logout executed for user ${userId}`);
  }

  /**
   * Check if a cashier is currently live and active.
   * True only if:
   * 1. Account is active (enabled)
   * 2. Active socket connection exists
   * 3. Heartbeat received in the last 45 seconds
   */
  isCashierOnline(
    userId: string,
    user: { isActive: boolean; lastSeenAt?: Date | null },
  ): boolean {
    if (user.isActive === false) return false;

    const sockets = this.userConnections.get(userId);
    const hasSockets = sockets && sockets.size > 0;
    if (!hasSockets) return false;

    const lastHeartbeat = this.userLastHeartbeat.get(userId);
    if (!lastHeartbeat) return false;

    const elapsed = Date.now() - lastHeartbeat;
    return elapsed <= 45000;
  }

  /**
   * Periodic sweep to detect missed heartbeats (> 45s).
   */
  private sweepStaleConnections() {
    const now = Date.now();
    const TIMEOUT_MS = 45000;

    for (const [userId, lastHb] of this.userLastHeartbeat.entries()) {
      if (now - lastHb > TIMEOUT_MS) {
        this.logger.warn(`[Presence] Cashier ${userId} heartbeat timed out (> 45s). Transitioning to INACTIVE.`);

        // Find metadata for orgs
        const sockets = this.userConnections.get(userId);
        let orgIds: string[] = [];
        let isCashier = false;

        if (sockets) {
          for (const sId of sockets) {
            const m = this.socketToUser.get(sId);
            if (m) {
              orgIds = m.orgIds;
              isCashier = m.isCashier;
            }
            this.socketToUser.delete(sId);
          }
        }

        this.userConnections.delete(userId);
        this.userLastHeartbeat.delete(userId);

        if (isCashier && orgIds.length > 0) {
          for (const orgId of orgIds) {
            this.presenceGateway.broadcastCashierPresence(orgId, {
              cashierId: userId,
              isOnline: false,
              status: 'INACTIVE',
              lastSeenAt: new Date().toISOString(),
            });
          }
        }
      }
    }
  }
}
