# Gym Management System — Frontend

React 18 + TypeScript + Vite single-page app. See the [root README](../README.md) for the full project overview.

## Setup and run

```powershell
cd frontend
npm install
npm run dev
```

The app is served at http://localhost:5173 and expects the backend at `VITE_API_BASE_URL`
(default `http://localhost:8000`). Start the backend first, otherwise pages show a "can't reach the server" state with a retry option.

## Configuration

Copy `.env.example` to `.env` and restart the dev server after changes.

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:8000` | Backend base URL, no trailing slash and no `/api` |

The URL is read in one place, `src/services/api.ts`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Structure

```
src/
  components/   ui/ (buttons, tables, overlays, toasts), layout/, charts/, members/, payments/, plans/
  pages/        Dashboard, Members, Plans, Payments, Settings, NotFound
  layouts/      app shell and navigation definition
  services/     Axios client (retry on transient read errors) and one module per API resource
  hooks/        useApi, useDebounce, useSettings, useDataVersion, useMediaQuery
  types/        TypeScript types that mirror the backend responses
  utils/        formatting, motion presets, Zod schemas, form helpers
  styles/       Tailwind layers and design tokens
  test/         Vitest suites and fakeServer.ts (in-memory stand-in for the API)
```

## Design notes

- Colours are semantic tokens defined in the stylesheet and Tailwind config, so the palette can be changed in one place.
- Fonts: Inter (interface), Manrope (display headings), JetBrains Mono (IDs and numbers).
- Motion uses Framer Motion with transform and opacity, short durations, and respects `prefers-reduced-motion`.
- Forms use React Hook Form with Zod. Server errors keep the entered values and are shown inline or as toasts.
- Gym name, theme, page size and sidebar state are stored in the browser (`localStorage`), not on the server.

## Tests

Vitest and Testing Library run the real pages, hooks and services; only the network is replaced by `src/test/fakeServer.ts`,
which mirrors the backend's response shapes.

