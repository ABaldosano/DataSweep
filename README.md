# Datasweep

A dataset-agnostic SQL data profiler and cleaner. Upload a `.sql` dump or
`.csv` file, get a schema profile, null/duplicate/outlier detection, and a
cleaned export — no assumptions about what the data is about.

This is a companion piece to a separate data-*analytics* portfolio project;
Datasweep is the data-*engineering* / tool-building half. It works with any
tabular dataset by design.

**Status:** step 2 of the build plan complete. Upload, allowlisted `.sql`
parsing, `.csv` type inference, and per-session schema profiling are live
end to end. Cleaning actions and export are next.

## Why this exists

Data cleaning is most of what an analyst's time actually goes to, and it's
usually invisible in portfolios. Datasweep makes that process a first-class,
demoable tool instead of a hidden step.

## Architecture decisions (step 1)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Reuses the design system/components from the companion dashboard project for a consistent portfolio identity |
| Backend | Node + Express | Same language across the stack; keeps the project approachable to review |
| Database | SQLite (`better-sqlite3`), one **in-memory instance per session** | The core safety decision — see below |
| Session identity | UUID issued per client, round-tripped via an `x-datasweep-session` header | No cookies/auth needed for an anonymous demo tool |

### The sandboxing decision

The riskiest part of "upload a file and run it against a database" is letting
one visitor's file affect another visitor, or a shared database. Datasweep
avoids that at the architecture level rather than trying to filter bad input:

- Every session gets its **own SQLite database, held only in memory**
  (`src/db/sessionStore.js`). Nothing is shared or persisted across sessions.
- Idle sessions are destroyed automatically after 15 minutes.
- When `.sql` file parsing is added (next step), it will only ever accept
  `CREATE TABLE` / `INSERT` statements — never arbitrary SQL execution — so an
  uploaded file can populate a sandbox but never reach outside it.

This means even a malicious or malformed upload can, at worst, break its own
disposable session — not the server, and not anyone else's data. Tested
directly: a `.sql` file with a `DROP TABLE` mixed in among valid statements
is rejected wholesale before anything executes (see `backend/src/sql/allowlistParser.js`).

## Project structure

```
Datasweep/
├── frontend/                  React + Vite
│   ├── src/
│   │   ├── App.jsx             app shell + backend connectivity check
│   │   ├── index.css            design tokens (shared w/ dashboard project)
│   │   ├── components/          ThemeToggle, Section, ControlPanel (reused chrome)
│   │   └── hooks/useTheme.js
│   └── .env.development         VITE_API_URL for local dev
│
└── backend/                   Express + SQLite
    └── src/
        ├── server.js            app entrypoint, CORS, error handling
        ├── middleware/session.js   issues/reads the per-client session id
        ├── db/sessionStore.js      per-session in-memory SQLite (the core decision)
        ├── sql/
        │   ├── allowlistParser.js  splits + validates .sql -- CREATE TABLE/INSERT only
        │   ├── csvLoader.js        CSV parsing + column type inference
        │   └── introspect.js       reads back schema (tables/columns/row counts)
        └── routes/
            ├── health.js         GET /api/health
            ├── session.js        GET /api/session/ping, GET /api/schema
            └── upload.js         POST /api/upload -- .sql or .csv, 10MB cap
```

## Running it locally

**Backend**
```bash
cd backend
npm install
cp .env.example .env   # already provided with sane local defaults
npm run dev
# -> http://localhost:4000
```

**Frontend** (separate terminal)
```bash
cd frontend
npm install
npm run dev
# -> http://localhost:5173
```

Open the frontend URL — the status pill in the header confirms the backend
connection and proves a real sandboxed database session round-trips a query
successfully.

## Roadmap

- [x] **Step 1 — Architecture**: frontend/backend scaffold, per-session
      sandboxed SQLite, proven connectivity
- [x] **Step 2 — Upload & parsing**: `.sql` (allowlisted `CREATE TABLE` /
      `INSERT` only) and `.csv` ingestion into the session database, with
      drag-and-drop upload UI and live schema display
- [ ] **Step 3 — Profiling engine**: per-column type/null/unique/min-max
      summary, dataset-agnostic
- [ ] **Step 4 — Cleaning actions**: duplicate detection/removal (exact and
      key-based), null handling strategies, outlier flagging, with
      before/after previews and undo
- [ ] **Step 5 — Export**: cleaned `.csv`/`.sql` download with a before/after
      cleaning report
- [ ] **Step 6 — Hardening**: upload size caps, query timeouts, rate limiting
- [ ] **Step 7 — Polish**: screenshots/GIF, live demo link, deployed
      frontend + backend
