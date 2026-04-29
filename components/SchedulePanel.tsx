"use client";

import { useEffect, useState } from "react";

import { fetchTodaySchedule, fetchUpcomingSchedule, type TodayScheduleResponse } from "@/lib/api";

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

function formatETA(minutes: number | null): string {
  if (minutes === null) {
    return "-";
  }
  if (minutes < 1) {
    return "< 1 min";
  }
  return `${Math.round(minutes)} min`;
}

function statusClass(status: string): string {
  if (status === "early") return "text-yellow-600";
  if (status === "late") return "text-red-600";
  if (status === "on_time") return "text-green-600";
  return "text-fpuPurple";
}

export default function SchedulePanel({
  deviceId,
}: {
  deviceId: string;
}) {
  const [data, setData] = useState<TodayScheduleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUpcoming, setIsUpcoming] = useState(false);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        // Try today's schedule first
        try {
          const snapshot = await fetchTodaySchedule(deviceId);
          if (active) {
            setData(snapshot);
            setError(null);
            setIsUpcoming(false);
          }
        } catch (todayError) {
          // If today is empty, try upcoming schedule
          try {
            const upcomingSnapshot = await fetchUpcomingSchedule(deviceId);
            if (active) {
              setData(upcomingSnapshot);
              setError(null);
              setIsUpcoming(true);
            }
          } catch (upcomingError) {
            // Both failed
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

  return (
    <div className="mt-4 bg-white rounded-lg p-4 text-sm space-y-3 border border-gray-200 shadow-md">
      <h3 className="font-semibold text-fpuPurple uppercase tracking-wide">{isUpcoming ? "Upcoming Route" : "Today's Route"}</h3>

      <div className="flex justify-between gap-4">
        <span className="text-gray-600 font-medium">Route:</span>
        <span className="text-fpuPurple font-semibold text-right">{data.route.route_name}</span>
      </div>
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
        <span className="text-gray-600 font-medium">Status:</span>
        <span className={`${statusClass(data.on_time_status)} font-semibold text-right`}>
          {data.on_time_status.replace("_", " ").toUpperCase()}
        </span>
      </div>
      <div className="flex justify-between gap-4">
        <span className="text-gray-600 font-medium">GPS Seen:</span>
        <span className="text-fpuPurple font-mono text-right">{formatLastSeen(data.last_seen_seconds)}</span>
      </div>

      <div className="pt-3 border-t border-gray-200 space-y-2">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-gray-600">Next Stop:</span>
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
