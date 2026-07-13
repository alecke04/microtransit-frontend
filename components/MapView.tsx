"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Map from "react-map-gl/maplibre";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import type { StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { fetchDeviceHistory, type VehicleStatusResponse } from "@/lib/api";

type MapViewProps = {
  vehicles: VehicleStatusResponse[];
  selectedVehicleId?: string | null;
  selectedStopBaseId?: string | null;
  onSelectVehicle?: (vehicleId: string) => void;
  onSelectStop?: (stopBaseId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
};

const DEFAULT_POSITION = {
  latitude: 28.148,
  longitude: -81.8484,
};

const VEHICLE_COLORS = ["#501D83", "#f97316", "#0ea5e9", "#22c55e"];

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: "osm",
      type: "raster",
      source: "osm",
    },
  ],
};

function toBaseStopId(stopId: string): string {
  return stopId.split("_").at(-1) ?? stopId;
}

export default function MapView({
  vehicles,
  selectedVehicleId,
  selectedStopBaseId,
  onSelectVehicle,
  onSelectStop,
  onConnectionChange,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [historyByDevice, setHistoryByDevice] = useState<Record<string, [number, number][]>>({});

  const selectedVehicle = useMemo(
    () => vehicles.find((vehicle) => vehicle.device_id === selectedVehicleId) ?? vehicles[0] ?? null,
    [selectedVehicleId, vehicles],
  );

  const visibleStops = useMemo(
    () => selectedVehicle?.spatial.all_stops ?? vehicles[0]?.spatial.all_stops ?? [],
    [selectedVehicle, vehicles],
  );

  const selectedStop = useMemo(() => {
    if (!selectedStopBaseId) {
      return null;
    }
    return visibleStops.find((stop) => toBaseStopId(stop.stop_id) === selectedStopBaseId) ?? null;
  }, [selectedStopBaseId, visibleStops]);

  useEffect(() => {
    let active = true;

    const loadHistories = async () => {
      const nextHistory: Record<string, [number, number][]> = {};
      for (const vehicle of vehicles) {
        try {
          const history = await fetchDeviceHistory(vehicle.device_id, 250, false);
          nextHistory[vehicle.device_id] = history.locations
            .slice()
            .reverse()
            .map((point) => [point.latitude, point.longitude] as [number, number]);
        } catch {
          nextHistory[vehicle.device_id] = [];
        }
      }

      if (active) {
        setHistoryByDevice((current) => ({ ...current, ...nextHistory }));
        onConnectionChange?.(vehicles.length > 0);
      }
    };

    if (vehicles.length > 0) {
      void loadHistories();
    }

    const interval = setInterval(() => {
      if (vehicles.length > 0) {
        void loadHistories();
      }
    }, 15000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [onConnectionChange, vehicles]);

  const routeGeometry = useMemo(
    () => selectedVehicle?.spatial.route_geometry ?? vehicles[0]?.spatial.route_geometry ?? [],
    [selectedVehicle, vehicles],
  );

  const routeSourceData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: routeGeometry.length
        ? [
            {
              type: "Feature" as const,
              geometry: {
                type: "LineString" as const,
                coordinates: routeGeometry.map((point) => [point[1], point[0]]),
              },
              properties: {},
            },
          ]
        : [],
    }),
    [routeGeometry],
  );

  const stopSourceData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: visibleStops.map((stop) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [stop.longitude, stop.latitude],
        },
        properties: {
          stopId: stop.stop_id,
          baseStopId: toBaseStopId(stop.stop_id),
          isSelected: selectedStopBaseId === toBaseStopId(stop.stop_id),
        },
      })),
    }),
    [selectedStopBaseId, visibleStops],
  );

  const trailSources = useMemo(
    () =>
      vehicles.map((vehicle, index) => {
        const coordinates = historyByDevice[vehicle.device_id] ?? [];
        return {
          id: vehicle.device_id,
          color: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
          data: {
            type: "FeatureCollection" as const,
            features: coordinates.length
              ? [
                  {
                    type: "Feature" as const,
                    geometry: {
                      type: "LineString" as const,
                      coordinates: coordinates.map((coord) => [coord[1], coord[0]]),
                    },
                    properties: {},
                  },
                ]
              : [],
          },
        };
      }),
    [historyByDevice, vehicles],
  );

  useEffect(() => {
    if (!mapRef.current) {
      return;
    }

    const points: [number, number][] = [];
    if (selectedStop) {
      points.push([selectedStop.latitude, selectedStop.longitude]);
    }

    if (selectedVehicle) {
      points.push([selectedVehicle.latest_location.latitude, selectedVehicle.latest_location.longitude]);
    } else {
      vehicles.forEach((vehicle) => {
        points.push([vehicle.latest_location.latitude, vehicle.latest_location.longitude]);
      });
    }

    if (!points.length && routeGeometry.length) {
      points.push(...routeGeometry.map((point) => [point[0], point[1]] as [number, number]));
    }

    if (!points.length) {
      return;
    }

    const latitudes = points.map((point) => point[0]);
    const longitudes = points.map((point) => point[1]);
    mapRef.current.fitBounds(
      [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
      ],
      { padding: 70, duration: 800 },
    );
  }, [routeGeometry, selectedStop, selectedVehicle, vehicles]);

  const selectedVehicleColor = selectedVehicle
    ? VEHICLE_COLORS[
        Math.max(
          0,
          vehicles.findIndex((vehicle) => vehicle.device_id === selectedVehicle.device_id),
        ) % VEHICLE_COLORS.length
      ]
    : VEHICLE_COLORS[0];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: DEFAULT_POSITION.latitude,
          longitude: DEFAULT_POSITION.longitude,
          zoom: 14.8,
          pitch: 0,
          bearing: 0,
        }}
        interactiveLayerIds={["stop-circles"]}
        onClick={(event) => {
          const feature = event.features?.[0];
          if (feature?.layer?.id === "stop-circles") {
            const stopBaseId = String(feature.properties?.baseStopId ?? "");
            if (stopBaseId) {
              onSelectStop?.(stopBaseId);
            }
          }
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={MAP_STYLE}
      >
        <Source id="route" type="geojson" data={routeSourceData}>
          <Layer
            id="route-line"
            type="line"
            paint={{
              "line-color": selectedVehicleColor,
              "line-width": 5,
              "line-opacity": 0.45,
            }}
            layout={{
              "line-cap": "round",
              "line-join": "round",
            }}
          />
        </Source>

        {trailSources.map((trail) => (
          <Source key={trail.id} id={`trail-${trail.id}`} type="geojson" data={trail.data}>
            <Layer
              id={`trail-line-${trail.id}`}
              type="line"
              paint={{
                "line-color": trail.color,
                "line-width": selectedVehicleId === trail.id ? 4 : 3,
                "line-opacity": selectedVehicleId === trail.id ? 0.85 : 0.45,
              }}
              layout={{
                "line-cap": "round",
                "line-join": "round",
              }}
            />
          </Source>
        ))}

        <Source id="stops" type="geojson" data={stopSourceData}>
          <Layer
            id="stop-circles"
            type="circle"
            paint={{
              "circle-radius": ["case", ["boolean", ["get", "isSelected"], false], 9, 6],
              "circle-color": ["case", ["boolean", ["get", "isSelected"], false], "#f97316", "#ffffff"],
              "circle-stroke-color": "#501D83",
              "circle-stroke-width": 2,
            }}
          />
        </Source>

        {vehicles.map((vehicle, index) => (
          <Marker
            key={vehicle.device_id}
            latitude={vehicle.latest_location.latitude}
            longitude={vehicle.latest_location.longitude}
            anchor="center"
            onClick={(event) => {
              event.originalEvent.stopPropagation();
              onSelectVehicle?.(vehicle.device_id);
            }}
          >
            <div
              style={{
                minWidth: 26,
                height: 26,
                padding: "0 8px",
                borderRadius: 999,
                background: selectedVehicleId === vehicle.device_id ? VEHICLE_COLORS[index % VEHICLE_COLORS.length] : "#ffffff",
                color: selectedVehicleId === vehicle.device_id ? "#ffffff" : VEHICLE_COLORS[index % VEHICLE_COLORS.length],
                border: `2px solid ${VEHICLE_COLORS[index % VEHICLE_COLORS.length]}`,
                boxShadow: "0 4px 10px rgba(0,0,0,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {vehicle.device_id.split("_").at(-1)}
            </div>
          </Marker>
        ))}

        {selectedStop && (
          <Marker latitude={selectedStop.latitude} longitude={selectedStop.longitude} anchor="bottom">
            <div
              style={{
                background: "#ffffff",
                color: "#501D83",
                border: "2px solid #501D83",
                borderRadius: 12,
                padding: "4px 8px",
                fontSize: 12,
                fontWeight: 700,
                boxShadow: "0 6px 14px rgba(0,0,0,0.18)",
              }}
            >
              {selectedStop.name}
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}

