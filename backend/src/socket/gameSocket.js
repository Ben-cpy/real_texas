import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { GameRoom } from '../models/GameRoom.js'
import { PokerGame } from '../services/PokerGame.js'
import { checkAchievements, ACHIEVEMENTS } from '../services/achievements.js'

// Store active game rooms
const activeRooms = new Map()

const DEFAULT_MAX_PLAYERS = 10
const MIN_SEAT_COUNT = 4
const DEFAULT_INITIAL_SEATS = 6

const AI_ACTION_DELAY_MS = 1000

const broadcastPlayerList = (io, roomId, game) => {
  if (!io) {
    return
  }

  if (!game) {
    io.to(roomId).emit('player_list_updated', {
      players: [],
      desiredSeatCount: 0,
      maxPlayers: 0,
      phase: 'waiting'
    })
    return
  }

  const gameState = game.getGameState()
  io.to(roomId).emit('player_list_updated', {
    players: gameState.players,
    desiredSeatCount: game.desiredSeatCount || gameState.players.length,
    maxPlayers: game.maxPlayers,
    phase: gameState.phase
  })
}

const updateSeatCount = async (socket, io, computeDesired) => {
  if (!socket.userId || !socket.currentRoomId) {
    socket.emit('error', { error: 'Invalid game state' })
    return null
  }

  const roomId = socket.currentRoomId
  const game = activeRooms.get(roomId)

  if (!game) {
    socket.emit('error', { error: 'Game does not exist' })
    return null
  }

  if (game.gameStarted) {
    socket.emit('error', { error: 'Cannot adjust seats while game is in progress' })
    return null
  }

  if (typeof game.setDesiredSeatCount !== 'function') {
    socket.emit('error', { error: 'Current mode does not support adjusting player count' })
    return null
  }

  const room = await GameRoom.findById(roomId)
  if (room.creator_id !== socket.userId) {
    socket.emit('error', { error: 'Only room creator can adjust player count' })
    return null
  }

  const currentSeatTarget = typeof game.desiredSeatCount === 'number'
    ? game.desiredSeatCount
    : game.getPlayers().length

  let desiredSeatCount = computeDesired(currentSeatTarget, game)
  if (typeof desiredSeatCount !== 'number' || Number.isNaN(desiredSeatCount)) {
    socket.emit('error', { error: 'Invalid player count' })
    return null
  }

  desiredSeatCount = Math.round(desiredSeatCount)

  const result = game.setDesiredSeatCount(desiredSeatCount)

  await GameRoom.updatePlayers(roomId, game.getPlayers())
  await GameRoom.updateGameState(roomId, game.getGameState())

  socket.emit('ai_count_updated', {
    desiredSeatCount: result.desiredSeatCount,
    maxPlayers: game.maxPlayers
  })
  broadcastPlayerList(io, roomId, game)

  return result.desiredSeatCount
}

const adjustAIPlayers = async (socket, io, delta) => {
  if (!socket.userId || !socket.currentRoomId) {
    socket.emit('error', { error: 'Invalid game state' })
    return null
  }

  if (delta === 0) {
    return null
  }

  const roomId = socket.currentRoomId
  const game = activeRooms.get(roomId)

  if (!game) {
    socket.emit('error', { error: 'Game does not exist' })
    return null
  }

  if (game.gameStarted) {
    socket.emit('error', { error: 'Cannot adjust AI while game is in progress' })
    return null
  }

  const room = await GameRoom.findById(roomId)
  if (room.creator_id !== socket.userId) {
    socket.emit('error', { error: 'Only the room host can manage AI players' })
    return null
  }

  let changed = false

  if (delta > 0) {
    const capacity = game.maxPlayers || game.players.length
    if (game.players.length >= capacity) {
      socket.emit('error', { error: 'Table is already full' })
      return null
    }
    changed = game.addAIPlayer()
  } else {
    changed = game.removeAIPlayer()
    if (!changed) {
      socket.emit('error', { error: 'No AI players to remove' })
      return null
    }
  }

  if (!changed) {
    socket.emit('error', { error: 'Unable to adjust AI players' })
    return null
  }

  const realPlayers = typeof game.countRealPlayers === 'function'
    ? game.countRealPlayers()
    : game.getPlayers().filter(player => !player.isAI).length

  const currentPlayers = game.getPlayers().length
  const capacity = game.maxPlayers || currentPlayers

  game.desiredSeatCount = Math.max(realPlayers, Math.min(capacity, currentPlayers))

  if (!game.gameStarted && typeof game.syncAIPlayers === 'function') {
    game.syncAIPlayers()
  }

  const gameState = game.getGameState()

  await GameRoom.updatePlayers(roomId, game.getPlayers())
  await GameRoom.updateGameState(roomId, gameState)

  socket.emit('ai_count_updated', {
    desiredSeatCount: game.desiredSeatCount,
    maxPlayers: game.maxPlayers
  })

  broadcastPlayerList(io, roomId, game)

  io.to(roomId).emit('game_update', {
    gameState,
    lastAction: null
  })

  return currentPlayers
}


