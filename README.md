# MicroTransit Frontend

Next.js frontend for the MicroTransit live shuttle tracker. It shows the Florida Poly route map, live vehicle position, connection state, recent GPS history, and schedule data from the FastAPI backend.

## Architecture

1. The Arduino and SIM7000 tracker send GPS updates to the backend.
2. The backend stores each point and broadcasts live updates over WebSocket.
3. The frontend loads recent history from `GET /api/locations/{device_id}`.
4. The frontend subscribes to `WS /ws/{device_id}` for live marker updates.
5. The frontend reads route status from `/api/schedule/{device_id}/today` and `/api/schedule/{device_id}/upcoming`.

## Key Files

- `app/page.tsx`: landing page.
- `app/map/page.tsx`: live tracking dashboard.
- `components/MapView.tsx`: MapLibre map, live marker, trail, and WebSocket integration.
- `components/SchedulePanel.tsx`: current and upcoming route schedule view.
- `components/DeviceStatusPanel.tsx`: live telemetry details.
- `lib/api.ts`: REST API client with basic public-config validation.
- `lib/websocket.ts`: WebSocket client with safe URL handling.
- `lib/devices.ts`: device list parsing from public environment variables.

## Environment Setup

Copy `.env.example` to `.env.local` and set the backend URLs:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_DEVICE_ID=TEAM_GPS_01
# NEXT_PUBLIC_DEVICE_IDS=TEAM_GPS_01,TEAM_GPS_02
NEXT_PUBLIC_USE_MOCK_DATA=false
```

For production, use the deployed backend URLs:

```bash
NEXT_PUBLIC_API_URL=https://microtransit-api-production.up.railway.app
NEXT_PUBLIC_WS_URL=wss://microtransit-api-production.up.railway.app
```

## Local Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, then choose `Open Live Tracker`.

## Deployment Notes

Set the public backend URL, WebSocket URL, and device ID in Vercel. Keep API keys on the backend and Arduino side only; any `NEXT_PUBLIC_*` value is visible in the browser.

The frontend ships with baseline browser hardening headers:

- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` disabling unused sensors

Build with:

```bash
npm run build
```

## Integration Checklist

- Backend health check returns OK.
- Frontend `NEXT_PUBLIC_API_URL` points to the backend HTTP origin.
- Frontend `NEXT_PUBLIC_WS_URL` points to the backend WebSocket origin.
- Backend `CORS_ORIGINS` includes the Vercel frontend URL.
- Arduino `DEVICE_ID` matches the backend device ID.
- Arduino `API_KEY` matches the backend `VALID_API_KEYS_JSON` value for that device.
- Railway TCP proxy host and port in the Arduino sketch match the active backend ingress.
