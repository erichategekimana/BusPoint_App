# BusPoint

## Demo Video

> **[Watch the demo on YouTube →](https://youtu.be/geH0imZkORc)**
>
> A 8-minute walkthrough covering live bus tracking, passenger booking with MTN MoMo payment, QR ticket scanning, and the admin fleet dashboard.

## Project Board

> **[View on Trello →](https://trello.com/b/wQsHjTRV/bus-point-app)**
>
> Task tracking, sprint planning, and feature backlog for BusPoint.

---

![Python](https://img.shields.io/badge/Python-3.11-blue?logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-3.1-black?logo=flask&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![PostGIS](https://img.shields.io/badge/PostGIS-enabled-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**BusPoint** is a full-stack web application for live bus tracking and seat booking across Rwanda. Passengers search routes, book seats, and watch their bus move in real time on an interactive map. Drivers manage trips and scan QR-coded tickets. Admins oversee the entire fleet, routes, stops, and bookings from a dedicated dashboard.

---

## Team

| Name | Role | Contributions |
|---|---|---|
| Lisa Ineza | Project Manager & UI/UX Designer | Overall system architecture · GPS data pipeline design · Database schema (PostgreSQL) · Mobile money integration architecture |
| Boaz Iza | System Architect & Frontend Developer | React Native app development · Map integration (Mapbox) · QR code system · Push notification service |
| Gael Mparaye | Head Frontend Developer | Built Flask REST API · Operator partnership outreach · Revenue model design · Impact metrics & stakeholder analysis · Literature review |
| Hategekimana Eric | Head Backend Developer | Backend infrastructure · API development · Database management |
| Umutoni Kenia | Backend Developer | Backend development & support |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.11, Flask 3.1, Flask-SQLAlchemy, Flask-Migrate |
| Database | PostgreSQL 16, PostGIS (spatial indexing) |
| ORM | SQLAlchemy + GeoAlchemy2 |
| Routing API | OpenRouteService (real-road geometry for GPS simulation) |
| Maps (Frontend) | MapLibre GL JS + Stadia Maps tiles |
| Auth | JWT (PyJWT) — role-based: passenger / driver / admin |
| Background Jobs | APScheduler (departure reminders, GPS simulation ticks) |
| Payments | MTN Mobile Money (MoMo) API |
| Deployment | Render (web service) + Supabase or Render (PostgreSQL) |

---

## Features

- **Live bus tracking** — buses move along real road geometry, updated every 10 seconds via a simulated GPS scheduler
- **Route search** — passengers search trips by departure stop, destination stop, and date; past and completed trips are filtered out
- **Seat booking** — interactive seat grid, QR-coded ticket generated on payment
- **MTN MoMo payments** — integrated mobile money checkout (sandbox + production ready)
- **QR ticket scanning** — drivers scan passenger QR codes to verify boarding; restricted to their own trip
- **Driver dashboard** — view assigned trips, start / complete trips, scan tickets
- **Admin dashboard** — manage routes, stops, buses, trips, drivers; view live fleet map; broadcast notifications; overview stats
- **Bilingual UI** — full English and Kinyarwanda support with a one-click language toggle (persists across sessions)
- **Push notifications** — in-app notification centre + broadcast to all passengers

---

## System Architecture

```
Browser (HTML + JS)
    │
    ├── MapLibre GL  ←── Stadia Maps tiles
    ├── REST calls   ──► Flask API  (/api/*)
    │                         │
    │                    SQLAlchemy ORM
    │                         │
    │                   PostgreSQL + PostGIS
    │
    └── GPS polling (5 s)  ←── APScheduler tick (10 s)
                                    │
                              OpenRouteService API
                           (road geometry on trip start)
```

- The frontend is served as static files by Flask (`/` → `web/index.html`).
- The scheduler runs two background jobs: departure reminders every 5 minutes, and a GPS simulation tick every 10 seconds that interpolates each active bus along its cached ORS polyline.
- Bus positions are stored in `bus_locations` (one row per bus, upserted on each tick).

### Design Decisions

**Flask over Django** — Flask's lightweight blueprint system maps cleanly to a resource-based REST API. Django's ORM and admin panel would have added significant overhead for a project that already has a custom frontend and its own admin dashboard.

**APScheduler over Celery** — Celery requires a separate message broker (Redis or RabbitMQ) which adds infrastructure complexity and cost. APScheduler runs in-process alongside Flask, which is sufficient for two low-frequency background jobs (every 5–10 seconds) and keeps the deployment to a single service.

**Plain JavaScript over React** — The original prototype was built in React Native (targeting mobile). When the team pivoted to a web-first approach, plain JS was chosen deliberately: no build step, no npm dependency tree, instant iteration, and it runs on low-end devices common in Rwanda. The three-role architecture (passenger, driver, admin) is handled cleanly by separate JS modules loaded into one HTML file.

**GPS simulation over real hardware** — No physical GPS hardware was available during development. Rather than mock static positions, the team implemented a mathematically accurate simulator: real road geometry from OpenRouteService is cached on trip start, and a haversine + linear interpolation algorithm computes the exact bus position every 10 seconds based on elapsed time. This is architecturally identical to how a real GPS feed would work — only the data source changes.

**PostGIS over plain lat/lng columns** — PostgreSQL with the PostGIS extension was chosen to enable future spatial queries (nearest bus, geofencing, stop radius search). Regular numeric columns are used for current queries, with a deferred PostGIS `POINT` geometry column available for spatial indexing when needed.

---

## Prerequisites

- Python 3.11+
- PostgreSQL 14+ with PostGIS extension
- An [OpenRouteService](https://openrouteservice.org/) API key (free tier)
- A [Stadia Maps](https://stadiamaps.com/) API key (free tier, optional on localhost)
- An MTN MoMo sandbox account (optional for payment testing)

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/BusPoint_App.git
cd BusPoint_App
```

### 2. Create and activate a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Create the database

```bash
psql -U postgres -f database_setup.sql
```

This creates `buspoint_db`, enables `pgcrypto` and `postgis`, and builds all tables.

### 5. Create your `.env` file

Copy the example below into a file named `.env` in the project root and fill in your values.

### 6. Run database migrations

```bash
flask db upgrade
```

### 7. Start the development server

```bash
python run.py
```

The API runs on `http://127.0.0.1:5001`. Open `http://127.0.0.1:5001` in your browser — Flask serves the frontend automatically.

---

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
BP_POSTGRES_DATABASE_URI=postgresql://postgres:yourpassword@localhost:5432/buspoint_db

# Security
SECRET_KEY=
JWT_SECRET=

# OpenRouteService (real-road GPS geometry)
ORS_API_KEY=

# Stadia Maps (map tiles)
STADIA_API_KEY=

# MTN MoMo (payments)
MOMO_SUBSCRIPTION_KEY=
MOMO_API_USER=
MOMO_API_KEY=
MOMO_BASE_URL=https://sandbox.momodeveloper.mtn.com
MOMO_ENVIRONMENT=sandbox
MOMO_CURRENCY=EUR
```

> For production on Render, set `DATABASE_URL` instead of `BP_POSTGRES_DATABASE_URI` — the app accepts both.

---

## API Endpoints

All endpoints are prefixed with `/api`.

### Auth

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register a new user |
| POST | `/auth/login` | Login, returns JWT |
| PATCH | `/auth/update` | Update own profile |

### Routes & Stops

| Method | Endpoint | Description |
|---|---|---|
| GET | `/routes` | List all routes |
| POST | `/routes` | Create route *(admin)* |
| PATCH | `/routes/<id>` | Update route *(admin)* |
| DELETE | `/routes/<id>` | Delete route *(admin)* |
| GET | `/stops` | List all stops |
| POST | `/stops` | Create stop *(admin)* |
| PATCH | `/stops/<id>` | Update stop *(admin)* |
| DELETE | `/stops/<id>` | Delete stop *(admin)* |
| GET | `/route-stops` | List route-stop associations |
| POST | `/route-stops` | Add stop to route *(admin)* |
| DELETE | `/route-stops/<id>` | Remove stop from route *(admin)* |
| GET | `/routes/<id>/coordinates` | Ordered stop coordinates for a route |

### Trips

| Method | Endpoint | Description |
|---|---|---|
| GET | `/trips` | List trips (filterable by company, status) |
| POST | `/trips` | Create trip *(admin)* |
| PATCH | `/trips/<id>` | Update trip status / details |
| DELETE | `/trips/<id>` | Delete trip *(admin)* |
| GET | `/trips/<id>/geometry` | ORS road geometry + stops for map |

### Bookings

| Method | Endpoint | Description |
|---|---|---|
| GET | `/bookings` | List own bookings |
| POST | `/bookings` | Create booking |
| PATCH | `/bookings/<id>` | Cancel booking |
| POST | `/bookings/verify` | Verify QR ticket token *(driver)* |

### Buses & Locations

| Method | Endpoint | Description |
|---|---|---|
| GET | `/buses` | List buses |
| POST | `/buses` | Add bus *(admin)* |
| PATCH | `/buses/<id>` | Update bus |
| DELETE | `/buses/<id>` | Delete bus |
| GET | `/bus-locations` | Live bus positions (all active buses) |
| POST | `/bus-locations` | Create bus position record |
| PATCH | `/bus-locations/<id>` | Update position |

### Payments & Notifications

| Method | Endpoint | Description |
|---|---|---|
| POST | `/payments` | Initiate MoMo payment |
| GET | `/payments/<id>/status` | Check payment status |
| GET | `/notifications` | Get own notifications |
| POST | `/notifications/broadcast` | Broadcast to all passengers *(admin)* |

---

## Database Schema

Core tables (PostgreSQL + PostGIS):

| Table | Description |
|---|---|
| `users` | Passengers, drivers, and admins with role-based access |
| `buses` | Fleet — plate number, type, capacity, company |
| `routes` | Named routes with a short route code |
| `stops` | Physical bus stops with lat/lng and a deferred PostGIS `POINT` geometry column |
| `route_stops` | Ordered stop assignments per route with estimated minutes from start |
| `trips` | Scheduled bus runs linking a bus, route, and driver; stores cached ORS road geometry |
| `bookings` | Passenger seat reservations with QR ticket tokens |
| `payments` | MTN MoMo payment records linked to bookings |
| `bus_locations` | **One row per bus** — current lat/lng, speed, heading; updated every 10 s by the GPS scheduler |
| `notifications` | In-app messages per user with broadcast support |

All primary keys are UUIDs (`gen_random_uuid()`). Requires the `pgcrypto` and `postgis` PostgreSQL extensions.

---

## Project Journey

BusPoint started as a React Native mobile application. The initial codebase — still visible in the `src/` directory and early git commits — included Expo navigation stacks, a Mapbox integration, and a component library for driver and passenger screens. The mobile-first approach was abandoned mid-project when the team realised that distributing a native app to testers and professors for evaluation was impractical, and that the core value of the system (live tracking, booking, QR scanning) could be demonstrated more effectively in a browser.

The pivot to a Flask + plain JavaScript web app happened in a single large commit ("Merged Frontend and Backend"). From that point the project evolved rapidly: the REST API was built out endpoint by endpoint, the booking and payment flow was added, GPS tracking was initially implemented as real browser geolocation (drivers broadcasting their own position), then redesigned as a server-side simulation when the team recognised that no physical bus hardware existed. OpenRouteService was integrated to replace straight-line interpolation between stops with real road geometry. A React Native GPS ping system was removed and replaced with the APScheduler-based simulator. Late in the project, a full bilingual interface (English and Kinyarwanda) was added to reflect the Rwandan context of the application.

---

## Challenges & Solutions

- **GPS without hardware** — The original design assumed drivers would broadcast their GPS position from a phone. During development it became clear that testing this was impossible without physical buses on real routes. The solution was to invert the architecture: the server simulates bus movement using real road geometry from OpenRouteService, interpolating position mathematically based on elapsed time. This approach is production-ready — swapping in real GPS data requires only changing the data source, not the system architecture.

- **Route lines disappearing on page refresh** — The passenger map drew route lines using a boolean flag in JavaScript memory. On page refresh the flag reset, but the MapLibre sources were also cleared, causing the lines to never redraw. The fix was to check `map.getSource(sourceId)` directly as the source of truth rather than relying on an in-memory flag. If the source doesn't exist on the map object, the geometry is re-fetched and redrawn regardless of what any JS variable says.

- **Scanner state persisting between driver logins** — When a second driver logged in on the same browser session, the QR scanner was still showing the previous driver's scan counts and results. The root cause was that the scanner state variables (`scanValidCount`, `scanInvalidCount`, result div) were never reset on login. The fix was to reset all scanner state inside `showDriverDashboard()`, which is called on every driver login, ensuring a clean slate for every session.

---

## Results

The following screenshots show the application running in production.

**Live bus tracking map** — passengers see their trips and their buses moving in real time along their routes(Simulation):

![Live Map](docs/screenshots/Live_tracking_bus.png)

**Driver's Dashboard** :

![Booking](docs/screenshots/Driver's_Dashboard.png)

**Admin dashboard** — fleet overview with live stats, route management, and GPS tracking map in Kinyarwanda:

![Admin Dashboard](docs/screenshots/Admin_Dashboard_in_Kinyarwanda.png)

---

## Future Work & Lessons Learned

### Future Enhancements

- **Real hardware GPS integration** — The simulation architecture is designed to be replaced: a real GPS device on each bus would POST to the same `/api/bus-locations` endpoint the simulator currently writes to. No other changes required.
- **Native mobile app** — The React Native foundation in `src/` can be revived now that the backend API is stable and fully documented. A mobile app would improve the passenger experience significantly for daily commuters.
- **Driver and route ratings** — Passengers could rate trips after completion, feeding into a quality score per driver and route visible in the admin dashboard.
- **Geofencing alerts** — PostGIS spatial queries could notify passengers when their bus is within a configurable radius of their pickup stop.
- **Multi-language expansion** — The i18n system already supports two languages (English and Kinyarwanda). Adding French would cover Rwanda's third official language with minimal effort.

### Lessons Learned

- **Simulate early, hardware later.** Waiting for physical GPS hardware to test a tracking feature stalls an entire project. Designing the simulation as a first-class architectural component — not a workaround — meant the system could be fully tested and demonstrated without any hardware dependency.
- **Keep the frontend simple.** The decision to use plain JavaScript instead of a framework eliminated an entire category of build-related bugs and made it possible for all team members to contribute to the frontend regardless of their JavaScript framework experience.
- **Cache expensive API calls.** OpenRouteService road geometry is fetched once per trip and stored in the database. This pattern — fetch on first use, cache forever — kept API costs at zero during development and prevents rate limiting in production.

---

## Running Tests

```bash
pytest
```

To run a specific module with verbose output:

```bash
pytest test_queries/test_bookings.py -v
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes using conventional commits: `git commit -m "feat: describe your change"`
4. Push to your branch: `git push origin feature/your-feature`
5. Open a Pull Request against `main`

Please follow the existing code style — Flask blueprints for API modules, Pydantic schemas for request validation, and SQLAlchemy models with `to_dict()` methods.

---

## License

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
