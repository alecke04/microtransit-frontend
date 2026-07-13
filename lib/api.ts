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

export interface VehicleStatusLocation {
  timestamp: number;
  latitude: number;
  longitude: number;
  speed: number;
  accuracy: number;
  altitude?: number | null;
  course?: number | null;
  satellites?: number | null;
  fix_status: number;
  last_error: string;
  last_stage: string;
}

export interface VehicleStatusHeartbeat {
  timestamp: number;
  received_at: string;
  uptime_ms?: number | null;
  fix_status: number;
  satellites?: number | null;
  modem_responsive: boolean;
  network_ready: boolean;
  ip_ready: boolean;
  socket_open: boolean;
  last_error: string;
  last_stage: string;
  consecutive_send_failures: number;
}

export interface VehicleStopStatus {
  stop_id: string;
  name: string;
  latitude: number;
  longitude: number;
  sequence: number;
  progress_fraction: number;
  straight_line_distance_m: number;
  remaining_route_m: number;
  is_nearest: boolean;
  is_next: boolean;
}

export interface VehicleStopComparison {
  vehicle_id: string;
  route_id: string;
  stop_id: string;
  stop_name: string;
  remaining_route_m: number;
  straight_line_distance_m: number;
  estimated_arrival_seconds: number | null;
  stale_seconds: number;
  movement_status: string;
}

export interface VehicleSpatialContext {
  active_service_code: string;
  active_service_window: string;
  route_geometry: number[][];
  nearest_stop_id: string;
  nearest_stop_name: string;
  nearest_stop_distance_m: number;
  next_stop_id: string;
  next_stop_name: string;
  next_stop_distance_m: number;
  next_stop_remaining_route_m: number;
  route_offset_m: number;
  route_length_m: number;
  route_progress_fraction: number;
  off_route: boolean;
  at_stop: boolean;
  all_stops: VehicleStopStatus[];
  stop_rankings: VehicleStopComparison[];
}

export interface VehicleStatusResponse {
  device_id: string;
  route_id: string;
  route_name: string;
  status: string;
  movement_status: string;
  stale_seconds: number;
  latest_location: VehicleStatusLocation;
  latest_heartbeat?: VehicleStatusHeartbeat | null;
  spatial: VehicleSpatialContext;
}

export interface VehicleStatusListResponse {
  vehicles: VehicleStatusResponse[];
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

export async function fetchVehicleStatus(deviceId: string): Promise<VehicleStatusResponse> {
  const response = await fetch(`${apiBase}/api/status/${deviceId}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Vehicle status request failed: ${response.status}`);
  }

  return response.json();
}

export async function fetchActiveVehicleStatuses(): Promise<VehicleStatusListResponse> {
  const response = await fetch(`${apiBase}/api/status/active`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Active vehicle status request failed: ${response.status}`);
  }

  return response.json();
}
