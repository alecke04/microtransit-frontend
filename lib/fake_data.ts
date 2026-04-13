import type { LocationListResponse } from "@/lib/api";
import type { LocationUpdateMessage } from "@/lib/websocket";

const ROUTE: Array<[number, number]> = [
  // Florida Polytechnic University main campus loop - following actual roads
  [28.1525, -81.8595],  // Main entrance area
  [28.1535, -81.8580],  // North side of campus
  [28.1540, -81.8560],  // Research corridor
  [28.1525, -81.8545],  // East parking area
  [28.1510, -81.8550],  // Southeast corner
  [28.1500, -81.8570],  // South loop
  [28.1505, -81.8590],  // Southwest area
  [28.1515, -81.8600],  // West side
];

export function getFakeHistory(deviceId: string, limit = 60): LocationListResponse {
  const now = Date.now();
  const count = Math.max(1, Math.min(limit, 120));

  const locations = Array.from({ length: count }, (_, i) => {
    const routePoint = ROUTE[i % ROUTE.length];
    const timestamp = Math.floor((now - (count - i) * 2000) / 1000);

    return {
      id: i + 1,
      device_id: deviceId,
      latitude: routePoint[0],
      longitude: routePoint[1],
      speed: 14 + (i % 5),
      accuracy: 4,
      timestamp,
      created_at: new Date(timestamp * 1000).toISOString(),
    };
  });

  return {
    count: locations.length,
    has_more: false,
    locations,
  };
}

export function startFakeLocationStream(
  deviceId: string,
  onMessage: (message: LocationUpdateMessage) => void,
  intervalMs = 2000,
): () => void {
  let index = 0;

  const timer = window.setInterval(() => {
    const [latitude, longitude] = ROUTE[index % ROUTE.length];
    const timestamp = Math.floor(Date.now() / 1000);
    
    // Vary speed: slower at start/end of route, faster in middle
    const routeProgress = (index % ROUTE.length) / ROUTE.length;
    const baseSpeeds = [5, 12, 18, 24, 20, 15, 10, 8]; // Realistic varying speeds
    const speed = baseSpeeds[index % ROUTE.length] || 16;

    onMessage({
      type: "location_update",
      device_id: deviceId,
      latitude,
      longitude,
      speed,
      accuracy: 4,
      timestamp,
    });

    index += 1;
  }, intervalMs);

  return () => window.clearInterval(timer);
}
