"use client";

import { useEffect, useState } from "react";

import {
  fetchTodaySchedule,
  fetchUpcomingSchedule,
  fetchVehicleStatus,
  type TodayScheduleResponse,
  type VehicleStatusResponse,
} from "@/lib/api";

type DeviceLocation = {
  latitude?: number | null;
  longitude?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  timestamp?: number | null;
};

function formatTime(value: string | null): string {
  if (!value) {
    return "-";
  }
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatLastSeen(seconds: number | null): string {
  if (seconds === null) {
    return "Waiting for GPS...";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }
  return `${Math.floor(seconds / 3600)}h ago`;
}

function getElapsedSeconds(timestamp: number | null | undefined): number | null {
  if (!timestamp) {
    return null;
  }

  const sourceTsMs = timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
  return Math.max(0, Math.floor((Date.now() - sourceTsMs) / 1000));
}

function formatETA(minutes: number | null): string {
  if (minutes === null) {
    return "-";
  }
  if (minutes < 1) {
    return "< 1 min";
  }
  return `${Math.round(minutes)} min`;
}

function formatDistanceMeters(meters: number | null | undefined): string {
  if (meters === null || meters === undefined) {
    return "-";
  }
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(2)} km`;
}

function formatProgress(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined) {
    return "-";
  }
  return `${Math.round(fraction * 100)}%`;
}

function statusClass(status: string): string {
  if (status === "early") return "text-yellow-600";
  if (status === "late") return "text-red-600";
  if (status === "on_time") return "text-green-600";
  return "text-fpuPurple";
}

function liveStatusClass(status: string): string {
  if (status === "live") return "text-green-600";
  if (status === "stale") return "text-yellow-600";
  if (status === "offline") return "text-red-600";
  return "text-fpuPurple";
}

export default function SchedulePanel({
  deviceId,
  location,
}: {
  deviceId: string;
  location?: DeviceLocation | null;
}) {
  const [data, setData] = useState<TodayScheduleResponse | null>(null);
  const [statusData, setStatusData] = useState<VehicleStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpcoming, setIsUpcoming] = useState(false);
  const [liveLastSeenSeconds, setLiveLastSeenSeconds] = useState<number | null>(
    getElapsedSeconds(location?.timestamp),
  );

  useEffect(() => {
    if (!location?.timestamp) {
      setLiveLastSeenSeconds(null);
      return;
    }

    const updateElapsed = () => {
      setLiveLastSeenSeconds(getElapsedSeconds(location.timestamp));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [location]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        try {
          const liveStatus = await fetchVehicleStatus(deviceId);
          if (active) {
            setStatusData(liveStatus);
          }
        } catch {
          if (active) {
            setStatusData(null);
          }
        }

        try {
          const snapshot = await fetchTodaySchedule(deviceId);
          if (active) {
            setData(snapshot);
            setError(null);
            setIsUpcoming(false);
          }
        } catch (todayError) {
          try {
            const upcomingSnapshot = await fetchUpcomingSchedule(deviceId);
            if (active) {
              setData(upcomingSnapshot);
              setError(null);
              setIsUpcoming(true);
            }
          } catch (upcomingError) {
            if (active) {
              setError("Schedule coming soon");
              setData(null);
            }
          }
        }
      } catch (err) {
        if (active) {
          setError("Schedule coming soon");
        }
      }
    };

    load();
    const interval = setInterval(load, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [deviceId]);

  if (error) {
    return <div className="bg-white rounded-lg p-4 text-sm text-gray-600 italic border border-gray-200 shadow-md">{error}</div>;
  }

  if (!data) {
    return <div className="bg-white rounded-lg p-4 text-sm text-gray-600 border border-gray-200 shadow-md">Loading schedule...</div>;
  }

  const displayLastSeenSeconds = liveLastSeenSeconds ?? data.last_seen_seconds;

  return (
    <div className="mt-4 bg-white rounded-lg p-4 text-sm space-y-3 border border-gray-200 shadow-md">
      <h3 className="font-semibold text-fpuPurple uppercase tracking-wide">
        {statusData ? "Live Route Status" : isUpcoming ? "Upcoming Route" : "Today's Route"}
      </h3>

      {statusData && (
        <>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 font-medium">Route:</span>
            <span className="text-fpuPurple font-semibold text-right">{statusData.route_name}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 font-medium">Live Status:</span>
            <span className={`${liveStatusClass(statusData.status)} font-semibold text-right`}>
              {statusData.status.toUpperCase()}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 font-medium">Movement:</span>
            <span className="text-fpuPurple font-mono text-right">{statusData.movement_status}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-600 font-medium">GPS Seen:</span>
            <span className="text-fpuPurple font-mono text-right">{formatLastSeen(statusData.stale_seconds)}</span>
          </div>

          <div className="pt-3 border-t border-gray-200 space-y-2">
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-600">Nearest Stop:</span>
              <span className="text-fpuPurple font-mono text-right">{statusData.spatial.nearest_stop_name}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-600">Next Stop:</span>
              <span className="text-fpuPurple font-mono text-right">{statusData.spatial.next_stop_name}</span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-600">Distance to Next:</span>
              <span className="text-fpuPurple font-mono text-right">
                {formatDistanceMeters(statusData.spatial.next_stop_distance_m)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-600">Route Progress:</span>
              <span className="text-fpuPurple font-mono text-right">
                {formatProgress(statusData.spatial.route_progress_fraction)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-600">Route Offset:</span>
              <span className="text-fpuPurple font-mono text-right">
                {formatDistanceMeters(statusData.spatial.route_offset_m)}
              </span>
            </div>
            <div className="flex justify-between gap-4 text-xs">
              <span className="text-gray-600">At Stop:</span>
              <span className="text-fpuPurple font-mono text-right">
                {statusData.spatial.at_stop ? "YES" : "NO"}
              </span>
            </div>
          </div>

          {statusData.latest_heartbeat && (
            <div className="pt-3 border-t border-gray-200 space-y-2">
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-gray-600">Heartbeat Error:</span>
                <span className="text-fpuPurple font-mono text-right">{statusData.latest_heartbeat.last_error}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-gray-600">Heartbeat Stage:</span>
                <span className="text-fpuPurple font-mono text-right">{statusData.latest_heartbeat.last_stage}</span>
              </div>
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-gray-600">Socket:</span>
                <span className="text-fpuPurple font-mono text-right">
                  {statusData.latest_heartbeat.socket_open ? "OPEN" : "CLOSED"}
                </span>
              </div>
            </div>
          )}
        </>
      )}

      <div className={`${statusData ? "pt-3 border-t border-gray-200" : ""} space-y-3`}>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 font-medium">Service:</span>
          <span className="text-gray-900 text-right">{data.route.service_day_type}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 font-medium">Window:</span>
          <span className="text-gray-900 text-right">{data.route.operating_window}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 font-medium">Direction:</span>
          <span className="text-fpuPurple font-mono text-right">{data.current_direction}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 font-medium">Schedule Status:</span>
          <span className={`${statusClass(data.on_time_status)} font-semibold text-right`}>
            {data.on_time_status.replace("_", " ").toUpperCase()}
          </span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-gray-600 font-medium">Schedule GPS Seen:</span>
          <span className="text-fpuPurple font-mono text-right">{formatLastSeen(displayLastSeenSeconds)}</span>
        </div>

        <div className="pt-3 border-t border-gray-200 space-y-2">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">Scheduled Next Stop:</span>
            <span className="text-fpuPurple font-mono text-right">{data.next_event?.stop_name ?? "None"}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">Event Type:</span>
            <span className="text-fpuPurple font-mono text-right">{data.next_event?.event_type ?? "-"}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">Scheduled:</span>
            <span className="text-fpuPurple font-mono text-right">{formatTime(data.next_event?.scheduled_time ?? null)}</span>
          </div>
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-gray-600">ETA:</span>
            <span className="text-fpuPurple font-mono text-right">{formatETA(data.estimated_arrival_minutes)}</span>
          </div>
        </div>
      </div>

      {data.status_delta_minutes !== null && !isUpcoming && (
        <p className="text-xs text-fpuMedium italic">
          {Math.abs(data.status_delta_minutes) > 5
            ? `${Math.round(Math.abs(data.status_delta_minutes))} min ${data.status_delta_minutes < 0 ? "early" : "late"}`
            : "On schedule"}
        </p>
      )}
    </div>
  );
}
