# Repository Guidelines

## Project Structure & Module Organization
Backend services live in ackend/src (Express API, Socket.IO gateway, SQLite models). Game logic is centered in services/PokerGame.js with supporting middleware and routes per feature. Frontend Vue components and state are in rontend/src, organized by views, stores, and shared UI elements. Shared assets and reference docs reside in docs/ and the root images. Use docker-compose.yml when you need a full-stack sandbox; it wires the backend and frontend containers.

## Build, Test, and Development Commands
Run 
pm install separately in ackend/ and rontend/ before anything else. Start iterative backend work with 
pm run dev inside ackend/; this enables nodemon reloads. From rontend/, 
pm run dev launches the Vite dev server at http://localhost:5173. Execute 
pm test in ackend/ to run the Jest suite, and 
pm run lint or 
pm run format in either package to enforce style. For an integrated preview, docker compose up from the repo root spins up both tiers.

## Coding Style & Naming Conventions
Use two-space indentation for JavaScript and Vue files; Prettier and ESLint enforce the rule. Favor camelCase for variables and functions, PascalCase for classes and Vue components, and kebab-case for filenames and routes. Backend modules export named functions from ES modules (	ype: "module"). Vue single-file components should group <script setup>, <template>, then <style scoped>.

## Testing Guidelines
Backend logic is covered by Jest tests colocated with the implementation (e.g., services/PokerGame.test.js). Follow the *.test.js suffix and mirror the module path for new suites. Before pushing, run 
pm test and address any flakiness—poker state transitions need deterministic shuffles via the provided helpers. Frontend currently lacks automated tests; document manual verification steps in the PR until a Vue test harness is introduced.

## Commit & Pull Request Guidelines
History follows Conventional Commits (eat:, ix:, efactor:). Keep messages in the imperative mood and reference an issue ID or Trello card when available. Each PR should explain the gameplay or UI change, note configuration updates, and list test commands executed. Attach screenshots or GIFs for user-facing tweaks. Request at least one teammate review when touching shared game logic.

## Security & Configuration Tips
Copy .env.example in both ackend/ and rontend/ to .env, supplying secrets locally only. Never commit secrets or SQLite files under ackend/data/. Rotate JWT secrets whenever deploying. If you rely on Docker, map the exposed ports carefully to avoid collisions on shared dev machines.
