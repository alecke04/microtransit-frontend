"use client";

import type { LocationUpdateMessage } from "@/lib/websocket";
import { useState, useEffect } from "react";

type DeviceStatusPanelProps = {
  deviceId: string;
  location?: LocationUpdateMessage | null;
};

export default function DeviceStatusPanel({ deviceId, location }: DeviceStatusPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const getSpeedStatus = (speed?: number, hasGPS?: boolean): string => {
    if (!hasGPS) return "Waiting for GPS...";
    if (!speed) return "Stopped";
    if (speed < 5) return "Stopped";
    if (speed < 25) return "Moving";
    return "Fast";
  };

  // Update elapsed time every second
  useEffect(() => {
    if (!location) {
      setElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      const now = Date.now();
      const sourceTsMs = location.timestamp > 1_000_000_000_000 ? location.timestamp : location.timestamp * 1000;
      const elapsed = Math.floor((now - sourceTsMs) / 1000);
      setElapsedSeconds(Math.max(0, elapsed));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [location]);

  return (
    <div className="mt-6 space-y-4">
      <div className="bg-white rounded-lg p-4 text-sm space-y-3 border border-gray-200 shadow-md">
        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Device ID:</span>
          <span className="text-fpuPurple font-semibold">{deviceId}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Status:</span>
          <span className="text-fpuCyan font-semibold">{getSpeedStatus(location?.speed, location?.latitude !== undefined)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Speed:</span>
          <span className="text-fpuPurple font-mono">{location?.speed !== undefined && location?.speed !== null ? `${location.speed.toFixed(1)} km/h` : "Acquiring GPS..."}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Accuracy:</span>
          <span className="text-fpuPurple font-mono">{location?.accuracy !== undefined && location?.accuracy !== null ? `±${location.accuracy.toFixed(1)}m` : "Acquiring GPS..."}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600 font-medium">Last Update:</span>
          <span className="text-fpuPurple font-mono">{elapsedSeconds}s ago</span>
        </div>

        <div className="pt-3 border-t border-gray-200">
          <div className="flex justify-between text-xs">
            <span className="text-gray-600">Latitude:</span>
            <span className="text-fpuPurple font-mono">{location?.latitude?.toFixed(5) ?? "-"}</span>
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-gray-600">Longitude:</span>
            <span className="text-fpuPurple font-mono">{location?.longitude?.toFixed(5) ?? "-"}</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-700 bg-white rounded-lg p-3 border border-gray-200 shadow-md">
        <p className="font-medium mb-2 text-gray-800">Speed Indicator:</p>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <p>0-5 km/h = Stopped</p>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
          <p>5-25 km/h = Moving</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-red-600 rounded-full"></div>
          <p>25+ km/h = Fast</p>
        </div>
      </div>
    </div>
  );
}
