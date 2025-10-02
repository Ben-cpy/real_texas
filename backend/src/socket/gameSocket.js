import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { GameRoom } from '../models/GameRoom.js'
import { PokerGame } from '../services/PokerGame.js'
import { checkAchievements } from '../services/achievements.js'

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
  await GameRoom.updateGameState(roomId, game.getSerializableState())

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
  await GameRoom.updateGameState(roomId, game.getSerializableState())

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
        // If game is not in memory, try to load from database
        if (room.game_state) {
          try {
            const savedState = JSON.parse(room.game_state)
            if (savedState) {
              game = PokerGame.fromSerializableState(savedState)
              console.log(`Reconstructed game ${roomId} from database state.`)
            }
          } catch (e) {
            console.error(`Failed to parse or reconstruct game state for room ${roomId}:`, e)
            // If reconstruction fails, we'll create a new game instance below
          }
        }

        // If game still doesn't exist (not in memory, no valid state in DB), create a new one
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
          console.log(`Created new game instance for room ${roomId}`)
        }
        activeRooms.set(roomId, game)
      } else if (isSinglePlayerRoom) {
        game.singlePlayerMode = true
      }

      const user = await User.findById(socket.userId)

      // Check if room is full before adding player
      if (game.getPlayerCount() >= game.maxPlayers) {
        socket.emit('error', { error: 'Room is full' })
        return
      }

      // Add player to game
      const success = game.addPlayer({
        id: user.id,
        name: user.username,
        chips: user.chips,
        socketId: socket.id
      })

      if (!success) {
        socket.emit('error', { error: 'Unable to join room. You might already be in it.' })
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
      await GameRoom.updateGameState(roomId, game.getSerializableState())

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

      console.log(`Player ${user.username} (Socket: ${socket.id}) joined room ${roomId}`)

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
        await GameRoom.updateGameState(socket.currentRoomId, game.getSerializableState())

        // Process AI actions (1 second delay to let users see the process)
        console.log('Preparing to process AI actions...')
        setTimeout(async () => {
          console.log('Starting AI action processing')
          await processAIActions(game, socket.currentRoomId, io)
        }, AI_ACTION_DELAY_MS)

        // Check if game is finished
        if (game.isGameFinished()) {
          await handleGameFinish(game, socket.currentRoomId, io)
        }
      } else {
        socket.emit('action_error', { error: result.error })
      }

    } catch (error) {
      console.error('Game action error:', error)
      socket.emit('error', { error: 'Action failed' })
    }
  })

  // Start game
  socket.on('start_game', async () => {
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

      const room = await GameRoom.findById(socket.currentRoomId)
      if (room.creator_id !== socket.userId) {
        socket.emit('error', { error: 'Only the host can start the game' })
        return
      }

      let gameState = null
      let actionDescription = 'Game started'

      if (!game.gameStarted) {
        const result = game.startGame()
        if (!result.success) {
          socket.emit('error', { error: result.error })
          return
        }
        gameState = game.getGameState()
      } else if (game.gameFinished) {
        const nextHand = game.startNextHand()
        if (!nextHand.success) {
          await GameRoom.updateStatus(socket.currentRoomId, 'waiting')
          await GameRoom.updatePlayers(socket.currentRoomId, game.getPlayers())
          const waitingState = game.getSerializableState()
          await GameRoom.updateGameState(socket.currentRoomId, waitingState)
          broadcastPlayerList(io, socket.currentRoomId, game)
          io.to(socket.currentRoomId).emit('game_update', {
            gameState: game.getGameState(),
            lastAction: null,
            message: nextHand.error
          })
          socket.emit('error', { error: nextHand.error || 'Unable to start next hand' })
          return
        }
        gameState = nextHand.gameState
        actionDescription = 'Next hand started'
      } else {
        socket.emit('error', { error: 'Game is already in progress' })
        return
      }

      await GameRoom.updateStatus(socket.currentRoomId, 'playing')
      await GameRoom.updatePlayers(socket.currentRoomId, game.getPlayers())
      await GameRoom.updateGameState(socket.currentRoomId, game.getSerializableState())

      io.to(socket.currentRoomId).emit('game_started', {
        gameState
      })
      io.to(socket.currentRoomId).emit('game_update', {
        gameState,
        lastAction: null
      })
      broadcastPlayerList(io, socket.currentRoomId, game)

      await processAIActions(game, socket.currentRoomId, io)

      console.log(`${actionDescription} in room ${socket.currentRoomId}`)

    } catch (error) {
      console.error('Start game error:', error)
      socket.emit('error', { error: 'Failed to start game' })
    }
  })

  // Reset game
  socket.on('reset_game', async () => {
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

      // Reset game state
      game.gameStarted = false
      game.gameFinished = false
      game.phase = 'waiting'
      game.pot = 0
      game.currentBet = 0
      game.currentPlayerIndex = 0
      game.communityCards = []
      game.actionHistory = []

      // Reset player state
      game.players.forEach(player => {
        player.cards = []
        player.currentBet = 0
        player.totalBet = 0
        player.folded = false
        player.allIn = false
        player.active = player.chips > 0
      })

      // Update room status
      await GameRoom.updateStatus(socket.currentRoomId, 'waiting')
      await GameRoom.updateGameState(socket.currentRoomId, game.getSerializableState())

      // Broadcast game reset
      io.to(socket.currentRoomId).emit('game_reset', {
        gameState: game.getGameState(),
        message: 'Game has been reset'
      })

      console.log(`Game reset in room ${socket.currentRoomId}`)

    } catch (error) {
      console.error('Reset game error:', error)
      socket.emit('error', { error: 'Failed to reset game' })
    }
  })

  socket.on('set_ai_count', async (data) => {
    const requested = parseInt(
      data?.totalPlayers ?? data?.desiredSeatCount ?? data?.count,
      10
    )
    const updated = await updateSeatCount(socket, io, () => requested)
    if (updated !== null) {
      console.log(`Room ${socket.currentRoomId} adjusted target seat count to ${updated} (requested: ${requested})`)
    }
  })

  socket.on('add_ai', async () => {
    const result = await adjustAIPlayers(socket, io, 1)
    if (result !== null) {
      console.log(`Room ${socket.currentRoomId} added AI, current player count: ${result}`)
    }
  })

  socket.on('remove_ai', async () => {
    const result = await adjustAIPlayers(socket, io, -1)
    if (result !== null) {
      console.log(`Room ${socket.currentRoomId} removed AI, current player count: ${result}`)
    }
  })

  // Chat message
  socket.on('send_chat_message', async (data) => {
    try {
      if (!socket.userId || !socket.currentRoomId) {
        socket.emit('error', { error: 'Please join a room first' })
        return
      }

      const { message } = data
      if (!message || message.trim().length === 0) {
        return
      }

      // Message length limit
      const trimmedMessage = message.trim().substring(0, 200)

      // Broadcast chat message to all players in room
      io.to(socket.currentRoomId).emit('chat_message', {
        userId: socket.userId,
        username: socket.username,
        message: trimmedMessage,
        timestamp: Date.now()
      })

      console.log(`Chat message [${socket.currentRoomId}] ${socket.username}: ${trimmedMessage}`)

    } catch (error) {
      console.error('Send chat message error:', error)
      socket.emit('error', { error: 'Failed to send message' })
    }
  })

  // Disconnect
  socket.on('disconnect', async () => {
    console.log(`Socket disconnected: ${socket.id}`)
    await handleLeaveRoom(socket, io)
  })
}

