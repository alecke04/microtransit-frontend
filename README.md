# MicroTransit Frontend

Next.js frontend for the MicroTransit live shuttle tracker. It displays the Florida Poly route map, the live vehicle marker, connection status, recent GPS history, and schedule information from the FastAPI backend.

## System Architecture

1. The Arduino/SIM7000 tracker sends GPS updates to the backend.
2. The backend stores each point and broadcasts live updates over WebSocket.
3. This frontend loads recent history from `GET /api/locations/{device_id}`.
4. It subscribes to `WS /ws/{device_id}` for live marker updates.
5. It reads route status from `/api/schedule/{device_id}/today` and `/api/schedule/{device_id}/upcoming`.

## Repository Contents

- `app/page.tsx`: home screen.
- `app/map/page.tsx`: live tracking dashboard.
- `components/MapView.tsx`: MapLibre map, live marker, trail, and WebSocket integration.
- `components/SchedulePanel.tsx`: current/upcoming route schedule view.
- `components/DeviceStatusPanel.tsx`: live telemetry details.
- `lib/api.ts`: REST API client.
- `lib/websocket.ts`: WebSocket client.
- `public/`: Florida Poly images, logos, and map marker assets.

## File Tree

```text
microtransit-frontend/
├── app/
│   ├── map/
│   │   └── page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ConnectionBadge.tsx
│   ├── DeviceStatusPanel.tsx
│   ├── Header.tsx
│   ├── MapView.tsx
│   └── SchedulePanel.tsx
├── lib/
│   ├── api.ts
│   ├── fake_data.ts
│   └── websocket.ts
├── public/
│   ├── leaflet/
│   ├── markers/
│   └── floridaPoly.jpg
├── styles/
│   └── globals.css
├── .env.example
├── next.config.js
├── package.json
├── package-lock.json
├── tailwind.config.js
├── tsconfig.json
├── vercel.json
└── README.md
```

## Environment Setup

Copy `.env.example` to `.env.local` and set the backend URLs:

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
NEXT_PUBLIC_DEVICE_ID=TEAM_GPS_01
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

Open `http://localhost:3000`, then choose **Open Live Tracker**.

## Vercel Deployment

Set the public backend URL, WebSocket URL, and device ID in Vercel. Keep device API keys on the backend/Arduino side only; any `NEXT_PUBLIC_*` value is visible in the browser. The frontend is configured through `vercel.json` and builds with:

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
- Railway TCP Proxy host/port in the Arduino sketch match the active backend TCP ingress.
