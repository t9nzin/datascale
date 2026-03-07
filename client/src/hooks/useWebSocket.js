import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';

export function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const mountedRef = useRef(true);
  const store = useStore();

  useEffect(() => {
    mountedRef.current = true;

    function connect() {
      // In dev, connect directly to the backend server to avoid Vite HMR proxy conflicts.
      // In production, use the same host as the page.
      const isDev = window.location.port === '5173';
      const wsUrl = isDev
        ? 'ws://127.0.0.1:3000/ws'
        : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'cursor':
            store.setCursor(msg.user, { x: msg.x, y: msg.y });
            break;
          case 'annotation-created':
            store.addAnnotation(msg.annotation);
            break;
          case 'annotation-updated':
            store.updateAnnotation(msg.annotation.id, msg.annotation);
            break;
          case 'annotation-deleted':
            store.removeAnnotation(msg.annotationId);
            break;
          case 'presence':
            store.setConnectedUsers(msg.users);
            break;
        }
      };

      ws.onclose = () => {
        if (mountedRef.current) {
          reconnectTimer.current = setTimeout(() => {
            if (mountedRef.current) {
              connect();
            }
          }, 2000);
        }
      };

      ws.onerror = () => {
        // Suppress noisy errors; onclose will handle reconnect
      };
    }

    connect();

    return () => {
      mountedRef.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const sendCursor = useCallback((position) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cursor', x: position.x, y: position.y }));
    }
  }, []);

  const subscribeToImage = useCallback((imageId) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe-image', imageId }));
    }
  }, []);

  return { sendCursor, subscribeToImage };
}
