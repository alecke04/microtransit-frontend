"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Map from "react-map-gl/maplibre";
import { Layer, Source } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { fetchDeviceHistory } from "@/lib/api";
import { openDeviceSocket } from "@/lib/websocket";
import type { LocationUpdateMessage } from "@/lib/websocket";

type MapViewProps = {
  deviceId: string;
  onConnectionChange?: (connected: boolean) => void;
  onLocationUpdate?: (data: LocationUpdateMessage) => void;
};

const DEFAULT_POSITION = {
  latitude: 28.148,
  longitude: -81.8484,
  speed: 0,
};

function getMarkerColor(speed: number): string {
  if (speed < 5) return "#10b981";
  if (speed < 25) return "#f97316";
  return "#dc2626";
}

export default function MapView({
  deviceId,
  onConnectionChange,
  onLocationUpdate,
}: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const pointsRef = useRef<[number, number][]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPosRef = useRef(DEFAULT_POSITION);
  const rotationFrameRef = useRef<number | null>(null);
  const rotationSpeedRef = useRef(0.004);
  const targetRotationSpeedRef = useRef(0.004);
  const interactionStateRef = useRef<{
    active: boolean;
    pointerType: "touch" | "mouse" | null;
    lastX: number | null;
  }>({
    active: false,
    pointerType: null,
    lastX: null,
  });

  const [markerData, setMarkerData] = useState(DEFAULT_POSITION);
  const [trailCoords, setTrailCoords] = useState<[number, number][]>([]);
  const [stationaryPoints, setStationaryPoints] = useState<[number, number, number][]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const safeMarkerData = useMemo(
    () => ({
      latitude: Number.isFinite(markerData.latitude) ? markerData.latitude : DEFAULT_POSITION.latitude,
      longitude: Number.isFinite(markerData.longitude) ? markerData.longitude : DEFAULT_POSITION.longitude,
      speed: Number.isFinite(markerData.speed) ? markerData.speed : 0,
    }),
    [markerData.latitude, markerData.longitude, markerData.speed],
  );

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;

    const setConnection = (value: boolean) => {
      onConnectionChange?.(value);
    };

    const updateTrail = (latlng: [number, number], speed: number) => {
      const lastPoint = pointsRef.current[pointsRef.current.length - 1];
      if (!lastPoint || lastPoint[0] !== latlng[0] || lastPoint[1] !== latlng[1]) {
        pointsRef.current.push(latlng);
        setTrailCoords([...pointsRef.current]);
      }

      if (speed < 5) {
        setStationaryPoints((prev) => {
          const lastStationary = prev[prev.length - 1];
          if (lastStationary && lastStationary[0] === latlng[0] && lastStationary[1] === latlng[1]) {
            return prev;
          }
          return [...prev, [latlng[0], latlng[1], speed]];
        });
      }
    };

    const animateMarker = (latlng: [number, number], speed: number) => {
      const startLat = currentPosRef.current.latitude;
      const startLng = currentPosRef.current.longitude;
      const endLat = latlng[0];
      const endLng = latlng[1];
      const startTime = performance.now();
      const durationMs = 900;

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      const step = (now: number) => {
        if (disposed) return;

        const progress = Math.min((now - startTime) / durationMs, 1);
        const eased =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const latitude = startLat + (endLat - startLat) * eased;
        const longitude = startLng + (endLng - startLng) * eased;

        currentPosRef.current = { latitude, longitude, speed };
        setMarkerData(currentPosRef.current);

        if (progress < 1) {
          animationFrameRef.current = requestAnimationFrame(step);
        } else {
          currentPosRef.current = { latitude: endLat, longitude: endLng, speed };
          setMarkerData(currentPosRef.current);
          animationFrameRef.current = null;
        }
      };

      animationFrameRef.current = requestAnimationFrame(step);

      if (mapRef.current) {
        mapRef.current.jumpTo({
          center: [endLng, endLat],
        });
      }
    };

    const addPoint = (latlng: [number, number], message?: LocationUpdateMessage) => {
      if (disposed) return;

      if (!Number.isFinite(latlng[0]) || !Number.isFinite(latlng[1])) {
        console.error("[MapView] Ignoring invalid coordinates", latlng);
        return;
      }

      const speed = message?.speed ?? 0;
      updateTrail(latlng, speed);
      animateMarker(latlng, speed);

      if (message) {
        onLocationUpdate?.(message);
      }
    };

    const connectSocket = () => {
      if (disposed) return;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      socket?.close();
      socket = openDeviceSocket(
        deviceId,
        (message) => {
          if (disposed) return;
          addPoint([message.latitude, message.longitude], message);
        },
        (connected) => {
          if (disposed) return;

          setConnection(connected);

          if (!connected && !reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = setTimeout(() => {
              reconnectTimeoutRef.current = null;
              connectSocket();
            }, 3000);
          }
        },
      );
    };

    const seedInitialPosition = (latlng: [number, number]) => {
      pointsRef.current = [latlng];
      currentPosRef.current = {
        latitude: latlng[0],
        longitude: latlng[1],
        speed: 0,
      };
      setTrailCoords([latlng]);
      setMarkerData(currentPosRef.current);
    };

    const loadHistory = async () => {
      try {
        const useMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
        const historyResponse = await fetchDeviceHistory(deviceId, 100, useMockMode);
        const coords = historyResponse.locations
          .map((p) => [p.latitude, p.longitude] as [number, number])
          .reverse();

        if (coords.length > 0) {
          seedInitialPosition(coords[coords.length - 1]);
        }
      } catch (primaryError) {
        console.warn("[MapView] Primary history load failed, retrying with mock mode", primaryError);

        try {
          const historyResponse = await fetchDeviceHistory(deviceId, 100, true);
          const coords = historyResponse.locations
            .map((p) => [p.latitude, p.longitude] as [number, number])
            .reverse();

          if (coords.length > 0) {
            seedInitialPosition(coords[coords.length - 1]);
          } else {
            seedInitialPosition([DEFAULT_POSITION.latitude, DEFAULT_POSITION.longitude]);
          }
        } catch (fallbackError) {
          console.error("[MapView] Unable to load history, using default marker position", fallbackError);
          seedInitialPosition([DEFAULT_POSITION.latitude, DEFAULT_POSITION.longitude]);
        }
      }

      connectSocket();
    };

    loadHistory();

    return () => {
      disposed = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      socket?.close();
    };
  }, [deviceId, onConnectionChange, onLocationUpdate]);

  useEffect(() => {
    let disposed = false;
    let lastFrameTime = performance.now();
    let currentBearing = 0;

    const rotate = (now: number) => {
      if (disposed) return;

      const deltaMs = now - lastFrameTime;
      lastFrameTime = now;

      rotationSpeedRef.current += (targetRotationSpeedRef.current - rotationSpeedRef.current) * 0.08;
      currentBearing = (currentBearing + deltaMs * rotationSpeedRef.current) % 360;

      if (mapRef.current) {
        mapRef.current.setBearing(currentBearing);
      }

      rotationFrameRef.current = requestAnimationFrame(rotate);
    };

    rotationFrameRef.current = requestAnimationFrame(rotate);

    return () => {
      disposed = true;
      if (rotationFrameRef.current !== null) {
        cancelAnimationFrame(rotationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const map = mapRef.current.getMap();

    const registerMarkerImage = (id: string, fill: string) => {
      if (map.hasImage(id)) return;

      const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="88" height="88" viewBox="0 0 88 88">
          <defs>
            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="10" stdDeviation="7" flood-color="rgba(0,0,0,0.30)"/>
            </filter>
            <linearGradient id="body" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stop-color="${fill}" stop-opacity="0.98"/>
              <stop offset="62%" stop-color="${fill}" stop-opacity="1"/>
              <stop offset="100%" stop-color="${fill}" stop-opacity="0.9"/>
            </linearGradient>
          </defs>
          <g filter="url(#shadow)">
            <circle cx="44" cy="44" r="26" fill="url(#body)" stroke="#ffffff" stroke-width="3"/>
            <circle cx="44" cy="44" r="31" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>
            <ellipse cx="33" cy="30" rx="10" ry="6" fill="rgba(255,255,255,0.38)" transform="rotate(-25 33 30)"/>
            <circle cx="44" cy="44" r="15" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.18)" stroke-width="1.5"/>
          </g>
        </svg>
      `.trim();

      const image = new Image(88, 88);
      image.onload = () => {
        if (!map.hasImage(id)) {
          map.addImage(id, image, { pixelRatio: 2 });
        }
      };
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    };

    registerMarkerImage("vehicle-marker-green", "#10b981");
    registerMarkerImage("vehicle-marker-orange", "#f97316");
    registerMarkerImage("vehicle-marker-red", "#dc2626");
  }, [mapLoaded]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") {
      interactionStateRef.current = {
        active: true,
        pointerType: "touch",
        lastX: event.clientX,
      };
      return;
    }

    if (event.pointerType === "mouse" && event.button === 0) {
      interactionStateRef.current = {
        active: true,
        pointerType: "mouse",
        lastX: event.clientX,
      };
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!interactionStateRef.current.active) return;
    if (interactionStateRef.current.pointerType !== event.pointerType) return;

    const { lastX } = interactionStateRef.current;
    if (lastX === null) {
      interactionStateRef.current.lastX = event.clientX;
      return;
    }

    const deltaX = event.clientX - lastX;
    interactionStateRef.current.lastX = event.clientX;

    const multiplier = event.pointerType === "mouse" ? 0.0032 : 0.0017;
    const maxSpeed = event.pointerType === "mouse" ? 0.065 : 0.04;
    const adjustedSpeed = Math.max(-maxSpeed, Math.min(maxSpeed, deltaX * multiplier));
    targetRotationSpeedRef.current = adjustedSpeed;
  };

  const resetTouchRotation = () => {
    interactionStateRef.current = {
      active: false,
      pointerType: null,
      lastX: null,
    };
    targetRotationSpeedRef.current = 0.004;
  };

  const trailSourceData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "LineString" as const,
            coordinates: trailCoords.map((coord) => [coord[1], coord[0]]),
          },
          properties: {},
        },
      ],
    }),
    [trailCoords],
  );

  const markerSourceData = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: [
        {
          type: "Feature" as const,
          geometry: {
            type: "Point" as const,
            coordinates: [safeMarkerData.longitude, safeMarkerData.latitude],
          },
          properties: {
            speed: safeMarkerData.speed,
          },
        },
      ],
    }),
    [safeMarkerData.latitude, safeMarkerData.longitude, safeMarkerData.speed],
  );

  const trailLayerPaint = useMemo(
    () => ({
      "line-color": "#501D83",
      "line-width": 3,
      "line-opacity": safeMarkerData.speed < 5 ? 0.3 : 0.7,
    }),
    [safeMarkerData.speed],
  );

  const stationaryPointsGeoJSON = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: stationaryPoints.map(([lat, lon, speed]) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [lon, lat],
        },
        properties: { speed },
      })),
    }),
    [stationaryPoints],
  );

  const stationaryPointsLayerPaint = useMemo(
    () => ({
      "circle-radius": 5,
      "circle-color": "#10b981",
      "circle-stroke-width": 1,
      "circle-stroke-color": "#047857",
      "circle-opacity": 0.6,
    }),
    [],
  );

  const markerLayerLayout = useMemo(
    () => ({
      "icon-image": [
        "case",
        ["<", ["get", "speed"], 5],
        "vehicle-marker-green",
        ["<", ["get", "speed"], 25],
        "vehicle-marker-orange",
        "vehicle-marker-red",
      ] as unknown as string,
      "icon-size": 0.58,
      "icon-anchor": "center" as const,
      "icon-offset": [0, 0] as [number, number],
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-pitch-alignment": "viewport" as const,
      "icon-rotation-alignment": "viewport" as const,
    }),
    [],
  );

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        touchAction: "pan-y",
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={resetTouchRotation}
      onPointerCancel={resetTouchRotation}
      onPointerLeave={resetTouchRotation}
    >
      <Map
        ref={mapRef}
        onLoad={() => setMapLoaded(true)}
        initialViewState={{
          latitude: DEFAULT_POSITION.latitude,
          longitude: DEFAULT_POSITION.longitude,
          zoom: 16,
          pitch: 62,
          bearing: 0,
        }}
        style={{ width: "100%", height: "100%" }}
        mapStyle={{
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
        }}
        dragPan={false}
        dragRotate={false}
        doubleClickZoom={false}
        keyboard={false}
        scrollZoom={false}
        touchZoomRotate={false}
      >
        {trailCoords.length > 0 && (
          <Source id="trail" type="geojson" data={trailSourceData}>
            <Layer id="trail-line" type="line" paint={trailLayerPaint} />
          </Source>
        )}

        {safeMarkerData.latitude && safeMarkerData.longitude && (
          <Source id="vehicle-marker" type="geojson" data={markerSourceData}>
            <Layer id="vehicle-marker-symbol" type="symbol" layout={markerLayerLayout} />
          </Source>
        )}

        {stationaryPoints.length > 0 && (
          <Source id="stationary" type="geojson" data={stationaryPointsGeoJSON}>
            <Layer id="stationary-circles" type="circle" paint={stationaryPointsLayerPaint} />
          </Source>
        )}
      </Map>
    </div>
  );
}
