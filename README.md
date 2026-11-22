# Forma — Gym Management System

A full-stack application for managing gym members, membership plans and payment records.
A React + TypeScript single-page app talks to a modular FastAPI backend over REST, and all data
is persisted in JSON files, so records survive server restarts.

> Payments are **record keeping only**. The system never processes real transactions.

## Features

**Dashboard**
- KPI cards: total, active and expired members, pending payments
- Membership distribution chart and membership growth chart (Recharts)
- Recent registrations, recent payments, upcoming expirations and quick actions
- Every figure is calculated by the backend

**Members**
- Create, view, edit, delete and renew members; detail drawer with membership history
- Search by member ID, name or phone number (debounced)
- Filters: status (active / expired / upcoming), expiring soon, payment status, plan
- Sorting and pagination; table on desktop, card layout on small screens

**Membership plans**
- Create, view, edit, delete and search plans (name, duration in days, price, description, active flag)
- A plan that members still use cannot be deleted (HTTP 409); mark it inactive instead

**Payments**
- Record, view, edit, delete and search payments; filter by status and method
- Payment history per member, totals and recent transactions
- Methods: cash, UPI, card, bank transfer, other. Statuses: paid, pending, failed

**Settings**
- Gym details, theme (dark / light / system), page size and sidebar preference, all saved in the browser
- Backend information (version, data folder, record counts) and a full JSON data export

**Interface**
- Cold-toned dark design system built on semantic colour tokens (teal accent used sparingly)
- Collapsible sidebar, top bar with global search and notifications, mobile navigation
- Framer Motion transitions that use transform and opacity, with `prefers-reduced-motion` respected
- Loading skeletons, error states with retry, toast feedback and inline form validation (React Hook Form + Zod)

## Architecture

```
gym-management-system/
├── backend/                 FastAPI application
│   ├── app/
│   │   ├── main.py          app factory, CORS, error handlers
│   │   ├── config.py        environment-driven settings
│   │   ├── container.py     wires repositories and services
│   │   ├── errors.py        domain errors mapped to HTTP codes
│   │   ├── seed.py          demo data generator
│   │   ├── routes/          HTTP layer (members, memberships, payments, dashboard, system)
│   │   ├── schemas/         Pydantic request and response models
│   │   ├── services/        business rules (status, dates, references, statistics)
│   │   ├── repositories/    one repository per JSON file
│   │   ├── utils/           file_handler.py (atomic JSON storage), validators.py
│   │   └── data/            members.json, memberships.json, payments.json
│   └── tests/               pytest suite
├── frontend/                React + TypeScript + Vite
│   └── src/
│       ├── components/      ui kit, layout, charts, feature components
│       ├── pages/           Dashboard, Members, Plans, Payments, Settings
│       ├── layouts/         app shell
│       ├── services/        Axios client and one API module per resource
│       ├── hooks/           data fetching, debounce, settings, media queries
│       ├── types/           TypeScript types mirroring the API
│       ├── utils/           formatting, motion presets, Zod schemas
│       ├── styles/          Tailwind layers and design tokens
│       └── test/            Vitest suites and an in-memory fake API
├── run.bat                  one-click launcher (Windows)
├── README.md
├── .env.example
└── .gitignore
```

Request flow: **route → service → repository → JSON file**. Routes only parse and return data,
services hold the business rules, and repositories are the only code that touches the files.

## Requirements

- Python 3.11 or newer (developed with Python 3.14)
- Node.js 18 or newer (developed with Node 25) and npm

## Installation

Windows (PowerShell):

```powershell
# Backend
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt

# Frontend
cd ..\frontend
npm install
```

macOS / Linux:

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cd ../frontend && npm install
```

## Configuration

Both parts run with defaults and no configuration. To change a setting, copy `.env.example`
to `backend/.env` (backend) and `frontend/.env` (frontend), or use the per-folder example files.

| Variable | Used by | Default | Meaning |
| --- | --- | --- | --- |
| `GYM_DATA_DIR` | backend | `backend/app/data` | Folder holding the three JSON files |
| `GYM_CORS_ORIGINS` | backend | `http://localhost:5173,http://127.0.0.1:5173` | Comma-separated browser origins allowed to call the API |
| `GYM_EXPIRY_WARNING_DAYS` | backend | `7` | A membership is "expiring soon" when it ends within this many days |
| `GYM_SEED_DEMO_DATA` | backend | `true` | Create demo data on first start when every data file is empty |
| `VITE_API_BASE_URL` | frontend | `http://localhost:8000` | Backend base URL, without a trailing slash or `/api` |

