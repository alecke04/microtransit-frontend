"use client";

import type { LocationUpdateMessage } from "@/lib/websocket";
import { useState, useEffect } from "react";

type DeviceStatusPanelProps = {
  deviceId: string;
  location?: LocationUpdateMessage | null;
};

export default function DeviceStatusPanel({ deviceId, location }: DeviceStatusPanelProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const getSpeedStatus = (speed?: number): string => {
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
      <div className="bg-fpuBg rounded-lg p-4 text-sm space-y-3 border border-fpuLight">
        <div className="flex justify-between">
          <span className="text-fpuMedium font-medium">Device ID:</span>
          <span className="text-fpuPurple font-semibold">{deviceId}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-fpuMedium font-medium">Status:</span>
          <span className="text-fpuCyan font-semibold">{getSpeedStatus(location?.speed)}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-fpuMedium font-medium">Speed:</span>
          <span className="text-fpuPurple font-mono">{location?.speed?.toFixed(1) ?? "-"} km/h</span>
        </div>

        <div className="flex justify-between">
          <span className="text-fpuMedium font-medium">Accuracy:</span>
          <span className="text-fpuPurple font-mono">{location?.accuracy?.toFixed(1) ?? "-"} m</span>
        </div>

        <div className="flex justify-between">
          <span className="text-fpuMedium font-medium">Last Update:</span>
          <span className="text-fpuPurple font-mono">{elapsedSeconds}s ago</span>
        </div>

        <div className="pt-3 border-t border-fpuLight">
          <div className="flex justify-between text-xs">
            <span className="text-fpuMedium">Latitude:</span>
            <span className="text-fpuPurple font-mono">{location?.latitude?.toFixed(5) ?? "-"}</span>
          </div>
          <div className="flex justify-between mt-2 text-xs">
            <span className="text-fpuMedium">Longitude:</span>
            <span className="text-fpuPurple font-mono">{location?.longitude?.toFixed(5) ?? "-"}</span>
          </div>
        </div>
      </div>

      <div className="text-xs text-fpuMedium bg-fpuBg rounded p-3 border border-fpuLight">
        <p className="font-medium mb-2">Speed Legend:</p>
        <p>0-5 km/h = Stopped</p>
        <p> 5-25 km/h = Moving</p>
        <p>[RED_DOT] 25+ km/h = Fast</p>
      </div>
    </div>
  );
}
