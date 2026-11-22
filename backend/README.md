# Gym Management System — Backend

FastAPI service that stores members, membership plans and payment records in JSON files.
See the [root README](../README.md) for the full project overview.

## Setup and run

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

macOS / Linux: use `.venv/bin/python` instead of `.\.venv\Scripts\python.exe`.

- API: http://localhost:8000/api
- Swagger UI: http://localhost:8000/docs (ReDoc: `/redoc`)
- Health check: `GET /api/health`

## Configuration

Environment variables (see `.env.example`; copy it to `backend/.env`). Real environment variables win over the file.

| Variable | Default | Meaning |
| --- | --- | --- |
| `GYM_DATA_DIR` | `app/data` | Folder holding `members.json`, `memberships.json`, `payments.json` |
| `GYM_CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed browser origins, comma-separated |
| `GYM_EXPIRY_WARNING_DAYS` | `7` | Window for "expiring soon" memberships |
| `GYM_SEED_DEMO_DATA` | `true` | Seed demo data on first start when all data files are empty |

## Layout

```
app/
  main.py          app factory, CORS, exception handlers
  config.py        settings from environment
  container.py     builds repositories and services for a data folder
  errors.py        NotFound / Conflict / Validation errors
  seed.py          demo data (dates are relative to today)
  routes/          members, memberships, payments, dashboard, system
  schemas/         Pydantic models
  services/        business logic
  repositories/    one class per JSON file
  utils/           file_handler.py (atomic JSON I/O), validators.py
  data/            the JSON files
tests/             pytest suite
```

## Data commands

```powershell
.\.venv\Scripts\python.exe -m app.seed            # seed only if every data file is empty
.\.venv\Scripts\python.exe -m app.seed --reset    # overwrite all records with demo data
```

## Storage behaviour

- Every file is a JSON array. Missing or empty files are initialised to `[]`.
- Writes use a temporary file, `fsync` and `os.replace` (atomic), under a per-file lock.
- A corrupted file is renamed `<name>.corrupt-<timestamp>` and replaced by an empty array; the incident is logged.
- API clients never see stack traces: storage problems return `503`, unexpected errors return a generic `500`.

## Tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Tests build their own container on a temporary folder, so the real JSON files are never touched.