// Handle player leaving room
const handleLeaveRoom = async (socket, io) => {
  if (!socket.currentRoomId || !socket.userId) {
    return
  }

  const roomId = socket.currentRoomId
  const game = activeRooms.get(roomId)

  if (game) {
    const leavingPlayer = Array.isArray(game.players) ? game.players.find(player => player.id === socket.userId) : null
    const leavingPlayerName = leavingPlayer?.name || null

    game.removePlayer(socket.userId)

    const realPlayers = typeof game.countRealPlayers === 'function'
      ? game.countRealPlayers()
      : game.getPlayers().filter(player => !player.isAI).length

    if (realPlayers === 0) {
      activeRooms.delete(roomId)
      await GameRoom.updatePlayers(roomId, [])
      await GameRoom.updateGameState(roomId, null)
      await GameRoom.updateStatus(roomId, 'waiting')
      broadcastPlayerList(io, roomId, null)
      console.log(`Room ${roomId} has been cleared`)
    } else {
      if (!game.gameStarted && typeof game.syncAIPlayers === 'function') {
        game.syncAIPlayers()
      }

      await GameRoom.updatePlayers(roomId, game.getPlayers())
      await GameRoom.updateGameState(roomId, game.getSerializableState())

      io.to(roomId).emit('player_left', {
        playerId: socket.userId,
        playerName: leavingPlayerName,
        players: game.getPlayers(),
        gameState: game.getGameState()
      })
      broadcastPlayerList(io, roomId, game)
    }
  }

  socket.leave(roomId)
  socket.currentRoomId = null
  console.log(`Player ${socket.username} left room ${roomId}`)
}


