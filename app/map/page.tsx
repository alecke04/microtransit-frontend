"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import Header from "@/components/Header";
import ConnectionBadge from "@/components/ConnectionBadge";
import DeviceStatusPanel from "@/components/DeviceStatusPanel";
import { getConfiguredDevices } from "@/lib/devices";
import type { LocationUpdateMessage } from "@/lib/websocket";

// Map rendering requires browser APIs; dynamic import disables SSR for this component.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapPage() {
  const configuredDevices = getConfiguredDevices();
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [connected, setConnected] = useState(false);
  const [location, setLocation] = useState<LocationUpdateMessage | null>(null);
  const activeDevice = configuredDevices[deviceIndex] ?? configuredDevices[0];
  const deviceId = activeDevice?.id ?? "TEAM_GPS_01";

  useEffect(() => {
    setConnected(false);
    setLocation(null);
  }, [deviceId]);

  const cycleDevice = () => {
    setDeviceIndex((current) => {
      if (configuredDevices.length <= 1) {
        return current;
      }
      return (current + 1) % configuredDevices.length;
    });
  };

  return (
    <>
      <Header />
      <main className="map-layout">
        {/* Left Sidebar - Device Status */}
        <aside className="sidebar">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-fpuPurple text-white rounded-lg font-semibold hover:bg-fpuDark transition">
            &larr; Home
          </Link>
          <h2>Device Status</h2>
          <ConnectionBadge connected={connected} />
          <DeviceStatusPanel deviceId={deviceId} location={location} />
        </aside>

        {/* Center - Map */}
        <section className="map-section">
          <MapView
            deviceId={deviceId}
            onConnectionChange={setConnected}
            onLocationUpdate={setLocation}
          />
        </section>

        {/* Right Sidebar - Vehicle selection only. Schedule endpoints were retired. */}
        <aside className="sidebar right">
          <button
            type="button"
            onClick={cycleDevice}
            className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-fpuPurple text-white rounded-lg font-semibold hover:bg-fpuDark transition"
          >
            {activeDevice?.label ?? "Bus"} &rarr;
          </button>
          <h2>Live Vehicle</h2>
          <div className="bg-white rounded-lg p-4 text-sm text-gray-600 border border-gray-200 shadow-md">
            Tracking <span className="font-semibold text-fpuPurple">{activeDevice?.label ?? deviceId}</span> from live GPS telemetry.
          </div>
        </aside>
      </main>
    </>
  );
}
