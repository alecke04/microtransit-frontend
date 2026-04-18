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

export interface ScheduleRouteSummary {
  route_name: string;
  service_day_type: string;
  operating_window: string;
}

export interface ScheduleEvent {
  stop_name: string;
  address: string;
  event_type: string;
  scheduled_time: string;
}

export interface TodayScheduleResponse {
  route: ScheduleRouteSummary;
  next_event: ScheduleEvent | null;
  current_direction: string;
  on_time_status: string;
  status_delta_minutes: number | null;
  last_seen_seconds: number | null;
  estimated_arrival_minutes: number | null;
}

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function fetchDeviceHistory(deviceId: string, limit = 100, useMock = false): Promise<LocationListResponse> {
  // Grabs recent points so the map can render route history on initial load.
  // If useMock=true, backend will seed mock data (only available in TESTING mode)
  const url = new URL(`${apiBase}/api/locations/${deviceId}`);
  url.searchParams.set('limit', limit.toString());
  if (useMock) {
    url.searchParams.set('mock', 'true');
  }
  
  const response = await fetch(url.toString(), { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`History request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchTodaySchedule(deviceId: string): Promise<TodayScheduleResponse> {
  const response = await fetch(`${apiBase}/api/schedule/${deviceId}/today`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Schedule request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchUpcomingSchedule(deviceId: string): Promise<TodayScheduleResponse> {
  const response = await fetch(`${apiBase}/api/schedule/${deviceId}/upcoming`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Upcoming schedule request failed: ${response.status}`);
  }

  return response.json();
}
