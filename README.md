# Real Texas Hold'em

A full-stack Texas Hold'em poker platform with a Vue 3 front-end and a Node.js/Socket.IO backend. The application supports user authentication, lobby management, and real-time multiplayer gameplay with persistent storage in SQLite.

## Repository Layout

```
real_texas/
├── backend/              # Express + Socket.IO API, authentication, and game services
│   ├── src/middleware    # Authentication and error handling utilities
│   ├── src/models        # SQLite models and data access helpers
│   ├── src/routes        # REST endpoints for auth, lobby, and gameplay
│   ├── src/services      # Poker game state machine and supporting services
│   ├── src/socket        # Socket.IO gateway wiring rooms and events
│   └── src/utils         # Shared helpers (shuffling, validation, etc.)
├── frontend/             # Vue 3 SPA built with Vite and Element Plus UI library
│   ├── src/views         # Page-level components (auth, lobby, table)
│   ├── src/stores        # Pinia stores for auth, table, and lobby state
│   └── src/components    # Reusable UI widgets and layout building blocks
├── docs/                 # Design notes and reference documentation
├── docker-compose.yml    # Dev-time orchestration for frontend + backend
└── modify_gameSocket.py  # Utility script for socket debugging/experiments
```

## Prerequisites

- **Node.js 18+** and **npm** for local development (see `"engines"` field in both `package.json` files).
- **SQLite** is bundled through the `sqlite3` npm package; no separate installation required for local use.
- **Docker & Docker Compose** (optional) for containerized development.

## Environment Variables

Each tier provides an example file—copy these and customize the values before running the services:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend variables configure the API port, JWT secret, and SQLite file path. Frontend variables describe the REST and WebSocket endpoints the SPA should target.

## Local Development

Run the backend and frontend in separate terminals.

### Backend (Express + Socket.IO)

```bash
cd backend
npm install
npm run dev
```

- Default service URL: `http://localhost:3001`
- The dev script uses `nodemon` for hot reloads.
- SQLite data is stored at `backend/data/database.sqlite` (auto-created).

Useful scripts:

```bash
npm test     # Run Jest unit tests covering poker services and APIs
npm run lint # ESLint over src/
npm run format # Prettier formatting helpers
```

### Frontend (Vue 3 + Vite)

```bash
cd frontend
npm install
npm run dev
```

- Default Vite dev server: `http://localhost:5173`
- The app expects the backend at the URLs defined in `.env` (defaults point at `localhost:3001`).

Additional scripts:

```bash
npm run build   # Production build to dist/
npm run preview # Preview the production bundle locally
npm run lint    # ESLint for Vue and JS sources
npm run format  # Prettier formatting helpers
```

### Accessing the App

With both servers running, visit `http://localhost:5173` in your browser. The UI will proxy API calls and Socket.IO events to the backend, enabling registration, login, lobby selection, and live tables.

## Docker-Based Setup (Optional)

To spin up both tiers with Docker:

```bash
docker compose up --build
```

- Frontend available on `http://localhost:3000`
- Backend available on `http://localhost:3001`
- Backend data is persisted in the named volume `backend_data`

Edit the environment values in `docker-compose.yml` or provide an `.env` file if you need different ports or secrets.

## Troubleshooting

- **Port conflicts**: ensure ports `5173`, `3000`, and `3001` are free (adjust via env variables or Vite config if needed).
- **Database location**: update `DB_PATH` in the backend `.env` to relocate the SQLite file.
- **JWT secret**: replace the placeholder in `.env` before deploying anywhere public.

## Additional Resources

- `docs/` contains system design notes, interface documentation, and gameplay rules (`rule.md`).
- `TODO.md` tracks outstanding tasks and roadmap ideas.
- `card_power.png` illustrates hand rankings for Texas Hold'em.

Happy hacking, and enjoy the game! 🎲
