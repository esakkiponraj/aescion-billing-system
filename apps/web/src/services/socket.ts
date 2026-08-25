import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

export interface CashierPresenceEvent {
  cashierId: string;
  isOnline: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  lastSeenAt: string;
}

let socketInstance: Socket | null = null;

export const getSocketServerUrl = (): string => {
  const envUrl = (import.meta as any).env?.VITE_API_WS_URL || (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173') {
      return `http://${window.location.hostname}:3000`;
    }
    return window.location.origin;
  }
  return 'http://127.0.0.1:3000';
};

export const getSocket = (): Socket | null => {
  const token = useAuthStore.getState().tokens?.accessToken;
  if (!token) {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
    return null;
  }

  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (!socketInstance) {
    const url = getSocketServerUrl();
    socketInstance = io(url, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected to real-time server:', socketInstance?.id);
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected from real-time server:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });
  } else if (!socketInstance.connected) {
    socketInstance.auth = { token };
    socketInstance.connect();
  }

  return socketInstance;
};

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
};

/**
 * Emit regular heartbeat event to backend presence tracking.
 */
export const sendPresenceHeartbeat = () => {
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('presence:heartbeat', {}, (response: any) => {
      if (response?.error) {
        console.warn('[Presence Heartbeat] Error:', response.error);
      }
    });
  }
};

export const sendCashierHeartbeat = sendPresenceHeartbeat;

/**
 * Cleanly notify backend of user logout and disconnect socket.
 */
export const sendPresenceLogout = async (): Promise<void> => {
  const socket = socketInstance;
  if (socket && socket.connected) {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        disconnectSocket();
        resolve();
      }, 500);

      socket.emit('presence:logout', {}, () => {
        clearTimeout(timer);
        disconnectSocket();
        resolve();
      });
    });
  }
  disconnectSocket();
};

export const sendCashierLogout = sendPresenceLogout;

/**
 * Subscribe to real-time cashier presence events broadcast by backend.
 */
export const subscribeToCashierPresence = (
  callback: (data: CashierPresenceEvent) => void,
): (() => void) => {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on('cashier:presence', callback);

  return () => {
    socket.off('cashier:presence', callback);
  };
};

/**
 * Register a callback when socket reconnects (useful for refreshing stale dashboard data).
 */
export const onSocketConnect = (callback: () => void): (() => void) => {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on('connect', callback);

  return () => {
    socket.off('connect', callback);
  };
};

/**
 * Subscribe to any custom backend broadcast event (e.g. receipt:generated, invoice:updated).
 */
export const subscribeToEvent = (
  eventName: string,
  callback: (data: any) => void,
): (() => void) => {
  const socket = getSocket();
  if (!socket) return () => {};

  socket.on(eventName, callback);

  return () => {
    socket.off(eventName, callback);
  };
};

