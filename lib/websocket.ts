export interface LocationUpdateMessage {
  type: "location_update";
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  timestamp: number;
}

const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";

// Track message frequency for diagnostics
let lastLocationUpdateTime = 0;

export function openDeviceSocket(
  deviceId: string,
  onMessage: (message: LocationUpdateMessage) => void,
  onStatusChange: (connected: boolean) => void,
): WebSocket {
  // One socket per viewed device keeps frontend logic straightforward.
  const socket = new WebSocket(`${wsBase}/ws/${deviceId}`);

  socket.onopen = () => {
    console.log('[CHECK] WebSocket connected');
    lastLocationUpdateTime = Date.now();
    onStatusChange(true);
  };
  socket.onclose = () => {
    console.log('[X] WebSocket disconnected');
    onStatusChange(false);
  };
  socket.onerror = (event) => {
    console.error('[X] WebSocket error:', event);
    onStatusChange(false);
  };

  socket.onmessage = (event) => {
    try {
      console.log('[WebSocket] Raw message received:', event.data);
      const parsed = JSON.parse(event.data);
      
      // Ignore ping messages (used for keeping connection alive)
      if (parsed.type === 'ping') {
        console.log('[WebSocket] Ping message, skipping');
        return;
      }
      
      const message = parsed as LocationUpdateMessage;
      const now = Date.now();
      const timeSinceLastUpdate = now - lastLocationUpdateTime;
      lastLocationUpdateTime = now;
      
      console.log('[CHECK] Parsed message:', message);
      console.log(`  - Time since last location: ${timeSinceLastUpdate}ms`);
      console.log('  - latitude:', message.latitude, 'type:', typeof message.latitude, 'isFinite:', isFinite(message.latitude));
      console.log('  - longitude:', message.longitude, 'type:', typeof message.longitude, 'isFinite:', isFinite(message.longitude));
      console.log('  - speed:', message.speed);
      onMessage(message);
    } catch (err) {
      console.error('[X] Failed to parse message:', err, 'data:', event.data);
    }
  };

  return socket;
}
