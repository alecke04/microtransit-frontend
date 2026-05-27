"use client";

import { useEffect, useState } from "react";

import type { LocationUpdateMessage } from "@/lib/websocket";

type DeviceStatusPanelProps = {
  deviceId: string;
  location?: LocationUpdateMessage | null;
};

export default function DeviceStatusPanel({ deviceId, location }: DeviceStatusPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const getSpeedStatus = (speed?: number, hasGPS?: boolean): string => {
    if (!hasGPS) return "Waiting for GPS...";
    if (!speed || speed < 5) return "Stopped";
    if (speed < 25) return "Moving";
    return "Fast";
  };

  useEffect(() => {
    if (!location) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const now = Date.now();
      const sourceTsMs =
        location.timestamp > 1_000_000_000_000 ? location.timestamp : location.timestamp * 1000;
      const elapsed = Math.floor((now - sourceTsMs) / 1000);
      setElapsedSeconds(Math.max(0, elapsed));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [location]);

  return (
    <div className="mt-6 space-y-4">
      <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-md">
        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Device ID:</span>
          <span className="font-semibold text-fpuPurple">{deviceId}</span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Status:</span>
          <span className="font-semibold text-fpuCyan">
            {getSpeedStatus(location?.speed, location?.latitude !== undefined)}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Speed:</span>
          <span className="font-mono text-fpuPurple">
            {location?.speed !== undefined && location?.speed !== null
              ? `${location.speed.toFixed(1)} km/h`
              : "Acquiring GPS..."}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Accuracy:</span>
          <span className="font-mono text-fpuPurple">
            {location?.accuracy !== undefined && location?.accuracy !== null
              ? `+/- ${location.accuracy.toFixed(1)} m`
              : "Acquiring GPS..."}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="font-medium text-gray-600">Last Update:</span>
          <span className="font-mono text-fpuPurple">{elapsedSeconds}s ago</span>
        </div>

        <div className="border-t border-gray-200 pt-3">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Latitude:</span>
            <span className="font-mono text-fpuPurple">{location?.latitude?.toFixed(5) ?? "-"}</span>
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <span className="text-gray-600">Longitude:</span>
            <span className="font-mono text-fpuPurple">
              {location?.longitude?.toFixed(5) ?? "-"}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700 shadow-md">
        <p className="mb-2 font-medium text-gray-800">Speed Indicator:</p>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <p>0-5 km/h = Stopped</p>
        </div>
        <div className="mb-1 flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500" />
          <p>5-25 km/h = Moving</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-red-600" />
          <p>25+ km/h = Fast</p>
        </div>
      </div>
    </div>
  );
}
