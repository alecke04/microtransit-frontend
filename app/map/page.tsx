"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

import Header from "@/components/Header";
import ConnectionBadge from "@/components/ConnectionBadge";
import DeviceStatusPanel from "@/components/DeviceStatusPanel";
import SchedulePanel from "@/components/SchedulePanel";
import {
  fetchActiveVehicleStatuses,
  fetchCurrentServiceSnapshot,
  type CurrentServiceSnapshotResponse,
  type ServiceRouteSnapshotResponse,
  type VehicleStatusResponse,
} from "@/lib/api";

// MapLibre requires browser APIs; dynamic import disables SSR for this component.
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

function toBaseStopId(stopId: string): string {
  return stopId.split("_").at(-1) ?? stopId;
}

function estimateEtaMinutes(remainingRouteM: number, speedKmh: number): number {
  const effectiveSpeedKmh = speedKmh >= 1 ? speedKmh : 5;
  const metersPerSecond = Math.max(0.5, (effectiveSpeedKmh * 1000) / 3600);
  return remainingRouteM / metersPerSecond / 60;
}

export default function MapPage() {
  const [connected, setConnected] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleStatusResponse[]>([]);
  const [serviceSnapshot, setServiceSnapshot] = useState<CurrentServiceSnapshotResponse | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedStopBaseId, setSelectedStopBaseId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadVehicles = async () => {
      try {
        const response = await fetchActiveVehicleStatuses();
        if (!active) {
          return;
        }

        setVehicles(response.vehicles);
        setConnected(response.vehicles.length > 0);

        setSelectedVehicleId((current) => current ?? response.vehicles[0]?.device_id ?? null);
        setSelectedStopBaseId((current) => {
          if (current) {
            return current;
          }
          const firstVehicle = response.vehicles[0];
          return firstVehicle ? toBaseStopId(firstVehicle.spatial.next_stop_id) : null;
        });
      } catch (error) {
        if (!active) {
          return;
        }
        setConnected(false);
      }
    };

    const loadServiceSnapshot = async () => {
      try {
        const response = await fetchCurrentServiceSnapshot();
        if (!active) {
          return;
        }
        setServiceSnapshot(response);
        setSelectedStopBaseId((current) => {
          if (current) {
            return current;
          }
          const firstStop = response.active_service?.stops[0] ?? response.upcoming_service?.stops[0] ?? null;
          return firstStop ? toBaseStopId(firstStop.stop_id) : null;
        });
      } catch {
        if (!active) {
          return;
        }
        setServiceSnapshot(null);
      }
    };

    void loadVehicles();
    void loadServiceSnapshot();
    const vehicleInterval = setInterval(loadVehicles, 3000);
    const serviceInterval = setInterval(loadServiceSnapshot, 60000);

    return () => {
      active = false;
      clearInterval(vehicleInterval);
      clearInterval(serviceInterval);
    };
  }, []);

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.device_id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const activeStops = useMemo(
    () => {
      if (selectedVehicle) {
        return selectedVehicle.spatial.all_stops;
      }
      const fallbackService = serviceSnapshot?.active_service ?? serviceSnapshot?.upcoming_service ?? null;
      if (!fallbackService) {
        return [];
      }
      return fallbackService.stops.map((stop) => ({
        ...stop,
        straight_line_distance_m: 0,
        remaining_route_m: 0,
        is_nearest: false,
        is_next: false,
      }));
    },
    [selectedVehicle, serviceSnapshot],
  );

  const visibleService = useMemo<ServiceRouteSnapshotResponse | null>(
    () =>
      serviceSnapshot?.services.find(
        (service) => selectedVehicle && service.service_code === selectedVehicle.spatial.active_service_code,
      ) ??
      serviceSnapshot?.active_service ??
      serviceSnapshot?.upcoming_service ??
      null,
    [selectedVehicle, serviceSnapshot],
  );

  const routeGeometry = useMemo(
    () => selectedVehicle?.spatial.route_geometry ?? visibleService?.geometry ?? [],
    [selectedVehicle, visibleService],
  );

  const selectedStop = useMemo(() => {
    if (!selectedStopBaseId) {
      return null;
    }
    return (
      activeStops.find((stop) => toBaseStopId(stop.stop_id) === selectedStopBaseId) ??
      null
    );
  }, [activeStops, selectedStopBaseId]);

  const stopComparisons = useMemo(() => {
    if (!selectedStopBaseId) {
      return [];
    }

    return vehicles
      .map((vehicle) => {
        const stop = vehicle.spatial.all_stops.find(
          (candidate) => toBaseStopId(candidate.stop_id) === selectedStopBaseId,
        );
        if (!stop) {
          return null;
        }

        return {
          vehicleId: vehicle.device_id,
          routeName: vehicle.route_name,
          remainingRouteM: stop.remaining_route_m,
          straightLineDistanceM: stop.straight_line_distance_m,
          etaMinutes: estimateEtaMinutes(stop.remaining_route_m, vehicle.latest_location.speed),
        };
      })
      .filter((value): value is NonNullable<typeof value> => value !== null)
      .sort((a, b) => a.remainingRouteM - b.remainingRouteM);
  }, [selectedStopBaseId, vehicles]);

  return (
    <>
      <Header />
      <main className="map-layout">
        {/* Left Sidebar - Device Status */}
        <aside className="sidebar">
          <Link href="/" className="mb-6 inline-flex items-center gap-2 px-4 py-2 bg-fpuPurple text-white rounded-lg font-semibold hover:bg-fpuDark transition">
            &larr; Home
          </Link>
          <h2>Fleet Status</h2>
          <ConnectionBadge connected={connected} />

          <div className="mt-4 space-y-2">
            {vehicles.map((vehicle) => (
              <button
                key={vehicle.device_id}
                type="button"
                onClick={() => {
                  setSelectedVehicleId(vehicle.device_id);
                  setSelectedStopBaseId(toBaseStopId(vehicle.spatial.next_stop_id));
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                  vehicle.device_id === selectedVehicle?.device_id
                    ? "border-fpuPurple bg-fpuPurple text-white"
                    : "border-gray-200 bg-white text-fpuPurple hover:border-fpuPurple"
                }`}
              >
                <div className="font-semibold">{vehicle.device_id}</div>
                <div className="text-xs opacity-80">{vehicle.route_name}</div>
              </button>
            ))}
          </div>

          {selectedVehicle && (
            <DeviceStatusPanel
              deviceId={selectedVehicle.device_id}
              location={selectedVehicle.latest_location}
            />
          )}
        </aside>

        {/* Center - Map */}
        <section className="map-section">
          <MapView
            vehicles={vehicles}
            routeGeometry={routeGeometry}
            visibleStops={activeStops}
            selectedVehicleId={selectedVehicle?.device_id ?? null}
            selectedStopBaseId={selectedStopBaseId}
            onSelectVehicle={(vehicleId) => {
              setSelectedVehicleId(vehicleId);
              const matchedVehicle = vehicles.find((vehicle) => vehicle.device_id === vehicleId);
              if (matchedVehicle) {
                setSelectedStopBaseId(toBaseStopId(matchedVehicle.spatial.next_stop_id));
              }
            }}
            onSelectStop={(stopBaseId) => setSelectedStopBaseId(stopBaseId)}
            onConnectionChange={setConnected}
          />
        </section>

        {/* Right Sidebar - Schedule */}
        <aside className="sidebar right">
          <h2>Stops</h2>
          <div className="mt-4 max-h-[40vh] space-y-2 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 shadow-md">
            {activeStops.map((stop) => {
              const baseStopId = toBaseStopId(stop.stop_id);
              return (
                <button
                  key={stop.stop_id}
                  type="button"
                  onClick={() => setSelectedStopBaseId(baseStopId)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                    selectedStopBaseId === baseStopId
                      ? "border-fpuPurple bg-fpuPurple text-white"
                      : "border-gray-200 bg-white text-fpuPurple hover:border-fpuPurple"
                  }`}
                >
                  <div className="font-semibold">{stop.name}</div>
                  <div className="text-xs opacity-80">
                    Seq {stop.sequence} · {Math.round(stop.remaining_route_m)} m
                  </div>
                </button>
              );
            })}
          </div>

          {selectedStop && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 text-sm shadow-md">
              <h3 className="font-semibold text-fpuPurple">{selectedStop.name}</h3>
              <p className="mt-1 text-xs text-gray-600">
                Active comparison for {stopComparisons.length} vehicles
              </p>
              <div className="mt-3 space-y-2">
                {stopComparisons.map((comparison) => (
                  <div key={comparison.vehicleId} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                    <div className="font-semibold text-fpuPurple">{comparison.vehicleId}</div>
                    <div className="text-xs text-gray-700">
                      {comparison.routeName}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Route remaining: {Math.round(comparison.remainingRouteM)} m
                    </div>
                    <div className="text-xs text-gray-600">
                      ETA: {comparison.etaMinutes < 1 ? "< 1 min" : `${Math.round(comparison.etaMinutes)} min`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedVehicle && (
            <SchedulePanel
              deviceId={selectedVehicle.device_id}
              location={selectedVehicle.latest_location}
            />
          )}
        </aside>
      </main>
    </>
  );
}