// Process consecutive AI actions
const processAIActions = async (game, roomId, io) => {
  try {
    const playerCount = typeof game.getPlayers === 'function' ? game.getPlayers().length : (game.players?.length || 0)
    const maxAIActions = Math.max(60, playerCount * 12) // Prevent infinite loops and ensure sufficient AI action attempts
    let aiActionCount = 0

    while (aiActionCount < maxAIActions) {
      const aiResult = game.processAIAction()

      if (!aiResult) {
        // No AI needs to act, or game is finished
        break
      }

      aiActionCount++

      // Broadcast AI action
      if (aiResult.actionSummary) {
        io.to(roomId).emit('ai_action', aiResult.actionSummary)
      } else {
        io.to(roomId).emit('ai_action', {
          playerId: aiResult.playerId,
          playerName: aiResult.playerName,
          action: aiResult.action,
          amount: aiResult.amount ?? 0
        })
      }

      // Broadcast game state update
      io.to(roomId).emit('game_update', {
        gameState: aiResult.gameState,
        lastAction: aiResult.actionSummary || {
          action: aiResult.action,
          type: aiResult.action,
          playerId: aiResult.playerId,
          playerName: aiResult.playerName,
          amount: aiResult.amount ?? 0,
          timestamp: Date.now(),
          phase: aiResult.gameState?.phase
        }
      })

      // Update game state in database
      await GameRoom.updateGameState(roomId, game.getSerializableState())

      // AI action interval delay to let players see AI actions clearly
      await new Promise(resolve => setTimeout(resolve, AI_ACTION_DELAY_MS))

      // Check if game is finished
      if (game.isGameFinished()) {
        await handleGameFinish(game, roomId, io)
        break
      }
    }

    if (aiActionCount >= maxAIActions) {
      console.warn(`AI action loop limit reached for room ${roomId} after ${aiActionCount} actions`)
    }

  } catch (error) {
    console.error('AI action processing error:', error)
  }
}

// Handle game finish
const handleGameFinish = async (game, roomId, io) => {
  try {
    const results = game.getGameResults()

    if (!results) {
      console.warn(`Game results for room ${roomId} are empty, cannot settle`)
      return
    }

    const playerAchievements = {}

    for (const player of results.players) {
      const playerState = Array.isArray(game.players) ? game.players.find(p => p.id === player.id) : null
      if (playerState?.isAI) {
        continue
      }

      await User.updateChips(player.id, player.finalChips)

      const isWinner = Array.isArray(results.winners)
        ? results.winners.some((winner) => winner.id === player.id)
        : results.winner && results.winner.id === player.id

      await User.updateGameStats(player.id, {
        gamesPlayed: 1,
        gamesWon: isWinner ? 1 : 0,
        chipsWon: Math.max(0, player.chipsChange),
        chipsLost: Math.max(0, -player.chipsChange)
      })

      const userStats = await User.getStats(player.id)
      const userAchievements = await User.getAchievements(player.id)
      const newAchievements = checkAchievements(userStats, userAchievements)

      if (newAchievements.length > 0) {
        const achievementIds = newAchievements.map(a => a.id)
        await User.addAchievements(player.id, achievementIds)

        const totalReward = newAchievements.reduce((sum, a) => sum + a.reward, 0)
        if (totalReward > 0) {
          const updatedUser = await User.findById(player.id)
          await User.updateChips(player.id, updatedUser.chips + totalReward)
        }

        playerAchievements[player.id] = newAchievements
      }
    }

    const finalState = game.getGameState()

    await GameRoom.updateStatus(roomId, 'finished')
    await GameRoom.updatePlayers(roomId, game.getPlayers())
    await GameRoom.updateGameState(roomId, game.getSerializableState())

    io.to(roomId).emit('game_finished', {
      results,
      winner: results.winner,
      winners: Array.isArray(results.winners) ? results.winners : (results.winner ? [results.winner] : []),
      pot: results.pot,
      gameState: finalState
    })

    broadcastPlayerList(io, roomId, game)

    for (const [playerId, achievements] of Object.entries(playerAchievements)) {
      io.to(roomId).emit('achievements_unlocked', {
        playerId,
        achievements: achievements.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          icon: a.icon,
          reward: a.reward
        }))
      })
    }

    console.log(`Game finished in room ${roomId}, winner: ${results.winner.name}`)

  } catch (error) {
    console.error('Handle game finish error:', error)
  }
}



