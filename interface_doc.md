# Backend Interface Documentation

## Table of Contents
- [Server Entry Point](#server-entry-point)
- [Poker Game Service](#poker-game-service)
- [Socket Communication](#socket-communication)
- [User Model](#user-model)
- [Game Room Model](#game-room-model)
- [Database Service](#database-service)
- [Achievements Service](#achievements-service)
- [Authentication Routes](#authentication-routes)
- [Game Routes](#game-routes)
- [User Routes](#user-routes)
- [Authentication Middleware](#authentication-middleware)
- [Error Handler Middleware](#error-handler-middleware)

---

## Server Entry Point

### File: `backend/src/server.js`

Main server entry point that initializes Express, Socket.IO, and all routes.

**Health Check Endpoint:**
- `GET /api/health` - Returns server status and uptime

---

## Poker Game Service

### File: `backend/src/services/PokerGame.js`

Core poker game engine implementing Texas Hold'em rules.

### Utility Functions

#### `generateCombinations(items, k)`
**Purpose:** Generate all possible k-combinations from an array of items
**Location:** `backend/src/services/PokerGame.js:20`
**Parameters:**
- `items` (Array): Array of items to combine
- `k` (Number): Size of each combination
**Returns:** Array of all possible combinations

---

#### `detectStraight(values)`
**Purpose:** Detect if card values form a straight (5 consecutive cards)
**Location:** `backend/src/services/PokerGame.js:43`
**Parameters:**
- `values` (Array<Number>): Array of card values (2-14, where 14 is Ace)
**Returns:** Object with `{ isStraight: boolean, highCard: number }`

---

#### `evaluateFiveCardHand(cards)`
**Purpose:** Evaluate a 5-card poker hand and determine its rank
**Location:** `backend/src/services/PokerGame.js:68`
**Parameters:**
- `cards` (Array<Card>): Exactly 5 Card objects
**Returns:** Object with `{ rank, values, rankName, cards }`
- `rank` (1-9): Hand strength (1=High Card, 9=Straight Flush)
- `values` (Array): Card values for tie-breaking
- `rankName` (String): Human-readable hand name
- `cards` (Array): Sorted cards

---

#### `compareHandRanks(first, second)`
**Purpose:** Compare two poker hands to determine winner
**Location:** `backend/src/services/PokerGame.js:148`
**Parameters:**
- `first` (Object): First hand evaluation result
- `second` (Object): Second hand evaluation result
**Returns:** Number (positive if first wins, negative if second wins, 0 for tie)

---

#### `evaluateBestHand(cards)`
**Purpose:** Find the best 5-card hand from 7 cards (hole cards + community cards)
**Location:** `backend/src/services/PokerGame.js:165`
**Parameters:**
- `cards` (Array<Card>): 7 Card objects (2 hole + 5 community)
**Returns:** Best hand evaluation object

---

#### `getPlayerSnapshot(player, phase)`
**Purpose:** Create a sanitized snapshot of player data for broadcasting
**Location:** `backend/src/services/PokerGame.js:236`
**Parameters:**
- `player` (Object): Player object
- `phase` (String): Current game phase ('waiting', 'preflop', 'flop', 'turn', 'river', 'showdown')
**Returns:** Player data object with cards revealed only in showdown phase

---

### Card Class

#### `constructor(suit, rank)`
**Purpose:** Create a playing card
**Location:** `backend/src/services/PokerGame.js:183`
**Parameters:**
- `suit` (String): Card suit ('♠', '♥', '♦', '♣')
- `rank` (String): Card rank ('2'-'10', 'J', 'Q', 'K', 'A')

#### `Card.getValue(rank)` (static)
**Purpose:** Convert card rank to numeric value
**Location:** `backend/src/services/PokerGame.js:189`
**Parameters:**
- `rank` (String): Card rank
**Returns:** Number (2-14, where 14 is Ace)

#### `toString()`
**Purpose:** Get string representation of card
**Returns:** String (e.g., '♠A', '♥K')

---

### Deck Class

#### `constructor()`
**Purpose:** Create and initialize a 52-card deck
**Location:** `backend/src/services/PokerGame.js:203`

#### `reset()`
**Purpose:** Reset deck to 52 cards and shuffle
**Location:** `backend/src/services/PokerGame.js:208`

#### `shuffle()`
**Purpose:** Shuffle the deck using Fisher-Yates algorithm
**Location:** `backend/src/services/PokerGame.js:220`

#### `deal()`
**Purpose:** Deal one card from the top of the deck
**Location:** `backend/src/services/PokerGame.js:227`
**Returns:** Card object

#### `getRemaining()`
**Purpose:** Get number of cards remaining in deck
**Location:** `backend/src/services/PokerGame.js:231`
**Returns:** Number

---

### PokerGame Class

Main game engine class managing all poker game logic.

#### `constructor(roomId, options)`
**Purpose:** Create a new poker game instance
**Location:** `backend/src/services/PokerGame.js:267`
**Parameters:**
- `roomId` (String): Unique room identifier
- `options` (Object):
  - `smallBlind` (Number): Small blind amount (default: 10)
  - `bigBlind` (Number): Big blind amount (default: 20)
  - `maxPlayers` (Number): Maximum players (default: 6)
  - `desiredSeatCount` (Number): Target number of seats (default: maxPlayers)

---

#### `addPlayer(player)`
**Purpose:** Add a player to the game
**Location:** `backend/src/services/PokerGame.js:295`
**Parameters:**
- `player` (Object):
  - `id` (String): Player unique ID
  - `name` (String): Player name
  - `chips` (Number): Player's chip count
  - `socketId` (String): Socket connection ID
  - `isAI` (Boolean): Whether player is AI
**Returns:** Boolean (true if added successfully, false otherwise)

---

#### `addAIPlayer()`
**Purpose:** Add an AI player to the game
**Location:** `backend/src/services/PokerGame.js:328`
**Returns:** Boolean (success status)

---

#### `removeAIPlayer()`
**Purpose:** Remove the last AI player from the game
**Location:** `backend/src/services/PokerGame.js:342`
**Returns:** Boolean (true if AI player was removed)

---

#### `countRealPlayers()`
**Purpose:** Count non-AI players in the game
**Location:** `backend/src/services/PokerGame.js:352`
**Returns:** Number of real players

---

#### `setDesiredSeatCount(count)`
**Purpose:** Set the target number of total seats (adjusts AI players accordingly)
**Location:** `backend/src/services/PokerGame.js:356`
**Parameters:**
- `count` (Number): Desired total seat count
**Returns:** Object with `{ success, desiredSeatCount }`

---

#### `syncAIPlayers()`
**Purpose:** Automatically add or remove AI players to match desired seat count
**Location:** `backend/src/services/PokerGame.js:371`

---

#### `removePlayer(playerId)`
**Purpose:** Remove a player from the game
**Location:** `backend/src/services/PokerGame.js:393`
**Parameters:**
- `playerId` (String): Player ID to remove
**Returns:** Boolean (true if player was found and removed)

---

#### `startGame()`
**Purpose:** Start the poker game
**Location:** `backend/src/services/PokerGame.js:408`
**Returns:** Object with `{ success, error? }`

---

#### `beginHand()`
**Purpose:** Begin a new hand (deal cards, post blinds, reset state)
**Location:** `backend/src/services/PokerGame.js:425`

---

#### `startNextHand()`
**Purpose:** Start the next hand after current hand finishes
**Location:** `backend/src/services/PokerGame.js:464`
**Returns:** Object with `{ success, gameState?, error? }`

---

#### `ensureDealerIndex()`
**Purpose:** Ensure dealer button is on a valid active player
**Location:** `backend/src/services/PokerGame.js:478`

---

#### `advanceDealer()`
**Purpose:** Move dealer button to next active player
**Location:** `backend/src/services/PokerGame.js:491`

---

#### `dealHoleCards()`
**Purpose:** Deal 2 hole cards to each active player
**Location:** `backend/src/services/PokerGame.js:503`

---

#### `postBlinds()`
**Purpose:** Post small and big blinds
**Location:** `backend/src/services/PokerGame.js:521`

---

#### `findNextIndex(startIndex, predicate, includeStart)`
**Purpose:** Find next player index matching a condition
**Location:** `backend/src/services/PokerGame.js:581`
**Parameters:**
- `startIndex` (Number): Starting player index
- `predicate` (Function): Condition function (player, idx) => boolean
- `includeStart` (Boolean): Whether to include start index in search
**Returns:** Number (player index or -1 if not found)

---

#### `determineFirstToAct(phase)`
**Purpose:** Determine which player should act first in current betting round
**Location:** `backend/src/services/PokerGame.js:598`
**Parameters:**
- `phase` (String): Game phase ('preflop', 'flop', 'turn', 'river')
**Returns:** Number (player index)

---

#### `playerBet(player, amount)`
**Purpose:** Process a player's bet (move chips from player to pot)
**Location:** `backend/src/services/PokerGame.js:626`
**Parameters:**
- `player` (Object): Player object
- `amount` (Number): Bet amount
**Returns:** Number (actual amount bet after min/max adjustments)

---

#### `handlePlayerAction(playerId, rawAction, rawAmount)`
**Purpose:** Handle a player's action (fold, check, call, raise, all-in)
**Location:** `backend/src/services/PokerGame.js:645`
**Parameters:**
- `playerId` (String): Player ID
- `rawAction` (String): Action type ('fold', 'check', 'call', 'raise', 'bet', 'all_in')
- `rawAmount` (Number): Amount for raise/bet (optional)
**Returns:** Object with `{ success, error?, action? }`

---

#### `handleFold(player)`
**Purpose:** Process a fold action
**Location:** `backend/src/services/PokerGame.js:744`
**Parameters:**
- `player` (Object): Player object
**Returns:** Object with `{ success, action }`

---

#### `handleCheck(player)`
**Purpose:** Process a check action
**Location:** `backend/src/services/PokerGame.js:750`
**Parameters:**
- `player` (Object): Player object
**Returns:** Object with `{ success, action, error? }`

---

#### `handleCall(player)`
**Purpose:** Process a call action
**Location:** `backend/src/services/PokerGame.js:758`
**Parameters:**
- `player` (Object): Player object
**Returns:** Object with `{ success, action, amount, requiresResponse }`

---

#### `handleRaise(player, declaredAmount)`
**Purpose:** Process a raise/bet action
**Location:** `backend/src/services/PokerGame.js:773`
**Parameters:**
- `player` (Object): Player object
- `declaredAmount` (Number): Raise amount
**Returns:** Object with `{ success, action, amount, requiresResponse, error? }`

---

#### `handleAllIn(player)`
**Purpose:** Process an all-in action
**Location:** `backend/src/services/PokerGame.js:811`
**Parameters:**
- `player` (Object): Player object
**Returns:** Object with `{ success, action, amount, requiresResponse }`

---

#### `resetActionFlagsExcept(playerId)`
**Purpose:** Reset action flags for all players except the specified one
**Location:** `backend/src/services/PokerGame.js:836`
**Parameters:**
- `playerId` (String): Player ID to exclude from reset

---

#### `nextPlayer()`
**Purpose:** Advance to the next player who needs to act
**Location:** `backend/src/services/PokerGame.js:857`

---

#### `isRoundComplete()`
**Purpose:** Check if current betting round is complete
**Location:** `backend/src/services/PokerGame.js:865`
**Returns:** Boolean

---

#### `resetForNextBettingRound()`
**Purpose:** Reset state for the next betting round
**Location:** `backend/src/services/PokerGame.js:885`

---

#### `advancePhase()`
**Purpose:** Advance to next game phase (preflop → flop → turn → river → showdown)
**Location:** `backend/src/services/PokerGame.js:898`

---

#### `finishHandByFold(winner)`
**Purpose:** End hand when all but one player has folded
**Location:** `backend/src/services/PokerGame.js:936`
**Parameters:**
- `winner` (Object): Winning player object

---

#### `resolveShowdown()`
**Purpose:** Resolve showdown, determine winner(s), and distribute pot
**Location:** `backend/src/services/PokerGame.js:988`

---

#### `getAIAction(player)`
**Purpose:** Calculate AI player's action based on hand strength and pot odds
**Location:** `backend/src/services/PokerGame.js:1141`
**Parameters:**
- `player` (Object): AI player object
**Returns:** Object with `{ action, amount? }`

---

#### `calculateHandStrength(player)`
**Purpose:** Calculate estimated hand strength for AI decision making
**Location:** `backend/src/services/PokerGame.js:1198`
**Parameters:**
- `player` (Object): Player object
**Returns:** Number (0-1, where 1 is strongest)

---

#### `getPlayerPosition(player)`
**Purpose:** Get player's position relative to dealer (early/middle/late)
**Location:** `backend/src/services/PokerGame.js:1243`
**Parameters:**
- `player` (Object): Player object
**Returns:** String ('early', 'middle', 'late')

---

#### `processAIAction()`
**Purpose:** Process the current AI player's action
**Location:** `backend/src/services/PokerGame.js:1274`
**Returns:** Object with AI action details or null

---

#### `isGameFinished()`
**Purpose:** Check if the game is finished
**Location:** `backend/src/services/PokerGame.js:1322`
**Returns:** Boolean

---

#### `getGameResults()`
**Purpose:** Get the results of the finished game
**Location:** `backend/src/services/PokerGame.js:1337`
**Returns:** Object with game results or null

---

#### `evaluateHand(cards)`
**Purpose:** Evaluate a poker hand (wrapper for evaluateBestHand)
**Location:** `backend/src/services/PokerGame.js:1345`
**Parameters:**
- `cards` (Array<Card>): Cards to evaluate
**Returns:** Hand evaluation object

---

#### `getGameState()`
**Purpose:** Get complete game state for broadcasting to clients
**Location:** `backend/src/services/PokerGame.js:1349`
**Returns:** Object with complete game state including:
- `roomId`, `phase`, `pot`, `currentBet`, `minRaise`
- `currentPlayerIndex`, `dealerIndex`, `maxPlayers`
- `communityCards`, `players`, `desiredSeatCount`
- `gameStarted`, `gameFinished`, `lastAction`

---

#### `getPlayers()`
**Purpose:** Get list of all players in the game
**Location:** `backend/src/services/PokerGame.js:1372`
**Returns:** Array of player objects

---

#### `getPlayerCount()`
**Purpose:** Get total number of players
**Location:** `backend/src/services/PokerGame.js:1382`
**Returns:** Number

---

## Socket Communication

### File: `backend/src/socket/gameSocket.js`

Handles real-time Socket.IO communication for multiplayer gameplay.

### Functions

#### `broadcastPlayerList(io, roomId, game)`
**Purpose:** Broadcast updated player list to all clients in a room
**Location:** `backend/src/socket/gameSocket.js:10`
**Parameters:**
- `io` (SocketIO.Server): Socket.IO server instance
- `roomId` (String): Room ID
- `game` (PokerGame): Game instance

---

#### `updateSeatCount(socket, io, computeDesired)`
**Purpose:** Update the desired seat count for a game room
**Location:** `backend/src/socket/gameSocket.js:34`
**Parameters:**
- `socket` (Socket): Client socket
- `io` (SocketIO.Server): Socket.IO server instance
- `computeDesired` (Function): Function to compute desired seat count
**Returns:** Number (updated seat count) or null on error

---

#### `adjustAIPlayers(socket, io, delta)`
**Purpose:** Add or remove AI players from the game
**Location:** `backend/src/socket/gameSocket.js:90`
**Parameters:**
- `socket` (Socket): Client socket
- `io` (SocketIO.Server): Socket.IO server instance
- `delta` (Number): +1 to add AI, -1 to remove AI
**Returns:** Number (new player count) or null on error

---

#### `handleSocketConnection(socket, io)`
**Purpose:** Main socket connection handler - sets up all socket event listeners
**Location:** `backend/src/socket/gameSocket.js:175`
**Parameters:**
- `socket` (Socket): Client socket
- `io` (SocketIO.Server): Socket.IO server instance

**Socket Events Handled:**
- `authenticate` - Authenticate user with JWT token
- `join_room` - Join a game room
- `leave_room` - Leave current room
- `game_action` - Player game action (fold/call/raise/etc)
- `start_game` - Start the game (host only)
- `reset_game` - Reset game to waiting state
- `set_ai_count` - Set total player count (adjusts AI)
- `add_ai` - Add one AI player
- `remove_ai` - Remove one AI player
- `send_chat_message` - Send chat message
- `disconnect` - Handle disconnection

---

#### `handleLeaveRoom(socket, io)`
**Purpose:** Handle player leaving a room (cleanup, AI sync, notifications)
**Location:** `backend/src/socket/gameSocket.js:525`
**Parameters:**
- `socket` (Socket): Client socket
- `io` (SocketIO.Server): Socket.IO server instance

---

#### `processAIActions(game, roomId, io)`
**Purpose:** Process all queued AI actions sequentially with delays
**Location:** `backend/src/socket/gameSocket.js:575`
**Parameters:**
- `game` (PokerGame): Game instance
- `roomId` (String): Room ID
- `io` (SocketIO.Server): Socket.IO server instance
**Note:** Uses 5-second delays between AI actions for better UX

---

#### `handleGameFinish(game, roomId, io)`
**Purpose:** Handle game completion (update stats, achievements, auto-start next hand)
**Location:** `backend/src/socket/gameSocket.js:640`
**Parameters:**
- `game` (PokerGame): Game instance
- `roomId` (String): Room ID
- `io` (SocketIO.Server): Socket.IO server instance

---

## User Model

### File: `backend/src/models/User.js`

Database model for user management.

### User Class (Static Methods)

#### `User.create({ id, username, password, chips })`
**Purpose:** Create a new user in the database
**Location:** `backend/src/models/User.js:4`
**Parameters:**
- `id` (String): Unique user ID (UUID)
- `username` (String): Username
- `password` (String): Hashed password
- `chips` (Number): Starting chip count (default: 1000)
**Returns:** Promise<User object>

---

#### `User.findById(id)`
**Purpose:** Find user by ID
**Location:** `backend/src/models/User.js:13`
**Parameters:**
- `id` (String): User ID
**Returns:** Promise<User object or undefined>

---

#### `User.findByUsername(username)`
**Purpose:** Find user by username
**Location:** `backend/src/models/User.js:18`
**Parameters:**
- `username` (String): Username
**Returns:** Promise<User object or undefined>

---

#### `User.updateLastLogin(id)`
**Purpose:** Update user's last login timestamp
**Location:** `backend/src/models/User.js:23`
**Parameters:**
- `id` (String): User ID
**Returns:** Promise<void>

---

#### `User.updateProfile(id, { username })`
**Purpose:** Update user profile information
**Location:** `backend/src/models/User.js:32`
**Parameters:**
- `id` (String): User ID
- `username` (String): New username
**Returns:** Promise<User object>

---

#### `User.updateChips(id, chips)`
**Purpose:** Update user's chip count
**Location:** `backend/src/models/User.js:42`
**Parameters:**
- `id` (String): User ID
- `chips` (Number): New chip count
**Returns:** Promise<User object>

---

#### `User.updateGameStats(id, { gamesPlayed, gamesWon, chipsWon, chipsLost })`
**Purpose:** Update user's game statistics
**Location:** `backend/src/models/User.js:52`
**Parameters:**
- `id` (String): User ID
- `gamesPlayed` (Number): Number of games to add
- `gamesWon` (Number): Number of wins to add
- `chipsWon` (Number): Chips won (default: 0)
- `chipsLost` (Number): Chips lost (default: 0)
**Returns:** Promise<User object>

---

#### `User.getLeaderboard(orderBy, limit)`
**Purpose:** Get leaderboard of top users
**Location:** `backend/src/models/User.js:67`
**Parameters:**
- `orderBy` (String): Sort field ('chips', 'games_won', 'games_played')
- `limit` (Number): Number of results (default: 10)
**Returns:** Promise<Array of User objects>

---

#### `User.findAll()`
**Purpose:** Get all users
**Location:** `backend/src/models/User.js:82`
**Returns:** Promise<Array of User objects>

---

#### `User.deleteById(id)`
**Purpose:** Delete user by ID
**Location:** `backend/src/models/User.js:87`
**Parameters:**
- `id` (String): User ID
**Returns:** Promise<void>

---

#### `User.search(query, limit)`
**Purpose:** Search users by username
**Location:** `backend/src/models/User.js:93`
**Parameters:**
- `query` (String): Search query
- `limit` (Number): Max results (default: 10)
**Returns:** Promise<Array of User objects>

---

#### `User.getStats(id)`
**Purpose:** Get user's game statistics
**Location:** `backend/src/models/User.js:105`
**Parameters:**
- `id` (String): User ID
**Returns:** Promise<Stats object> with:
- `gamesPlayed`, `gamesWon`, `gamesLost`, `winRate`
- `chips`, `totalChipsWon`, `totalChipsLost`

---

#### `User.getAchievements(id)`
**Purpose:** Get user's unlocked achievements
**Location:** `backend/src/models/User.js:123`
**Parameters:**
- `id` (String): User ID
**Returns:** Promise<Array of achievement IDs>

---

#### `User.addAchievement(id, achievementId)`
**Purpose:** Add a single achievement to user
**Location:** `backend/src/models/User.js:136`
**Parameters:**
- `id` (String): User ID
- `achievementId` (String): Achievement ID
**Returns:** Promise<Array of achievement IDs>

---

#### `User.addAchievements(id, achievementIds)`
**Purpose:** Add multiple achievements to user
**Location:** `backend/src/models/User.js:155`
**Parameters:**
- `id` (String): User ID
- `achievementIds` (Array<String>): Achievement IDs
**Returns:** Promise<Array of achievement IDs>

---

## Game Room Model

### File: `backend/src/models/GameRoom.js`

Database model for game room management.

### GameRoom Class (Static Methods)

#### `GameRoom.create({ id, name, creatorId, maxPlayers, smallBlind, bigBlind })`
**Purpose:** Create a new game room
**Location:** `backend/src/models/GameRoom.js:4`
**Parameters:**
- `id` (String): Room ID
- `name` (String): Room name
- `creatorId` (String): Creator user ID
- `maxPlayers` (Number): Max players (default: 6)
- `smallBlind` (Number): Small blind (default: 10)
- `bigBlind` (Number): Big blind (default: 20)
**Returns:** Promise<GameRoom object>

---

#### `GameRoom.findById(id)`
**Purpose:** Find room by ID
**Location:** `backend/src/models/GameRoom.js:13`
**Parameters:**
- `id` (String): Room ID
**Returns:** Promise<GameRoom object or undefined>

---

#### `GameRoom.findAll()`
**Purpose:** Get all game rooms with creator info
**Location:** `backend/src/models/GameRoom.js:18`
**Returns:** Promise<Array of GameRoom objects>

---

#### `GameRoom.findByStatus(status)`
**Purpose:** Find rooms by status
**Location:** `backend/src/models/GameRoom.js:28`
**Parameters:**
- `status` (String): Room status ('waiting', 'playing', 'finished')
**Returns:** Promise<Array of GameRoom objects>

---

#### `GameRoom.updateStatus(id, status)`
**Purpose:** Update room status
**Location:** `backend/src/models/GameRoom.js:39`
**Parameters:**
- `id` (String): Room ID
- `status` (String): New status
**Returns:** Promise<GameRoom object>

---

#### `GameRoom.updatePlayers(id, players)`
**Purpose:** Update room's player list
**Location:** `backend/src/models/GameRoom.js:49`
**Parameters:**
- `id` (String): Room ID
- `players` (Array): Player objects
**Returns:** Promise<GameRoom object>

---

#### `GameRoom.updateGameState(id, gameState)`
**Purpose:** Update room's game state
**Location:** `backend/src/models/GameRoom.js:60`
**Parameters:**
- `id` (String): Room ID
- `gameState` (Object): Game state object
**Returns:** Promise<GameRoom object>

---

#### `GameRoom.updateCreator(id, creatorId)`
**Purpose:** Update room creator (used when original creator leaves)
**Location:** `backend/src/models/GameRoom.js:71`
**Parameters:**
- `id` (String): Room ID
- `creatorId` (String): New creator user ID
**Returns:** Promise<GameRoom object>

---

#### `GameRoom.deleteById(id)`
**Purpose:** Delete room by ID
**Location:** `backend/src/models/GameRoom.js:81`
**Parameters:**
- `id` (String): Room ID
**Returns:** Promise<void>

---

#### `GameRoom.findByCreator(creatorId)`
**Purpose:** Find all rooms created by a user
**Location:** `backend/src/models/GameRoom.js:86`
**Parameters:**
- `creatorId` (String): Creator user ID
**Returns:** Promise<Array of GameRoom objects>

---

#### `GameRoom.cleanupExpiredRooms()`
**Purpose:** Delete waiting rooms older than 1 hour
**Location:** `backend/src/models/GameRoom.js:96`
**Returns:** Promise<void>

---

#### `GameRoom.getRoomStats()`
**Purpose:** Get statistics about all rooms
**Location:** `backend/src/models/GameRoom.js:106`
**Returns:** Promise<Object> with:
- `total_rooms`, `waiting_rooms`, `playing_rooms`, `finished_rooms`

---

## Database Service

### File: `backend/src/models/database.js`

SQLite database connection and query management.

### Database Class Methods

#### `connect()`
**Purpose:** Connect to SQLite database
**Location:** `backend/src/models/database.js:22`
**Returns:** Promise<void>

---

#### `initTables()`
**Purpose:** Initialize database tables and indexes
**Location:** `backend/src/models/database.js:36`
**Returns:** Promise<void>
**Creates Tables:**
- `users` - User accounts and stats
- `game_rooms` - Game room data
- `game_records` - Game history
- `user_game_records` - Individual player game records

---

#### `run(sql, params)`
**Purpose:** Execute SQL command (INSERT, UPDATE, DELETE)
**Location:** `backend/src/models/database.js:135`
**Parameters:**
- `sql` (String): SQL query
- `params` (Array): Query parameters
**Returns:** Promise<{ id, changes }>

---

#### `get(sql, params)`
**Purpose:** Execute SQL query and get single row
**Location:** `backend/src/models/database.js:149`
**Parameters:**
- `sql` (String): SQL query
- `params` (Array): Query parameters
**Returns:** Promise<Object or undefined>

---

#### `all(sql, params)`
**Purpose:** Execute SQL query and get all rows
**Location:** `backend/src/models/database.js:163`
**Parameters:**
- `sql` (String): SQL query
- `params` (Array): Query parameters
**Returns:** Promise<Array of objects>

---

#### `close()`
**Purpose:** Close database connection
**Location:** `backend/src/models/database.js:177`
**Returns:** Promise<void>

---

## Achievements Service

### File: `backend/src/services/achievements.js`

Achievement system for player rewards.

### Achievement Definitions (ACHIEVEMENTS)

**Location:** `backend/src/services/achievements.js:7`

**Achievement Categories:**
1. **Getting Started**: FIRST_GAME, BEGINNER, VETERAN, MASTER
2. **Winning**: FIRST_WIN, WINNER, CHAMPION
3. **Win Rate**: LUCKY_STREAK, HOT_HAND
4. **Chips**: CHIP_COLLECTOR, HIGH_ROLLER, MILLIONAIRE
5. **Special**: ALL_IN_KING, BLUFF_MASTER, COMEBACK_KING

Each achievement has:
- `id`, `name`, `description`, `icon`, `condition` (function), `reward` (chips)

---

### Functions

#### `checkAchievements(userStats, unlockedAchievements)`
**Purpose:** Check which achievements a player has newly unlocked
**Location:** `backend/src/services/achievements.js:163`
**Parameters:**
- `userStats` (Object): User statistics object
- `unlockedAchievements` (Array): Already unlocked achievement IDs
**Returns:** Array of newly unlocked achievement objects

---

#### `calculateAchievementRewards(achievementIds)`
**Purpose:** Calculate total reward chips from achievements
**Location:** `backend/src/services/achievements.js:186`
**Parameters:**
- `achievementIds` (Array<String>): Achievement IDs
**Returns:** Number (total reward chips)

---

#### `getAchievementProgress(achievementId, userStats)`
**Purpose:** Get progress toward a specific achievement
**Location:** `backend/src/services/achievements.js:199`
**Parameters:**
- `achievementId` (String): Achievement ID
- `userStats` (Object): User statistics
**Returns:** Object with `{ achievement, current, target, percentage, unlocked }`

---

## Authentication Routes

### File: `backend/src/routes/auth.js`

Express routes for user authentication.

### Routes

#### `POST /api/auth/register`
**Purpose:** Register a new user account
**Location:** `backend/src/routes/auth.js:10`
**Request Body:**
- `username` (String): 3-20 characters
- `password` (String): Minimum 6 characters
**Response:** JWT token and user object
**Status Codes:**
- 201: Success
- 400: Invalid input
- 409: Username already exists
- 500: Server error

---

#### `POST /api/auth/login`
**Purpose:** Login to existing account
**Location:** `backend/src/routes/auth.js:80`
**Request Body:**
- `username` (String)
- `password` (String)
**Response:** JWT token and user object
**Status Codes:**
- 200: Success
- 401: Invalid credentials
- 500: Server error

---

#### `POST /api/auth/verify`
**Purpose:** Verify JWT token validity
**Location:** `backend/src/routes/auth.js:138`
**Headers:**
- `Authorization: Bearer <token>`
**Response:** User object
**Status Codes:**
- 200: Valid token
- 401: Invalid/expired token
- 500: Server error

---

## Game Routes

### File: `backend/src/routes/game.js`

Express routes for game room management.

**All routes require authentication** (JWT token in Authorization header)

### Routes

#### `GET /api/game/rooms`
**Purpose:** Get list of all game rooms
**Location:** `backend/src/routes/game.js:8`
**Response:** Array of room objects
**Status Codes:**
- 200: Success
- 500: Server error

---

#### `POST /api/game/rooms`
**Purpose:** Create a new game room
**Location:** `backend/src/routes/game.js:19`
**Request Body:**
- `name` (String): Room name
- `maxPlayers` (Number): Max players (default: 6)
- `smallBlind` (Number): Small blind (default: 10)
- `bigBlind` (Number): Big blind (default: 20)
**Response:** Created room object
**Status Codes:**
- 201: Created
- 400: Invalid input
- 500: Server error

---

#### `POST /api/game/rooms/:roomId/join`
**Purpose:** Prepare to join a game room (actual join via Socket.IO)
**Location:** `backend/src/routes/game.js:51`
**Parameters:**
- `roomId` (String): Room ID
**Response:** Room ID confirmation
**Status Codes:**
- 200: Success
- 400: Room full or game in progress
- 404: Room not found
- 500: Server error

---

#### `POST /api/game/rooms/:roomId/leave`
**Purpose:** Leave a game room (actual leave via Socket.IO)
**Location:** `backend/src/routes/game.js:88`
**Parameters:**
- `roomId` (String): Room ID
**Response:** Confirmation message
**Status Codes:**
- 200: Success
- 500: Server error

---

#### `GET /api/game/rooms/:roomId`
**Purpose:** Get room details
**Location:** `backend/src/routes/game.js:105`
**Parameters:**
- `roomId` (String): Room ID
**Response:** Room object
**Status Codes:**
- 200: Success
- 404: Room not found
- 500: Server error

---

## User Routes

### File: `backend/src/routes/user.js`

Express routes for user profile and statistics.

**All routes require authentication** (JWT token in Authorization header)

### Routes

#### `GET /api/user/profile`
**Purpose:** Get current user's profile
**Location:** `backend/src/routes/user.js:7`
**Response:** User profile object
**Status Codes:**
- 200: Success
- 404: User not found
- 500: Server error

---

#### `PUT /api/user/profile`
**Purpose:** Update user profile
**Location:** `backend/src/routes/user.js:36`
**Request Body:**
- `username` (String): New username (3-20 characters)
**Response:** Updated user object
**Status Codes:**
- 200: Success
- 400: Invalid input
- 409: Username already taken
- 500: Server error

---

#### `GET /api/user/stats`
**Purpose:** Get user's game statistics
**Location:** `backend/src/routes/user.js:77`
**Response:** Statistics object with:
- `gamesPlayed`, `gamesWon`, `gamesLost`, `winRate`
- `chips`, `totalChipsWon`, `totalChipsLost`
**Status Codes:**
- 200: Success
- 404: User not found
- 500: Server error

---

#### `GET /api/user/leaderboard`
**Purpose:** Get leaderboard rankings
**Location:** `backend/src/routes/user.js:105`
**Query Parameters:**
- `type` (String): 'chips', 'wins', or 'winrate' (default: 'chips')
- `limit` (Number): Number of results (default: 10)
**Response:** Array of ranked users
**Status Codes:**
- 200: Success
- 500: Server error

---

#### `POST /api/user/relief-fund`
**Purpose:** Claim relief fund (10,000 chips when below 1,000)
**Location:** `backend/src/routes/user.js:137`
**Response:** Updated chip count and relief amount
**Status Codes:**
- 200: Success
- 400: Not eligible (chips >= 1000)
- 404: User not found
- 500: Server error

---

## Authentication Middleware

### File: `backend/src/middleware/auth.js`

JWT authentication middleware.

### Middleware Functions

#### `authenticateToken(req, res, next)`
**Purpose:** Verify JWT token and protect routes
**Location:** `backend/src/middleware/auth.js:3`
**Headers Required:**
- `Authorization: Bearer <token>`
**Adds to Request:**
- `req.user` (Object): Decoded token with `userId` and `username`
**Status Codes:**
- 401: No token provided
- 403: Invalid or expired token
- 500: Server error

---

#### `optionalAuth(req, res, next)`
**Purpose:** Optional authentication (continues even without valid token)
**Location:** `backend/src/middleware/auth.js:37`
**Headers:**
- `Authorization: Bearer <token>` (optional)
**Adds to Request:**
- `req.user` (Object or null): Decoded token if valid, null otherwise

---

## Error Handler Middleware

### File: `backend/src/middleware/errorHandler.js`

Global error handling middleware.

### Middleware Function

#### `errorHandler(error, req, res, next)`
**Purpose:** Centralized error handling for all routes
**Location:** `backend/src/middleware/errorHandler.js:1`
**Handles:**
- Database errors (SQLITE_CONSTRAINT)
- JWT errors (JsonWebTokenError, TokenExpiredError)
- Validation errors
- Generic errors
**Logs:**
- Error message, stack trace, URL, method, timestamp
**Response:**
- JSON error object with appropriate status code
- Stack trace included in development mode only

---

## Summary

This backend implements a complete Texas Hold'em poker platform with:

- **User Management**: Registration, login, profiles, statistics, leaderboards
- **Game Engine**: Full poker rules including betting, hand evaluation, AI players
- **Real-time Multiplayer**: Socket.IO for live gameplay
- **Room System**: Create/join rooms, manage players
- **Achievements**: Unlockable achievements with chip rewards
- **Database**: SQLite with full CRUD operations
- **Security**: JWT authentication, password hashing, input validation

### Key Statistics:
- **Total Functions/Methods**: 100+
- **API Endpoints**: 14
- **Socket Events**: 10
- **Database Tables**: 4
- **Achievement Types**: 13
