"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Map from "react-map-gl/maplibre";
import { Layer, Marker, Source } from "react-map-gl/maplibre";
import type { MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import { fetchDeviceHistory } from "@/lib/api";
import { openDeviceSocket } from "@/lib/websocket";
import type { LocationUpdateMessage } from "@/lib/websocket";

type MapViewProps = {
  deviceId: string;
  onConnectionChange?: (connected: boolean) => void;
  onLocationUpdate?: (data: LocationUpdateMessage | null) => void;
};

const DEFAULT_POSITION = {
  latitude: 28.148,
  longitude: -81.8484,
  speed: 0,
};
const GPS_STALE_MS = 30_000;
const STATIONARY_HOLD_METERS = 18;

const MARKER_IMAGES = {
  "vehicle-marker-green": "#10b981",
  "vehicle-marker-orange": "#f97316",
  "vehicle-marker-red": "#dc2626",
} as const;

type MarkerImageId = keyof typeof MARKER_IMAGES;

type TrailOverlayProps = {
  data: {
    type: "FeatureCollection";
    features: Array<{
      type: "Feature";
      geometry: {
        type: "LineString";
        coordinates: number[][];
      };
      properties: Record<string, never>;
    }>;
  };
  paint: {
    "line-color": string;
    "line-width": number;
    "line-opacity": number;
  };
  layout: {
    "line-cap": "round";
    "line-join": "round";
  };
};

const TrailOverlay = memo(function TrailOverlay({ data, paint, layout }: TrailOverlayProps) {
  return (
    <Source id="trail" type="geojson" data={data}>
      <Layer id="trail-line" type="line" paint={paint} layout={layout} />
    </Source>
  );
});

function getMarkerColor(speed: number): string {
  if (speed < 5) return "#10b981";
  if (speed < 25) return "#f97316";
  return "#dc2626";
}

function createMarkerImage(id: MarkerImageId): Promise<HTMLImageElement> {
  const fill = MARKER_IMAGES[id];
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

  return new Promise((resolve, reject) => {
    const image = new Image(88, 88);
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function getLocationTimeMs(point: { timestamp?: number; created_at?: string }): number | null {
  if (Number.isFinite(point.timestamp)) {
    return point.timestamp! > 1_000_000_000_000 ? point.timestamp! : point.timestamp! * 1000;
  }

  if (point.created_at) {
    const parsed = Date.parse(point.created_at);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function distanceMeters(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const lat1 = toRad(a[0]);
  const lat2 = toRad(b[0]);
  const hav =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
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
  const staleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPosRef = useRef(DEFAULT_POSITION);
  const bearingRef = useRef(0);
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
  const [markerImagesReady, setMarkerImagesReady] = useState(false);

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

    const resetToDefaultMarker = () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      pointsRef.current = [];
      currentPosRef.current = DEFAULT_POSITION;
      setTrailCoords([]);
      setStationaryPoints([]);
      setMarkerData(DEFAULT_POSITION);
      onLocationUpdate?.(null);

      if (mapRef.current) {
        mapRef.current.jumpTo({
          center: [DEFAULT_POSITION.longitude, DEFAULT_POSITION.latitude],
        });
      }
    };

    const restartStaleTimer = () => {
      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
      }

      staleTimeoutRef.current = setTimeout(() => {
        staleTimeoutRef.current = null;
        resetToDefaultMarker();
      }, GPS_STALE_MS);
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

      if (mapRef.current) {
        mapRef.current.easeTo({
          center: [endLng, endLat],
          duration: durationMs,
          easing: (t) =>
            t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
        });
      }

      animationFrameRef.current = requestAnimationFrame(step);
    };

    const setMarkerPosition = (latlng: [number, number], speed: number) => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      currentPosRef.current = {
        latitude: latlng[0],
        longitude: latlng[1],
        speed,
      };
      setMarkerData(currentPosRef.current);

      if (mapRef.current) {
        mapRef.current.jumpTo({
          center: [latlng[1], latlng[0]],
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
      const currentLatLng: [number, number] = [
        currentPosRef.current.latitude,
        currentPosRef.current.longitude,
      ];
      const distanceFromMarker = distanceMeters(currentLatLng, latlng);
      const isStopped = speed < 5;

      if (isStopped && distanceFromMarker < STATIONARY_HOLD_METERS) {
        currentPosRef.current = {
          ...currentPosRef.current,
          speed,
        };
        setMarkerData(currentPosRef.current);

        if (message) {
          onLocationUpdate?.(message);
          restartStaleTimer();
        }

        return;
      }

      updateTrail(latlng, speed);
      if (isStopped) {
        setMarkerPosition(latlng, speed);
      } else {
        animateMarker(latlng, speed);
      }

      if (message) {
        onLocationUpdate?.(message);
        restartStaleTimer();
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

    const seedInitialPosition = (coords: [number, number][]) => {
      const latest = coords[coords.length - 1] ?? [DEFAULT_POSITION.latitude, DEFAULT_POSITION.longitude];

      pointsRef.current = coords;
      currentPosRef.current = {
        latitude: latest[0],
        longitude: latest[1],
        speed: 0,
      };
      setTrailCoords(coords);
      setMarkerData(currentPosRef.current);

      if (mapRef.current) {
        mapRef.current.jumpTo({
          center: [latest[1], latest[0]],
        });
      }

      if (coords.length > 0) {
        restartStaleTimer();
      }
    };

    const loadHistory = async () => {
      try {
        const useMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
        const historyResponse = await fetchDeviceHistory(deviceId, 100, useMockMode);
        const now = Date.now();
        const coords = historyResponse.locations
          .filter((p) => {
            const pointTime = getLocationTimeMs(p);
            return (
              pointTime !== null &&
              now - pointTime <= GPS_STALE_MS &&
              Number.isFinite(p.latitude) &&
              Number.isFinite(p.longitude)
            );
          })
          .map((p) => [p.latitude, p.longitude] as [number, number])
          .reverse();

        if (coords.length > 0) {
          seedInitialPosition(coords);
        } else {
          resetToDefaultMarker();
        }
      } catch (primaryError) {
        console.warn("[MapView] Primary history load failed, retrying with mock mode", primaryError);

        try {
          const historyResponse = await fetchDeviceHistory(deviceId, 100, true);
          const now = Date.now();
          const coords = historyResponse.locations
            .filter((p) => {
              const pointTime = getLocationTimeMs(p);
              return (
                pointTime !== null &&
                now - pointTime <= GPS_STALE_MS &&
                Number.isFinite(p.latitude) &&
                Number.isFinite(p.longitude)
              );
            })
            .map((p) => [p.latitude, p.longitude] as [number, number])
            .reverse();

          if (coords.length > 0) {
            seedInitialPosition(coords);
          } else {
            resetToDefaultMarker();
          }
        } catch (fallbackError) {
          console.error("[MapView] Unable to load history, using default marker position", fallbackError);
          resetToDefaultMarker();
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

      if (staleTimeoutRef.current) {
        clearTimeout(staleTimeoutRef.current);
      }

      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      socket?.close();
    };
  }, [deviceId, onConnectionChange, onLocationUpdate]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const map = mapRef.current.getMap();

    const registerMarkerImage = async (id: MarkerImageId) => {
      if (map.hasImage(id)) return;

      const image = await createMarkerImage(id);
      if (!map.hasImage(id)) {
        map.addImage(id, image, { pixelRatio: 2 });
      }
    };

    const handleStyleImageMissing = (event: { id: string }) => {
      if (!(event.id in MARKER_IMAGES)) return;
      void registerMarkerImage(event.id as MarkerImageId);
    };

    map.on("styleimagemissing", handleStyleImageMissing);

    Promise.all((Object.keys(MARKER_IMAGES) as MarkerImageId[]).map(registerMarkerImage))
      .then(() => setMarkerImagesReady(true))
      .catch((error) => {
        console.error("[MapView] Unable to register marker images", error);
        setMarkerImagesReady(false);
      });

    return () => {
      map.off("styleimagemissing", handleStyleImageMissing);
    };
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
    const degreesPerPixel = event.pointerType === "mouse" ? 0.18 : 0.12;
    bearingRef.current = (bearingRef.current + deltaX * degreesPerPixel) % 360;
    mapRef.current?.setBearing(bearingRef.current);
  };

  const resetManualRotation = () => {
    interactionStateRef.current = {
      active: false,
      pointerType: null,
      lastX: null,
    };
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
      "line-width": 4,
      "line-opacity": 0.76,
    }),
    [],
  );

  const trailLayerLayout = useMemo(
    () => ({
      "line-cap": "round" as const,
      "line-join": "round" as const,
    }),
    [],
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
      onPointerUp={resetManualRotation}
      onPointerCancel={resetManualRotation}
      onPointerLeave={resetManualRotation}
    >
      <Map
        ref={mapRef}
        onLoad={() => setMapLoaded(true)}
        initialViewState={{
          latitude: DEFAULT_POSITION.latitude,
          longitude: DEFAULT_POSITION.longitude,
          zoom: 15.85,
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
        <TrailOverlay data={trailSourceData} paint={trailLayerPaint} layout={trailLayerLayout} />

        {safeMarkerData.latitude && safeMarkerData.longitude && (
          <Marker
            latitude={safeMarkerData.latitude}
            longitude={safeMarkerData.longitude}
            anchor="center"
          >
            <div
              style={{
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: getMarkerColor(safeMarkerData.speed),
                border: "2px solid #ffffff",
                boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
                transform: "translateZ(0)",
              }}
            />
          </Marker>
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
