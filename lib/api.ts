export interface LocationPoint {
  id: number;
  device_id: string;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  timestamp: number;
  created_at: string;
}

export interface LocationListResponse {
  count: number;
  has_more: boolean;
  locations: LocationPoint[];
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchDeviceHistory(deviceId: string, limit = 100, useMock = false): Promise<LocationListResponse> {
  // Grabs recent points so the map can render route history on initial load.
  // If useMock=true, backend will seed mock data (only available in TESTING mode)
  const url = new URL(`${apiBase}/api/locations/${deviceId}`);
  url.searchParams.set("limit", limit.toString());
  if (useMock) {
    url.searchParams.set("mock", "true");
  }

  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`History request failed: ${response.status}`);
  }

  return response.json();
}
