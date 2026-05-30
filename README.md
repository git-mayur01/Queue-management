# Local Restaurant Order Management MVP

Offline-first order management for small Chinese food stalls, fast food shops, cafés, and takeaway counters. The app runs on a laptop over local WiFi and can be opened from a cashier phone, a kitchen laptop, and a TV token display.

## Features

- Cashier order entry with dine-in/parcel separation.
- Auto-generated daily token numbers starting at `101`.
- Kitchen dashboard with FCFS active order cards.
- Status flow: `PENDING` → `COOKING` → `READY` → `DELIVERED`.
- Socket.IO realtime updates across all screens.
- Pending item aggregation so chefs can batch-cook repeated dishes.
- Ready-token display at `/display` for a TV or customer-facing monitor.
- SQLite database created automatically on first startup.
- Local editable menu at `backend/data/menu.json`.

## Folder Structure

```text
.
├── backend
│   ├── data
│   │   └── menu.json
│   ├── src
│   │   ├── database
│   │   │   ├── db.js
│   │   │   └── schema.js
│   │   ├── routes
│   │   │   ├── menuRoutes.js
│   │   │   └── orderRoutes.js
│   │   ├── services
│   │   │   ├── menuService.js
│   │   │   └── orderService.js
│   │   ├── socket
│   │   │   └── socket.js
│   │   ├── utils
│   │   │   └── validation.js
│   │   ├── app.js
│   │   ├── config.js
│   │   └── server.js
│   └── tests
├── frontend
│   └── src
│       ├── components
│       ├── pages
│       └── services
├── package.json
└── README.md
```

## Installation

```bash
npm install
```

The root package uses npm workspaces, so this installs backend and frontend dependencies together.

## Run in Development

```bash
npm run dev
```

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000>

## Local Network Setup

1. Connect the laptop, cashier phone, and optional display TV to the same WiFi or hotspot.
2. Start the app on the laptop with `npm run dev`.
3. Read the local network IP printed by the backend, for example `192.168.1.25`.
4. Open these URLs:
   - Cashier phone: `http://LAPTOP-IP:3000/cashier`
   - Kitchen laptop: `http://LAPTOP-IP:3000/kitchen`
   - TV/customer display: `http://LAPTOP-IP:3000/display`
5. Keep the laptop awake while the restaurant is operating.

No cloud service, account, internet connection, Firebase, Supabase, MongoDB, PostgreSQL, or authentication is required.

## API Endpoints

- `POST /api/orders`
- `GET /api/orders`
- `GET /api/orders/active`
- `PATCH /api/orders/:id/status`
- `GET /api/stats`
- `GET /api/aggregation`
- `GET /api/menu`

## Step-by-Step Testing

1. Run `npm install`.
2. Run `npm run dev`.
3. Open `http://localhost:3000/cashier`.
4. Select `Dine In`, enter table `4`, add `Veg Momos` twice and `Veg Cocktail` once, then generate the order.
5. Confirm the cashier screen shows a generated token such as `Token #101`.
6. Open `http://localhost:3000/kitchen` in another browser window.
7. Confirm the order appears instantly with token, table, type, time, items, and status buttons.
8. Create another order with the same item and verify the pending item aggregation count increases.
9. Mark token `#101` as `Cooking`, then `Ready`; confirm the cashier and `/display` screens update instantly.
10. Mark it `Delivered`; confirm it disappears from active kitchen work and aggregation counts.

## Production/Single-Laptop Run

For a simple production-style run:

```bash
npm run build
npm run start
```

After `npm run build`, the backend serves the compiled frontend and API from the backend port. Open `http://LAPTOP-IP:4000` for cashier, kitchen, or display routes. For day-to-day MVP development, use `npm run dev` so Vite serves the frontend on port `3000`.