## Quick start (Windows)

Double-click **`run.bat`** in the project root (or run it from a terminal). On first run it creates the backend virtual environment and installs backend and frontend dependencies, then starts the backend (port 8000) and the frontend (port 5173) in two windows and opens http://localhost:5173. Close the two windows to stop the servers.

## Running the application

Run the two servers in two separate terminals.

**Terminal 1 — backend** (http://localhost:8000):

```powershell
cd backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — frontend** (http://localhost:5173):

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173. On first start the backend creates demo plans, members and payments
if all three data files are empty. To disable that, set `GYM_SEED_DEMO_DATA=false`.
To regenerate the demo data (this overwrites existing records):

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.seed --reset
```

Production build of the frontend: `npm run build` (output in `frontend/dist`), preview with `npm run preview`.

## API documentation

Interactive Swagger UI is served by the backend at **http://localhost:8000/docs**
(ReDoc at `/redoc`, OpenAPI JSON at `/openapi.json`).

| Area | Endpoints |
| --- | --- |
| Members | `GET /api/members` (search, filters, sorting, pagination), `GET /api/members/search`, `GET/PUT/DELETE /api/members/{id}`, `POST /api/members`, `POST /api/members/{id}/renew` |
| Membership plans | `GET/POST /api/memberships`, `GET/PUT/DELETE /api/memberships/{id}` |
| Payments | `GET/POST /api/payments`, `GET /api/payments/summary`, `GET /api/payments/member/{member_id}`, `GET/PUT/DELETE /api/payments/{id}` |
| Dashboard | `GET /api/dashboard/stats`, `recent-members`, `recent-payments`, `membership-distribution`, `membership-growth`, `expiring-memberships` |
| System | `GET /api/health`, `GET /api/system/info`, `GET /api/system/export` |

Errors use a consistent body: `{"detail": "message"}`; validation errors (422) also include
`"errors": [{"field", "message"}]`. Status codes: 201 on create, 204 on delete, 404 for unknown
records, 409 for conflicts (duplicate phone number, plan still in use), 422 for invalid input,
503 when storage is unavailable.

## Business rules

- **Membership status** is derived from dates, never stored: *upcoming* (starts in the future),
  *active* (today is between start and end, inclusive) and *expired* (end date has passed).
- **End date** defaults to `start_date + plan duration - 1 day` (inclusive) unless one is supplied.
- **Payment status is separate from membership status.** A member can be active with a pending payment.
- **Renewing** a membership moves the previous period into the member's history instead of overwriting it.
- Phone numbers are normalised and must be unique per member. Payments must reference an existing member.
- Plans in use cannot be deleted. Payment statuses are set by staff and never changed automatically; recording a payment does not alter a member's own payment status.
- Deleting a member keeps their payment records as history (each record stores the member name).

## Data storage

Data lives in three JSON files (by default in `backend/app/data/`): `members.json`,
`memberships.json` and `payments.json`. Each is a list of records.

- Missing files are created automatically; empty files are treated as empty lists.
- Writes go to a temporary file in the same folder, are flushed and fsynced, then swapped in with
  `os.replace`, so a crash mid-write cannot leave a half-written file.
- A corrupted file is moved aside as `<name>.corrupt-<timestamp>` and replaced by an empty list.
- Access is serialised with per-file locks.
- Use `GYM_DATA_DIR` to keep the data outside the repository. The tests always use temporary folders.

## Testing

```powershell
# Backend (pytest, isolated temporary storage)
cd backend
.\.venv\Scripts\python.exe -m pytest

# Frontend (Vitest + Testing Library, with an in-memory fake API)
cd frontend
npm test
npm run typecheck
```

The backend tests cover members, plans, payments, status calculation, dashboard figures, invalid
requests, missing references and file storage. The frontend tests run the real pages, hooks and
services against a fake network layer and cover adding, editing, deleting and searching members,
creating plans, recording payments, the dashboard and API error states.

## Tech stack

React 18, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, Lucide React, React Router,
Axios, React Hook Form, Zod — FastAPI, Pydantic, Uvicorn, pytest.



