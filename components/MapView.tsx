"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Map from 'react-map-gl/maplibre';
import { Source, Layer } from 'react-map-gl/maplibre';
import type { MapRef } from 'react-map-gl/maplibre';
import type { GeoJSONSource } from 'maplibre-gl';
import "maplibre-gl/dist/maplibre-gl.css";

import { fetchDeviceHistory } from "@/lib/api";
import { openDeviceSocket } from "@/lib/websocket";
import type { LocationUpdateMessage } from "@/lib/websocket";

type MapViewProps = {
  deviceId: string;
  onConnectionChange?: (connected: boolean) => void;
  onLocationUpdate?: (data: LocationUpdateMessage) => void;
};

function getMarkerColor(speed: number): string {
  if (speed < 5) return '#10b981'; // Green - stopped
  if (speed < 25) return '#f97316'; // Orange - moving
  return '#dc2626'; // Red - fast
}

export default function MapView({ deviceId, onConnectionChange, onLocationUpdate }: MapViewProps) {
  const mapRef = useRef<MapRef>(null);
  const [connected, setConnected] = useState(false);
  const [markerData, setMarkerData] = useState<{
    latitude: number;
    longitude: number;
    speed: number;
  }>({
    latitude: 28.1517,
    longitude: -81.8598,
    speed: 0,
  });
  const [trailCoords, setTrailCoords] = useState<[number, number][]>([]);
  const [stationaryPoints, setStationaryPoints] = useState<[number, number, number][]>([]); // [lat, lon, speed]
  const [isAnimating, setIsAnimating] = useState(false);
  const pointsRef = useRef<[number, number][]>([]);
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentPosRef = useRef({ latitude: 28.1517, longitude: -81.8598, speed: 0 });
  const lastTrailPointTimeRef = useRef(0); // Track when trail points are actually added

  // Ensure marker data is never NaN
  const safeMarkerData = {
    latitude: isFinite(markerData.latitude) ? markerData.latitude : 28.1517,
    longitude: isFinite(markerData.longitude) ? markerData.longitude : -81.8598,
    speed: isFinite(markerData.speed) ? markerData.speed : 0,
  };

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;

    const setConnection = (value: boolean) => {
      setConnected(value);
      onConnectionChange?.(value);
    };

    const addPoint = (latlng: [number, number], message?: LocationUpdateMessage) => {
      if (disposed) return;

      console.log('[MapView] addPoint called with latlng:', latlng, 'message:', message);

      // Validate coordinates before processing
      if (!isFinite(latlng[0]) || !isFinite(latlng[1])) {
        console.error('[MapView] INVALID COORDINATES:', latlng, 'lat isFinite:', isFinite(latlng[0]), 'lng isFinite:', isFinite(latlng[1]));
        return;
      }

      const speed = message?.speed || 0;

      // Add all points to trail (including stationary points)
      console.log('[CHECK] Coordinates valid');
      console.log('  pointsRef.current before:', pointsRef.current);
      pointsRef.current.push(latlng);
      lastTrailPointTimeRef.current = Date.now(); // Track when we actually add to trail
      console.log('  pointsRef.current after:', pointsRef.current);

      console.log('Update vehicle position:', latlng, 'speed:', speed, 'trail length:', pointsRef.current.length);

      // Update trail immediately
      const newTrail = [...pointsRef.current];
      console.log('Setting trail:', newTrail);
      setTrailCoords(newTrail);

      // Clear any pending animation
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      const startLat = currentPosRef.current.latitude;
      const startLng = currentPosRef.current.longitude;
      const endLat = latlng[0];
      const endLng = latlng[1];
      
      console.log('Animation start:', { startLat, startLng }, '-> end:', { endLat, endLng });

      const startTime = Date.now();
      const duration = 2000; // 2 seconds

      // Mark animation as started
      setIsAnimating(true);

      // Animate marker - update MapLibre source directly, NOT React state, to avoid flicker
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-in-out cubic
        const easeProgress =
          progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        const currentLat = startLat + (endLat - startLat) * easeProgress;
        const currentLng = startLng + (endLng - startLng) * easeProgress;

        console.log(`Animation frame ${(progress * 100).toFixed(0)}%: pos=[${currentLat.toFixed(4)}, ${currentLng.toFixed(4)}]`);

        // Update ref position
        currentPosRef.current = { latitude: currentLat, longitude: currentLng, speed };

        // Update MapLibre source directly - bypasses React renders, 60fps smooth animation
        const markerSource = mapRef.current?.getSource('marker') as GeoJSONSource | undefined;
        if (markerSource) {
          // Update position AND speed property so paint expressions can use it
          markerSource.setData({
            type: 'FeatureCollection' as const,
            features: [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'Point' as const,
                  coordinates: [currentLng, currentLat],
                },
                properties: { speed }, // Pass speed for color expression
              },
            ],
          });
        }

        if (progress < 1) {
          animationTimeoutRef.current = setTimeout(animate, 16);
        } else {
          // Animation complete: update React state for sidebar/UI and show popup
          console.log('Animation complete, setting markerData to:', { endLat, endLng, speed });
          setMarkerData({
            latitude: endLat,
            longitude: endLng,
            speed,
          });
          console.log('safeMarkerData will be:', {
            latitude: isFinite(endLat) ? endLat : 28.1517,
            longitude: isFinite(endLng) ? endLng : -81.8598,
            speed: isFinite(speed) ? speed : 0,
          });
          setIsAnimating(false);
        }
      };

      animate();

      // Pan map to marker with animation
      if (mapRef.current) {
        mapRef.current.flyTo({
          center: [latlng[1], latlng[0]],
          duration: 1500,
        });
      }

      if (message) {
        onLocationUpdate?.(message);
      }
    };

    const loadHistory = async () => {
      try {
        console.log('Fetching device history from backend');
        // Set useMock=true to seed mock data in TESTING mode (backend controls mock data now)
        const useMockMode = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
        console.log('useMockMode:', useMockMode);
        const historyResponse = await fetchDeviceHistory(deviceId, 100, useMockMode);
        console.log('History response:', historyResponse);
        const coords = historyResponse.locations
          .map((p) => [p.latitude, p.longitude] as [number, number])
          .reverse();

        console.log('Loaded', coords.length, 'coordinates, initial:', coords[coords.length - 1]);

        // Start at the most recent historical point, but DON'T show the full trail yet
        // Trail will build incrementally as live updates arrive
        if (coords.length > 0) {
          const initialCoord = coords[coords.length - 1];
          pointsRef.current = [initialCoord]; // Start with just the current position
          setTrailCoords([initialCoord]); // Trail has only the initial point
          currentPosRef.current = {
            latitude: initialCoord[0],
            longitude: initialCoord[1],
            speed: 0,
          };
          setMarkerData({
            latitude: initialCoord[0],
            longitude: initialCoord[1],
            speed: 0,
          });
          console.log('Marker positioned at:', initialCoord);
        } else {
          console.warn('No coordinates loaded from history');
        }

        socket = openDeviceSocket(
          deviceId,
          (message) => {
            if (disposed) return;
            const latlng: [number, number] = [message.latitude, message.longitude];
            addPoint(latlng, message);
          },
          (value) => {
            if (disposed) return;
            setConnection(value);
          }
        );
      } catch (err) {
        // Fall back to mock data from backend (if in TESTING mode)
        console.log('Primary history load failed:', err, 'retrying with mock mode');
        try {
          const historyResponse = await fetchDeviceHistory(deviceId, 100, true);
          console.log('Fallback history response:', historyResponse);
          const coords = historyResponse.locations
            .map((p) => [p.latitude, p.longitude] as [number, number])
            .reverse(); // Also reverse in fallback

          console.log('Fallback: loaded', coords.length, 'coordinates');

          // Display starting position from history
          if (coords.length > 0) {
            const initialCoord = coords[coords.length - 1];
            pointsRef.current = [initialCoord]; // Start with just one point, trail builds with live updates
            setTrailCoords([initialCoord]);
            currentPosRef.current = {
              latitude: initialCoord[0],
              longitude: initialCoord[1],
              speed: 0,
            };
            setMarkerData({
              latitude: initialCoord[0],
              longitude: initialCoord[1],
              speed: 0,
            });
            console.log('Fallback: marker positioned at:', initialCoord);
          } else {
            console.warn('Fallback: no coordinates loaded');
          }
          
          // IMPORTANT: Connect to WebSocket in fallback too!
          socket = openDeviceSocket(
            deviceId,
            (message) => {
              if (disposed) return;
              const latlng: [number, number] = [message.latitude, message.longitude];
              console.log('Fallback: received WebSocket message:', latlng);
              addPoint(latlng, message);
            },
            (value) => {
              if (disposed) return;
              console.log('Fallback: connection status:', value);
              setConnection(value);
            }
          );
        } catch (fallbackErr) {
          console.error('Unable to load device history - backend mock mode may not be enabled:', fallbackErr);
          setConnection(false);
        }
      }
    };

    loadHistory();

    return () => {
      disposed = true;
      socket?.close();
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [deviceId, onConnectionChange, onLocationUpdate]);

  // Trail GeoJSON - ONLY shows waypoints the bus has actually visited
  const trailGeoJSON = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        // Only include trail points - accumulated as bus travels, never showing future planned route
        coordinates: trailCoords.map((coord) => [coord[1], coord[0]]), // [lng, lat]
      },
      properties: {},
    }),
    [trailCoords],
  );

  // Marker GeoJSON
  const markerGeoJSON = useMemo(
    () => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [safeMarkerData.longitude, safeMarkerData.latitude],
      },
      properties: {
        speed: safeMarkerData.speed,
      },
    }),
    [safeMarkerData.latitude, safeMarkerData.longitude, safeMarkerData.speed],
  );

  // Memoize marker data source
  const markerSourceData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [markerGeoJSON],
    }),
    [markerGeoJSON],
  );

  // Memoize trail data source
  const trailSourceData = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: [trailGeoJSON],
    }),
    [trailGeoJSON],
  );

  // Memoize paint objects
  const trailLayerPaint = useMemo(
    () => ({
      'line-color': '#501D83',
      'line-width': 3,
      'line-opacity': safeMarkerData.speed < 5 ? 0.3 : 0.7, // Fade when stationary
    }),
    [safeMarkerData.speed],
  );

  const markerLayerPaint = useMemo(
    () => ({
      'circle-radius': 8,
      'circle-color': [
        'case',
        // If speed < 5: green (stopped)
        ['<', ['get', 'speed'], 5],
        '#10b981',
        // If speed < 25: orange (moving)
        ['<', ['get', 'speed'], 25],
        '#f97316',
        // Otherwise: red (fast)
        '#dc2626',
      ] as any,
      'circle-stroke-width': 2,
      'circle-stroke-color': '#ffffff',
      'circle-opacity': 0.85,
    }),
    [],
  );

  // Stationary points GeoJSON
  const stationaryPointsGeoJSON = useMemo(
    () => ({
      type: 'FeatureCollection' as const,
      features: stationaryPoints.map(([lat, lon, speed]) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [lon, lat],
        },
        properties: { speed },
      })),
    }),
    [stationaryPoints],
  );

  const stationaryPointsLayerPaint = useMemo(
    () => ({
      'circle-radius': 5,
      'circle-color': '#10b981',
      'circle-stroke-width': 1,
      'circle-stroke-color': '#047857',
      'circle-opacity': 0.6,
    }),
    [],
  );

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Map
        ref={mapRef}
        initialViewState={{
          latitude: 28.1517,
          longitude: -81.8598,
          zoom: 15,
        }}
        style={{ width: '100%', height: '100vh' }}
        mapStyle={{
          version: 8,
          sources: {
            osm: {
              type: 'raster',
              tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
              tileSize: 256,
              attribution: '© OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'osm',
              type: 'raster',
              source: 'osm',
            },
          ],
        }}
        doubleClickZoom={false}
      >
        {/* Trail layer - show as soon as we have starting point */}
        {trailCoords.length > 0 && (
          <Source id="trail" type="geojson" data={trailSourceData}>
            <Layer
              id="trail-line"
              type="line"
              paint={trailLayerPaint}
            />
          </Source>
        )}

        {/* Marker layer */}
        <Source
          id="marker"
          type="geojson"
          data={markerSourceData}
        >
          <Layer
            id="marker-circle"
            type="circle"
            paint={markerLayerPaint}
          />
        </Source>

        {/* Stationary points layer - shows where bus stopped */}
        {stationaryPoints.length > 0 && (
          <Source
            id="stationary"
            type="geojson"
            data={stationaryPointsGeoJSON}
          >
            <Layer
              id="stationary-circles"
              type="circle"
              paint={stationaryPointsLayerPaint}
            />
          </Source>
        )}
      </Map>

      {/* Status badges container - moved to bottom-right */}
      <div
        style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        {/* Speed indicator */}
        <div
          style={{
            backgroundColor: 'white',
            border: `3px solid ${getMarkerColor(safeMarkerData.speed)}`,
            color: getMarkerColor(safeMarkerData.speed),
            padding: '10px 16px',
            borderRadius: '12px',
            fontWeight: 'bold',
            fontSize: '16px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            minWidth: '120px',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {safeMarkerData.speed.toFixed(1)} km/h
        </div>

        {/* Connection status */}
        <div
          style={{
            backgroundColor: connected ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${connected ? '#10b981' : '#ef4444'}`,
            color: connected ? '#059669' : '#dc2626',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 'bold',
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
            textAlign: 'center',
            transition: 'all 0.2s ease',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            letterSpacing: '0.3px',
          }}
        >
          {connected ? ' Connected' : ' Disconnected'}
        </div>
      </div>
    </div>
  );
}
