# MicroTransit Frontend

Next.js frontend for the MicroTransit live shuttle tracker. It shows the route map, live vehicle position, connection state, and recent GPS history from the FastAPI backend.

## Architecture

1. The Arduino and SIM7000 tracker send GPS updates to the backend.
2. The backend stores each point and broadcasts live updates over WebSocket.
3. The frontend loads recent history from `GET /api/locations/{device_id}`.
4. The frontend subscribes to `WS /ws/{device_id}` for live marker updates.
5. The browser dashboard does not poll the retired `/api/schedule/{device_id}/today` or `/api/schedule/{device_id}/upcoming` endpoints.

## Key Files

- `app/page.tsx`: landing page.
- `app/map/page.tsx`: live tracking dashboard and vehicle selection.
- `components/MapView.tsx`: MapLibre map, live marker, trail, and WebSocket integration.
- `components/DeviceStatusPanel.tsx`: live telemetry details.
- `lib/api.ts`: recent-location REST client.
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

## Fork / handoff configuration and external ownership

The browser dashboard currently requires only public client-side configuration: the backend HTTP/WebSocket origins, device IDs, and the mock-data toggle. It does **not** require a private API key in the browser. Citrus Connection can fork the repository and replace those public environment values with the URLs/device IDs for its deployment.

Every `NEXT_PUBLIC_*` value is visible to browser users. Do not place tracker write keys, database credentials, Railway tokens, service-account JSON, or any other private credential in a `NEXT_PUBLIC_*` variable or in this repository.

External ownership for continued browser deployment is the hosting project/account (currently Vercel), its domain/DNS if applicable, and the configured public backend origins. A fork preserves Git history, so any credential that ever appeared in history must be rotated/revoked before that history is shared outside the trusted team.

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
