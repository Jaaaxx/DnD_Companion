import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.DEV ? 'http://localhost:3001' : '';

// Singleton socket instance to survive React StrictMode double-mount
let globalSocket: Socket | null = null;
let socketRefCount = 0;

function getOrCreateSocket(): Socket {
  if (!globalSocket) {
    globalSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  socketRefCount++;
  return globalSocket;
}

function releaseSocket() {
  socketRefCount--;
  // Only disconnect when no components are using the socket
  if (socketRefCount === 0 && globalSocket) {
    globalSocket.disconnect();
    globalSocket = null;
  }
}

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    // Use singleton socket to survive StrictMode double-mount
    const socket = getOrCreateSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      if (!mountedRef.current) return;
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Authenticate with mock user in development
      if (import.meta.env.DEV) {
        socket.emit('authenticate', {
          token: 'dev-token',
          userId: 'dev-user-123',
        });
      }
    };

    const handleDisconnect = () => {
      if (!mountedRef.current) return;
      console.log('WebSocket disconnected');
      setIsConnected(false);
    };

    const handleConnectError = (err: Error) => {
      if (!mountedRef.current) return;
      console.error('WebSocket connection error:', err);
      setError('Failed to connect to server');
      setIsConnected(false);
    };

    const handleError = (data: { message: string }) => {
      if (!mountedRef.current) return;
      console.error('WebSocket error:', data.message);
      setError(data.message);
    };

    const handleAuthenticated = (data: { success: boolean }) => {
      if (data.success) {
        console.log('WebSocket authenticated');
      }
    };

    // Add event listeners
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('error', handleError);
    socket.on('authenticated', handleAuthenticated);

    // If already connected, trigger the handler
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup on unmount
    return () => {
      mountedRef.current = false;
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('error', handleError);
      socket.off('authenticated', handleAuthenticated);
      releaseSocket();
    };
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, []);

  const on = useCallback((event: string, callback: (...args: unknown[]) => void) => {
    socketRef.current?.on(event, callback);
    // Return cleanup function
    return () => {
      socketRef.current?.off(event, callback);
    };
  }, []);

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    socketRef.current?.off(event, callback);
  }, []);

  return {
    socket: socketRef.current,
    isConnected,
    error,
    emit,
    on,
    off,
  };
}