export const handleSocketConnection = (socket, io) => {
  console.log(`Socket connected: ${socket.id}`)

  // Verify user identity
  socket.on('authenticate', async (data) => {
    try {
      const { token } = data
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)

      if (!user) {
        socket.emit('auth_error', { error: 'User does not exist' })
        return
      }

      socket.userId = user.id
      socket.username = user.username
      socket.emit('authenticated', {
        user: {
          id: user.id,
          username: user.username,
          chips: user.chips
        }
      })

      console.log(`User ${user.username} authenticated`)

    } catch (error) {
      console.error('Socket authentication error:', error)
      socket.emit('auth_error', { error: 'Authentication failed' })
    }
  })

  // Join room
  socket.on('join_room', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { error: 'Please login first' })
        return
      }

      const { roomId } = data
      let room = await GameRoom.findById(roomId)

      if (!room) {
        // If room doesn't exist, create default room
        try {
          room = await GameRoom.create({
            id: roomId,
            name: 'Default Game Room',
            creatorId: socket.userId,
            maxPlayers: DEFAULT_MAX_PLAYERS,
            smallBlind: 10,
            bigBlind: 20
          })
          console.log(`Created default room: ${roomId}`)
        } catch (createError) {
          console.error('Failed to create room:', createError)
          socket.emit('error', { error: 'Unable to create room' })
          return
        }
      }

      // Get or create game instance
      const isSinglePlayerRoom = roomId === 'default-room'
      const maxSeatLimit = room.max_players || DEFAULT_MAX_PLAYERS
      const initialSeatTarget = Math.min(maxSeatLimit, DEFAULT_INITIAL_SEATS)

      // Get or create game instance
      let game = activeRooms.get(roomId)
      if (!game) {
        game = new PokerGame(roomId, {
          smallBlind: room.small_blind,
          bigBlind: room.big_blind,
          maxPlayers: room.max_players,
          desiredSeatCount: isSinglePlayerRoom
            ? initialSeatTarget
            : Math.max(MIN_SEAT_COUNT, initialSeatTarget)
        })
        game.singlePlayerMode = isSinglePlayerRoom
        activeRooms.set(roomId, game)
      } else if (isSinglePlayerRoom) {
        game.singlePlayerMode = true
      }

      // Add player to game
      const user = await User.findById(socket.userId)
      const success = game.addPlayer({
        id: user.id,
        name: user.username,
        chips: user.chips,
        socketId: socket.id
      })

      if (!success) {
        socket.emit('error', { error: 'Unable to join room' })
        return
      }

      const currentPlayers = game.getPlayers()
      const realPlayers = currentPlayers.filter(p => !p.isAI)

      if (realPlayers.length === 1 && realPlayers[0].id === user.id) {
        await GameRoom.updateCreator(roomId, user.id)
        console.log(`Updated room ${roomId} host to: ${user.username}`)
      }

      if (isSinglePlayerRoom && typeof game.setDesiredSeatCount === 'function' && !game.gameStarted) {
        game.setDesiredSeatCount(Math.max(MIN_SEAT_COUNT, Math.min(game.maxPlayers || DEFAULT_MAX_PLAYERS, DEFAULT_INITIAL_SEATS)))
      }

      socket.join(roomId)
      socket.currentRoomId = roomId

      await GameRoom.updatePlayers(roomId, game.getPlayers())
      await GameRoom.updateGameState(roomId, game.getGameState())

      const updatedRoom = await GameRoom.findById(roomId)

      io.to(roomId).emit('player_joined', {
        player: {
          id: user.id,
          name: user.username,
          chips: user.chips
        },
        players: game.getPlayers(),
        gameState: game.getGameState(),
        roomCreatorId: updatedRoom.creator_id
      })

      broadcastPlayerList(io, roomId, game)

      console.log(`Player ${user.username} joined room ${roomId}`)

    } catch (error) {
      console.error('Join room error:', error)
      socket.emit('error', { error: 'Failed to join room' })
    }
  })

  // Leave room
  socket.on('leave_room', async () => {
    await handleLeaveRoom(socket, io)
  })

  // Game action
  socket.on('game_action', async (data) => {
    try {
      if (!socket.userId || !socket.currentRoomId) {
        socket.emit('error', { error: 'Invalid game state' })
        return
      }

      const game = activeRooms.get(socket.currentRoomId)
      if (!game) {
        socket.emit('error', { error: 'Game does not exist' })
        return
      }

      const { action, amount } = data
      const result = game.handlePlayerAction(socket.userId, action, amount)

      if (result.success) {
        // Broadcast game state update
        io.to(socket.currentRoomId).emit('game_update', {
          gameState: game.getGameState(),
          lastAction: result.action
        })

        // Update game state in database
        await GameRoom.updateGameState(socket.currentRoomId, game.getGameState())

        // Process AI actions (1 second delay to let users see the process)
        console.log('Preparing to process AI actions...')

  } catch (error) {
    console.error('Handle game finish error:', error)
  }
}




