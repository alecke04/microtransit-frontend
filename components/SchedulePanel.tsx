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
    return "No data yet";
  }
  return `${seconds}s ago`;
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

export default function SchedulePanel({ deviceId }: { deviceId: string }) {
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
    const interval = setInterval(load, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [deviceId]);

  if (error) {
    return <div className="bg-fpuBg rounded-lg p-4 text-sm text-fpuMedium italic border border-fpuLight">{error}</div>;
  }

  if (!data) {
    return <div className="bg-fpuBg rounded-lg p-4 text-sm text-fpuMedium border border-fpuLight">Loading schedule...</div>;
  }

  return (
    <div className="mt-4 bg-fpuBg rounded-lg p-4 text-sm space-y-2 border border-fpuLight">
      <h3 className="font-semibold text-fpuPurple">{isUpcoming ? "Upcoming Route" : "Today's Route"}</h3>
      <p><strong>Route:</strong> {data.route.route_name}</p>
      <p><strong>Service:</strong> {data.route.service_day_type}</p>
      <p><strong>Window:</strong> {data.route.operating_window}</p>
      <p><strong>Direction:</strong> {data.current_direction}</p>
      <p><strong>Status:</strong> <span className={data.on_time_status === "early" ? "text-yellow-600" : data.on_time_status === "late" ? "text-red-600" : "text-green-600"}>{data.on_time_status.toUpperCase()}</span></p>
      <p><strong>Last Seen:</strong> {formatLastSeen(data.last_seen_seconds)}</p>
      <hr className="border-fpuLight" />
      <p><strong>Next Stop:</strong> {data.next_event?.stop_name ?? "None"}</p>
      <p><strong>Event Type:</strong> {data.next_event?.event_type ?? "-"}</p>
      <p><strong>Scheduled:</strong> {formatTime(data.next_event?.scheduled_time ?? null)}</p>
      {data.estimated_arrival_minutes !== null && (
        <p><strong>ETA:</strong> <span className="font-semibold text-fpuPurple">{Math.ceil(data.estimated_arrival_minutes)} min</span></p>
      )}
      {data.status_delta_minutes !== null && !isUpcoming && (
        <p className="text-xs text-fpuMedium italic">
          {Math.abs(data.status_delta_minutes) > 5 
            ? `${Math.round(Math.abs(data.status_delta_minutes))} min ${data.status_delta_minutes < 0 ? "early" : "late"}` 
            : "On schedule"}
        </p>
      )}
      <p><strong>ETA:</strong> {formatETA(data.estimated_arrival_minutes)}</p>
    </div>
  );
}
