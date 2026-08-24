import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../database/prisma.service';
import { PresenceService, CashierPresencePayload } from './presence.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class PresenceGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(PresenceGateway.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => PresenceService))
    private presenceService: PresenceService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('PresenceGateway initialized with Socket.IO authentication middleware.');

    server.use(async (socket: Socket, next) => {
      try {
        const token =
          socket.handshake.auth?.token ||
          socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '') ||
          (socket.handshake.query?.token as string);

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = this.jwtService.verify(token, {
          secret:
            process.env.JWT_SECRET || 'aescion_ultra_secure_jwt_secret_dev_key_2026',
        });

        const userId = decoded?.sub;
        if (!userId) {
          return next(new Error('Invalid token payload'));
        }

        const user = await this.prisma.user.findUnique({
          where: { id: userId },
          include: {
            memberships: {
              include: {
                membershipRoles: { include: { role: true } },
                outletMemberships: {
                  include: {
                    membershipRoles: { include: { role: true } },
                  },
                },
              },
            },
          },
        });

        if (!user || user.isActive === false) {
          return next(new Error('User inactive or not found'));
        }

        const activeMemberships = user.memberships.filter((m) => m.status === 'ACTIVE');
        const orgIds = activeMemberships.map((m) => m.organizationId);

        const isCashier = activeMemberships.some((m) => {
          const hasOrgCashierRole = m.membershipRoles.some(
            (mr) =>
              mr.role?.code === 'CASHIER' ||
              mr.role?.name?.toLowerCase().includes('cashier'),
          );
          const hasOutletCashierRole = m.outletMemberships.some((om) =>
            om.membershipRoles.some(
              (mr) =>
                mr.role?.code === 'CASHIER' ||
                mr.role?.name?.toLowerCase().includes('cashier'),
            ),
          );
          return hasOrgCashierRole || hasOutletCashierRole;
        });

        socket.data = {
          userId,
          orgIds,
          isCashier,
          userName: `${user.firstName} ${user.lastName}`.trim(),
        };

        next();
      } catch (err: any) {
        next(new Error(`Authentication failed: ${err.message}`));
      }
    });
  }

  handleConnection(client: Socket) {
    const { userId, orgIds, isCashier } = client.data || {};
    if (!userId || !orgIds) {
      client.disconnect(true);
      return;
    }

    // Join tenant room for each organization
    for (const orgId of orgIds) {
      client.join(`org_${orgId}`);
    }

    // Register connection in PresenceService
    const { isFirstConnection } = this.presenceService.addConnection(
      userId,
      client.id,
      orgIds,
      Boolean(isCashier),
    );

    // If this cashier was previously offline and this is their first connection, broadcast ONLINE status
    if (isCashier && isFirstConnection) {
      const nowIso = new Date().toISOString();
      for (const orgId of orgIds) {
        this.broadcastCashierPresence(orgId, {
          cashierId: userId,
          isOnline: true,
          status: 'ACTIVE',
          lastSeenAt: nowIso,
        });
      }
    }
  }

  handleDisconnect(client: Socket) {
    const result = this.presenceService.removeConnection(client.id);
    if (!result) return;

    // If this was the last connection for a cashier, broadcast OFFLINE status
    if (result.isCashier && result.isLastConnection) {
      const nowIso = new Date().toISOString();
      for (const orgId of result.orgIds) {
        this.broadcastCashierPresence(orgId, {
          cashierId: result.userId,
          isOnline: false,
          status: 'INACTIVE',
          lastSeenAt: nowIso,
        });
      }
    }
  }

  @SubscribeMessage('cashier:heartbeat')
  handleHeartbeat(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    if (!userId) return { success: false, error: 'Unauthorized' };

    this.presenceService.recordHeartbeat(userId);
    return { success: true, timestamp: Date.now() };
  }

  @SubscribeMessage('cashier:logout')
  handleManualLogout(@ConnectedSocket() client: Socket) {
    const userId = client.data?.userId;
    const orgIds: string[] = client.data?.orgIds || [];
    const isCashier: boolean = client.data?.isCashier || false;

    if (userId) {
      if (isCashier && orgIds.length > 0) {
        const nowIso = new Date().toISOString();
        for (const orgId of orgIds) {
          this.broadcastCashierPresence(orgId, {
            cashierId: userId,
            isOnline: false,
            status: 'INACTIVE',
            lastSeenAt: nowIso,
          });
        }
      }

      this.presenceService.manualLogout(userId, orgIds);
      client.disconnect(true);
    }

    return { success: true };
  }

  /**
   * Broadcast a cashier's presence change to the specific organization room only.
   */
  broadcastCashierPresence(orgId: string, payload: CashierPresencePayload) {
    if (!this.server) return;
    this.logger.log(
      `[Presence Broadcast] Room org_${orgId} -> Cashier ${payload.cashierId} is now ${payload.status} (online: ${payload.isOnline})`,
    );
    this.server.to(`org_${orgId}`).emit('cashier:presence', payload);
  }

  /**
   * Broadcast real-time business events (quotations, invoices, receipts, payments) to tenant room.
   */
  broadcastEvent(orgId: string, eventName: string, data: any) {
    if (!this.server) return;
    this.logger.log(`[Event Broadcast] Room org_${orgId} -> ${eventName}: ${JSON.stringify(data?.id || data?.number || '')}`);
    this.server.to(`org_${orgId}`).emit(eventName, data);
  }
}
