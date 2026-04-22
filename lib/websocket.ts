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

export function openDeviceSocket(
  deviceId: string,
  onMessage: (message: LocationUpdateMessage) => void,
  onStatusChange: (connected: boolean) => void,
): WebSocket {
  // One socket per viewed device keeps frontend logic straightforward.
  const socket = new WebSocket(`${wsBase}/ws/${deviceId}`);

  socket.onopen = () => {
    console.info("WebSocket connected");
    onStatusChange(true);
  };
  socket.onclose = () => {
    console.info("WebSocket disconnected");
    onStatusChange(false);
  };
  socket.onerror = (event) => {
    console.error("WebSocket error:", event);
    onStatusChange(false);
  };

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      
      // Ignore ping messages (used for keeping connection alive)
      if (parsed.type === 'ping') {
        return;
      }
      
      const message = parsed as LocationUpdateMessage;
      onMessage(message);
    } catch (err) {
      console.error("Failed to parse WebSocket message:", err);
    }
  };

  return socket;
}
