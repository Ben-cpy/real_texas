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
        socket.emit('error', { error: '鏃犳硶鍔犲叆鎴块棿' })
        return
      }

      const currentPlayers = game.getPlayers()
      const realPlayers = currentPlayers.filter(p => !p.isAI)

      if (realPlayers.length === 1 && realPlayers[0].id === user.id) {
        await GameRoom.updateCreator(roomId, user.id)
        console.log(`鏇存柊鎴块棿 ${roomId} 鐨勬埧涓讳负: ${user.username}`)
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

      console.log(`鐜╁ ${user.username} 鍔犲叆鎴块棿 ${roomId}`)

    } catch (error) {
      console.error('鍔犲叆鎴块棿閿欒:', error)
      socket.emit('error', { error: '鍔犲叆鎴块棿澶辫触' })
    }
  })

  // 绂诲紑鎴块棿
  socket.on('leave_room', async () => {
    await handleLeaveRoom(socket, io)
  })

  // 娓告垙鎿嶄綔
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
        // 骞挎挱娓告垙鐘舵€佹洿鏂?
        io.to(socket.currentRoomId).emit('game_update', {
          gameState: game.getGameState(),
          lastAction: result.action
        })

        // 鏇存柊鏁版嵁搴撲腑鐨勬父鎴忕姸鎬?
        await GameRoom.updateGameState(socket.currentRoomId, game.getGameState())

        // 澶勭悊AI琛屽姩锛堝欢杩?绉掕鐢ㄦ埛鐪嬪埌杩囩▼锛?
        console.log('鍑嗗澶勭悊AI琛屽姩...')
        setTimeout(async () => {
          console.log('寮€濮嬪鐞咥I琛屽姩')
          await processAIActions(game, socket.currentRoomId, io)
        }, 1000)

        // 妫€鏌ユ父鎴忔槸鍚︾粨鏉?
        if (game.isGameFinished()) {
          await handleGameFinish(game, socket.currentRoomId, io)
        }
      } else {
        socket.emit('action_error', { error: result.error })
      }

    } catch (error) {
      console.error('娓告垙鎿嶄綔閿欒:', error)
      socket.emit('error', { error: '鎿嶄綔澶辫触' })
    }
  })

  // 寮€濮嬫父鎴?
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
        socket.emit('error', { error: '鍙湁鎴夸富鍙互寮€濮嬫父鎴? })
        return
      }

      const result = game.startGame()
      if (result.success) {
        // 鏇存柊鎴块棿鐘舵€?
        await GameRoom.updateStatus(socket.currentRoomId, 'playing')
        
        // 骞挎挱娓告垙寮€濮?
        io.to(socket.currentRoomId).emit('game_started', {
          gameState: game.getGameState()
        })

        await processAIActions(game, socket.currentRoomId, io)

        console.log(`娓告垙寮€濮? 鎴块棿 ${socket.currentRoomId}`)
      } else {
        socket.emit('error', { error: result.error })
      }

    } catch (error) {
      console.error('寮€濮嬫父鎴忛敊璇?', error)
      socket.emit('error', { error: '寮€濮嬫父鎴忓け璐? })
    }
  })

  // 閲嶅紑娓告垙
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

      // 閲嶇疆娓告垙鐘舵€?
      game.gameStarted = false
      game.gameFinished = false
      game.phase = 'waiting'
      game.pot = 0
      game.currentBet = 0
      game.currentPlayerIndex = 0
      game.communityCards = []
      game.actionHistory = []

      // 閲嶇疆鐜╁鐘舵€?
      game.players.forEach(player => {
        player.cards = []
        player.currentBet = 0
        player.totalBet = 0
        player.folded = false
        player.allIn = false
        player.active = player.chips > 0
      })

      // 鏇存柊鎴块棿鐘舵€?
      await GameRoom.updateStatus(socket.currentRoomId, 'waiting')
      await GameRoom.updateGameState(socket.currentRoomId, game.getGameState())

      // 骞挎挱娓告垙閲嶅紑
      io.to(socket.currentRoomId).emit('game_reset', {
        gameState: game.getGameState(),
        message: '娓告垙宸查噸寮€'
      })

      console.log(`娓告垙閲嶅紑: 鎴块棿 ${socket.currentRoomId}`)

    } catch (error) {
      console.error('閲嶅紑娓告垙閿欒:', error)
      socket.emit('error', { error: '閲嶅紑娓告垙澶辫触' })
    }
  })

  socket.on('set_ai_count', async (data) => {
    const requested = parseInt(
      data?.totalPlayers ?? data?.desiredSeatCount ?? data?.count,
      10
    )
    const updated = await updateSeatCount(socket, io, () => requested)
    if (updated !== null) {
      console.log(`鎴块棿 ${socket.currentRoomId} 璋冩暣鐩爣搴т綅鏁拌嚦 ${updated} (璇锋眰: ${requested})`)
    }
  })

  socket.on('add_ai', async () => {
    const result = await adjustAIPlayers(socket, io, 1)
    if (result !== null) {
      console.log(`鎴块棿 ${socket.currentRoomId} 娣诲姞 AI锛屽綋鍓嶇帺瀹舵暟 ${result}`)
    }
  })

  socket.on('remove_ai', async () => {
    const result = await adjustAIPlayers(socket, io, -1)
    if (result !== null) {
      console.log(`鎴块棿 ${socket.currentRoomId} 绉婚櫎 AI锛屽綋鍓嶇帺瀹舵暟 ${result}`)
    }
  })

  // 鑱婂ぉ娑堟伅
  socket.on('send_chat_message', async (data) => {
    try {
      if (!socket.userId || !socket.currentRoomId) {
        socket.emit('error', { error: '璇峰厛鍔犲叆鎴块棿' })
        return
      }

      const { message } = data
      if (!message || message.trim().length === 0) {
        return
      }

      // 娑堟伅闀垮害闄愬埗
      const trimmedMessage = message.trim().substring(0, 200)

      // 骞挎挱鑱婂ぉ娑堟伅鍒版埧闂村唴鎵€鏈夌帺瀹?
      io.to(socket.currentRoomId).emit('chat_message', {
        userId: socket.userId,
        username: socket.username,
        message: trimmedMessage,
        timestamp: Date.now()
      })

      console.log(`鑱婂ぉ娑堟伅 [${socket.currentRoomId}] ${socket.username}: ${trimmedMessage}`)

    } catch (error) {
      console.error('鍙戦€佽亰澶╂秷鎭敊璇?', error)
      socket.emit('error', { error: '鍙戦€佹秷鎭け璐? })
    }
  })

  // 鏂紑杩炴帴
  socket.on('disconnect', async () => {
    console.log(`Socket鏂紑杩炴帴: ${socket.id}`)
    await handleLeaveRoom(socket, io)
  })
}

// 澶勭悊鐜╁绂诲紑鎴块棿
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
      console.log(`鎴块棿 ${roomId} 宸叉竻鐞哷)
    } else {
      if (!game.gameStarted && typeof game.syncAIPlayers === 'function') {
        game.syncAIPlayers()
      }

      await GameRoom.updatePlayers(roomId, game.getPlayers())
      await GameRoom.updateGameState(roomId, game.getGameState())

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
  console.log(`鐜╁ ${socket.username} 绂诲紑鎴块棿 ${roomId}`)
}


// 澶勭悊AI杩炵画琛屽姩
const processAIActions = async (game, roomId, io) => {
  try {
    const playerCount = typeof game.getPlayers === 'function' ? game.getPlayers().length : (game.players?.length || 0)
    const maxAIActions = Math.max(60, playerCount * 12) // 闃叉鏃犻檺寰幆锛屽苟纭繚瓒冲鐨凙I琛屽姩娆℃暟
    let aiActionCount = 0

    while (aiActionCount < maxAIActions) {
      const aiResult = game.processAIAction()

      if (!aiResult) {
        // 娌℃湁AI闇€瑕佽鍔紝鎴栬€呮父鎴忕粨鏉?
        break
      }

      aiActionCount++

      // 骞挎挱AI琛屽姩
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

      // 骞挎挱娓告垙鐘舵€佹洿鏂?
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

      // 鏇存柊鏁版嵁搴撲腑鐨勬父鎴忕姸鎬?
      await GameRoom.updateGameState(roomId, aiResult.gameState)

      // AI琛屽姩闂撮殧 - 5绉掑欢杩熻鐜╁鑳藉鐪嬫竻AI鐨勬搷浣?
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // 妫€鏌ユ父鎴忔槸鍚︾粨鏉?
      if (game.isGameFinished()) {
        await handleGameFinish(game, roomId, io)
        break
      }
    }

    if (aiActionCount >= maxAIActions) {
      console.warn(`AI action loop limit reached for room ${roomId} after ${aiActionCount} actions`)
    }

  } catch (error) {
    console.error('AI琛屽姩澶勭悊閿欒:', error)
  }
}

// 澶勭悊娓告垙缁撴潫
const handleGameFinish = async (game, roomId, io) => {
  try {
    const results = game.getGameResults()

    if (!results) {
      console.warn(`鎴块棿 ${roomId} 鐨勬父鎴忕粨鏋滀负绌猴紝鏃犳硶缁撶畻`)
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
    await GameRoom.updateGameState(roomId, finalState)

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

    console.log(`娓告垙缁撴潫: 鎴块棿 ${roomId}, 鑾疯儨鑰?${results.winner.name}`)

    setTimeout(async () => {
      try {
        const nextHand = game.startNextHand()

        if (nextHand.success) {
          await GameRoom.updateStatus(roomId, 'playing')
          await GameRoom.updatePlayers(roomId, game.getPlayers())
          await GameRoom.updateGameState(roomId, nextHand.gameState)

          io.to(roomId).emit('game_started', {
            gameState: nextHand.gameState
          })
          io.to(roomId).emit('game_update', {
            gameState: nextHand.gameState,
            lastAction: null
          })
          broadcastPlayerList(io, roomId, game)
          await processAIActions(game, roomId, io)
        } else {
          game.gameStarted = false
          game.gameFinished = false
          game.phase = 'waiting'
          game.communityCards = []
          game.pot = 0
          game.currentBet = 0
          game.currentPlayerIndex = -1
          game.players.forEach(player => {
            player.cards = []
            player.currentBet = 0
            player.totalBet = 0
            player.folded = false
            player.allIn = false
            player.active = player.chips > 0
            player.lastAction = null
          })

          const waitingState = game.getGameState()
          await GameRoom.updateStatus(roomId, 'waiting')
          await GameRoom.updateGameState(roomId, waitingState)
          broadcastPlayerList(io, roomId, game)
          io.to(roomId).emit('game_update', {
            gameState: waitingState,
            lastAction: null,
            message: nextHand.error
          })
        }
      } catch (error) {
        console.error('鍑嗗涓嬩竴灞€鏃跺嚭閿?', error)
      }
    }, 2500)

  } catch (error) {
    console.error('澶勭悊娓告垙缁撴潫閿欒:', error)
  }
}



