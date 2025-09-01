# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack Texas Hold'em poker game application with real-time multiplayer functionality. The project uses a frontend-backend separation architecture with Vue 3 and Node.js.

## Development Commands

### Backend (Node.js + Express)
```bash
cd backend
npm install          # Install dependencies
npm run dev          # Start development server with nodemon
npm run start        # Start production server
npm test             # Run Jest tests
npm run lint         # Run ESLint
npm run format       # Format code with Prettier
```

### Frontend (Vue 3 + Vite)
```bash
cd frontend
npm install          # Install dependencies
npm run dev          # Start Vite development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Run ESLint with Vue plugin
npm run format       # Format code with Prettier
```

### Docker Deployment
```bash
docker-compose up    # Start both services in containers
docker-compose down  # Stop and remove containers
```

## Architecture Overview

### Backend Structure
- **Entry Point**: `backend/src/server.js` - Express server with Socket.IO
- **Database**: SQLite with custom wrapper class in `models/database.js`
- **Authentication**: JWT-based auth middleware in `middleware/auth.js`
- **Game Logic**: Poker game engine in `services/PokerGame.js`
- **Routes**: RESTful APIs in `routes/` (auth, game, user)
- **Socket Handling**: Real-time game communication in `socket/gameSocket.js`
- **Models**: User and GameRoom models with database interactions

### Frontend Structure
- **Framework**: Vue 3 with Composition API
- **State Management**: Pinia for global state
- **UI Library**: Element Plus components
- **Router**: Vue Router with authentication guards
- **Real-time**: Socket.IO client for game updates
- **Views**: Home, Login, and Game main views

### Key Components
- **PokerGame Service**: Handles card dealing, hand evaluation, betting rounds
- **Database Schema**: Users, game_rooms, game_records, user_game_records tables
- **Socket Events**: Real-time game state synchronization between players
- **JWT Authentication**: Token-based auth with middleware protection

## Environment Configuration

Backend uses `.env` file with these key variables:
- `PORT`: Server port (default: 3001)
- `FRONTEND_URL`: CORS origin (default: http://localhost:3000)
- `JWT_SECRET`: JWT signing secret
- `DB_PATH`: SQLite database path
- `DEFAULT_CHIPS`: Starting chips for new users
- `SMALL_BLIND` / `BIG_BLIND`: Game betting limits

## Development Notes

### Database
- Uses SQLite for development with automatic schema initialization
- Database file created in `backend/data/database.sqlite`
- Models handle database operations with Promise-based wrappers

### Game Logic
- Card class with suit/rank/value properties
- Deck class with shuffle and deal methods
- Hand evaluation algorithms for poker hands
- Betting round state management

### Real-time Communication
- Socket.IO handles player actions and game state updates
- Game rooms support multiple players with spectator mode
- Automatic reconnection and state synchronization

### Code Style
- ES modules throughout (type: "module" in package.json)
- ESLint + Prettier configured for both frontend and backend
- Vue 3 Composition API preferred over Options API
- Async/await preferred over promises chains