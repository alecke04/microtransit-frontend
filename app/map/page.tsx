"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import Header from "@/components/Header";
import ConnectionBadge from "@/components/ConnectionBadge";
import DeviceStatusPanel from "@/components/DeviceStatusPanel";
import SchedulePanel from "@/components/SchedulePanel";
import type { LocationUpdateMessage } from "@/lib/websocket";

// Leaflet requires browser APIs; dynamic import disables SSR for this component.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function MapPage() {
  const deviceId = "TEAM_GPS_01";
  const [connected, setConnected] = useState(false);
  const [location, setLocation] = useState<LocationUpdateMessage | null>(null);

  return (
    <>
      <Header />
      <main className="map-layout">
        <aside className="sidebar">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-fpuPurple text-white rounded-lg font-semibold hover:bg-fpuDark transition">
            ← Home
          </Link>
          <h2>Device Status</h2>
          <ConnectionBadge connected={connected} />
          <DeviceStatusPanel deviceId={deviceId} location={location} />
          <SchedulePanel deviceId={deviceId} />
        </aside>
        <section className="map-section">
          <MapView 
            deviceId={deviceId} 
            onConnectionChange={setConnected}
            onLocationUpdate={setLocation}
          />
        </section>
      </main>
    </>
  );
}
