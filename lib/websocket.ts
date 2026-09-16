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
    console.info(`[WebSocket] connected device=${deviceId}`);
    onStatusChange(true);
  };

  socket.onclose = (event) => {
    console.info(
      `[WebSocket] closed device=${deviceId} code=${event.code} clean=${event.wasClean} reason=${event.reason || "none"}`,
    );
    onStatusChange(false);
  };

  // Do not independently mark the socket disconnected here. Browsers can emit
  // an error before the definitive close event; treating both as disconnects
  // used to schedule a replacement socket that could close a still-live one.
  socket.onerror = (event) => {
    console.error(`[WebSocket] error device=${deviceId}`, event);
  };

  socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);

      // The backend uses an application-level heartbeat. Reply with a small
      // text frame so its receive loop observes the client as alive instead of
      // timing out every 30 seconds while the browser silently ignores pings.
      if (parsed.type === "ping") {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send("pong");
        }
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
