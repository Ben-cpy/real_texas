# CLAUDE.md

Texas Hold'em poker game with real-time multiplayer (Vue 3 + Node.js + Socket.IO)

## Quick Start

**Backend:**
```bash
cd backend && npm install && npm run dev  # http://localhost:3001
```

**Frontend:**
```bash
cd frontend && npm install && npm run dev  # http://localhost:3000
```

**Troubleshooting:**
- Port 3000 in use: `netstat -ano | findstr :3000` then `taskkill //PID <PID> //F`
- V2rayN proxy issues: Add `localhost`, `127.0.0.1` to bypass list

## Architecture

**Backend:** Express + Socket.IO + SQLite
- Entry: `backend/src/server.js`
- Game Logic: `services/PokerGame.js`
- Socket: `socket/gameSocket.js`
- Auth: JWT middleware in `middleware/auth.js`

**Frontend:** Vue 3 Composition API + Pinia + Element Plus
- Views: `Home.vue`, `Game.vue`, `Login.vue`
- Stores: `stores/user.js`, `stores/game.js`
- Socket: `services/socket.js`

**Key Files:**
- `backend/src/models/User.js` - User model & stats
- `backend/src/services/PokerGame.js` - Game engine
- `frontend/src/stores/user.js` - User state (chips, win rate)
- `frontend/src/stores/game.js` - Game state & Socket.IO

## Recent Updates

**UI Improvements (Game.vue):**
- ✅ Host controls redesigned with clear "Start Game" button
- ✅ Help modal (❓) with complete Texas Hold'em rules
- ✅ Chat auto-scroll functionality
- ✅ Fixed NaN% win rate display (shows 0% when no games played)
- ✅ Username display in Home.vue header

**Game Features:**
- AI player management (+/- buttons)
- Seat count adjustment (3-6 players)
- Real-time chat with auto-scroll
- Achievement system with rewards

## Design Guidelines

**Responsive Design:**
- Use `clamp()` for fluid sizing: `clamp(min, preferred, max)`
- Mobile-first approach (breakpoints: 768px, 1024px, 1280px)
- Touch-friendly: min 44px touch targets
- CSS custom properties for theming

**Component Patterns:**
- Cards: 2:3 aspect ratio
- Player seats: Elliptical arrangement around table
- Modals: Backdrop blur with smooth transitions
- Buttons: Consistent sizing with gradient variants

**Code Style:**
- ES modules throughout
- Vue 3 Composition API preferred
- Async/await over promise chains
- ESLint + Prettier configured

## Environment Variables

Backend `.env`:
```
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
DEFAULT_CHIPS=10000
SMALL_BLIND=10
BIG_BLIND=20
```

## Key Socket Events

**Client → Server:**
- `authenticate` - JWT auth
- `join_room` - Join game room
- `game_action` - Player action (fold/call/raise/all-in)
- `start_game` - Host starts game
- `send_chat_message` - Send chat

**Server → Client:**
- `game_update` - Game state changed
- `game_started` - New hand started
- `game_finished` - Hand complete, show winner
- `chat_message` - New chat message
- `achievements_unlocked` - Player achievement

## Testing

```bash
cd backend && npm test        # Jest unit tests
cd frontend && npm run build  # Production build test
```

## Future Improvements

- Advanced poker table seat layout (SVG-based with stable seat mapping)
- Spectator mode
- Tournament system
- Hand history replay
