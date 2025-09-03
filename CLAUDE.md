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

## Frontend Design Guidelines

### Responsive Design Principles

#### 1. CSS Units and Sizing
- **Avoid fixed pixel values** - Use relative units for scalable layouts
- **Use `clamp()` for fluid sizing**: `clamp(min, preferred, max)`
- **Prefer viewport units**: `vw`, `vh`, `vmin`, `vmax` for responsive elements
- **Use `rem/em` for typography**: Based on root or parent font size

```css
/* ❌ Avoid */
.card { width: 54px; height: 76px; }

/* ✅ Recommended */
.card { 
  width: clamp(32px, 4vw, 54px); 
  height: clamp(46px, 5.6vw, 76px); 
}
```

#### 2. Layout Strategy
- **Use CSS Grid and Flexbox** for flexible layouts
- **Implement container queries** where supported
- **Avoid absolute positioning** with fixed dimensions
- **Use CSS custom properties** for consistent theming

```css
:root {
  --card-width: clamp(28px, 4vw, 58px);
  --card-height: clamp(40px, 5.6vw, 82px);
  --spacing-sm: clamp(8px, 1vw, 12px);
  --spacing-md: clamp(12px, 2vw, 20px);
  --spacing-lg: clamp(20px, 3vw, 32px);
}
```

#### 3. Responsive Breakpoints
- **Mobile First**: Design for mobile, enhance for desktop
- **Standard breakpoints**:
  - Mobile: `< 768px`
  - Tablet: `768px - 1024px`
  - Desktop: `> 1024px`
  - Large Desktop: `> 1280px`

#### 4. Component Scaling
- **Dynamic positioning**: Calculate positions based on container size
- **Proportional scaling**: Use percentages and viewport units
- **Maintain aspect ratios**: Use `aspect-ratio` property where possible

```javascript
// Dynamic player positioning
const getPlayerPosition = (index, containerSize) => {
  const radiusX = Math.min(containerSize.width * 0.35, 280)
  const radiusY = Math.min(containerSize.height * 0.3, 160)
  // Calculate position based on container
}
```

#### 5. Typography Scale
- **Fluid typography**: Use clamp() for scalable text
- **Consistent line heights**: 1.4-1.6 for readability
- **Hierarchy with scale**: Clear heading sizes

```css
h1 { font-size: clamp(1.8rem, 4vw, 3rem); }
h2 { font-size: clamp(1.5rem, 3vw, 2.5rem); }
p { font-size: clamp(0.9rem, 2vw, 1.1rem); }
```

#### 6. Interactive Elements
- **Touch-friendly sizes**: Minimum 44px touch targets
- **Hover states**: Only on non-touch devices
- **Focus indicators**: Clear keyboard navigation

```css
@media (hover: hover) {
  .button:hover { /* Hover effects only on devices that support it */ }
}

.button {
  min-height: 44px;
  min-width: 44px;
}
```

#### 7. Performance Considerations
- **Optimize animations**: Use `transform` and `opacity`
- **Reduce layout thrashing**: Avoid animating layout properties
- **Use `will-change` sparingly**: Only when necessary

```css
.card-animation {
  transform: translateX(0);
  transition: transform 0.3s ease;
  will-change: transform; /* Only when animating */
}
```

### Component Design Patterns

#### 1. Card Components
- Maintain 2:3 aspect ratio (poker card standard)
- Scale proportionally with container
- Use semantic HTML structure

#### 2. Game Table Layout
- Elliptical arrangement for player positions
- Responsive center area for community cards
- Flexible right panel for controls

#### 3. UI Controls
- Consistent button sizing and spacing
- Clear visual hierarchy
- Accessible color contrast ratios

### Design System Variables
```css
:root {
  /* Colors */
  --color-primary: #667eea;
  --color-secondary: #764ba2;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-background: linear-gradient(135deg, #0f1419 0%, #1a2332 100%);
  
  /* Spacing */
  --space-xs: clamp(4px, 0.5vw, 8px);
  --space-sm: clamp(8px, 1vw, 12px);
  --space-md: clamp(12px, 2vw, 20px);
  --space-lg: clamp(20px, 3vw, 32px);
  --space-xl: clamp(32px, 4vw, 48px);
  
  /* Typography */
  --font-size-xs: clamp(0.75rem, 1.5vw, 0.875rem);
  --font-size-sm: clamp(0.875rem, 2vw, 1rem);
  --font-size-md: clamp(1rem, 2.5vw, 1.125rem);
  --font-size-lg: clamp(1.125rem, 3vw, 1.5rem);
  --font-size-xl: clamp(1.5rem, 4vw, 2rem);
  
  /* Components */
  --card-aspect-ratio: 2/3;
  --border-radius-sm: 8px;
  --border-radius-md: 12px;
  --border-radius-lg: 16px;
  --shadow-sm: 0 2px 8px rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.2);
  --shadow-lg: 0 8px 32px rgba(0, 0, 0, 0.3);
}