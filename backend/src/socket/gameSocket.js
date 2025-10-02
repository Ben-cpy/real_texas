import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { GameRoom } from '../models/GameRoom.js'
import { PokerGame } from '../services/PokerGame.js'
import { checkAchievements, ACHIEVEMENTS } from '../services/achievements.js'

// Store active game rooms
const activeRooms = new Map()

const broadcastPlayerList = (io, roomId, game) => {
  if (!io) {
    return
  }

  if (!game) {
    io.to(roomId).emit('player_list_updated', {
      players: [],
      desiredSeatCount: 0,
      phase: 'waiting'
    })
    return
  }

  const gameState = game.getGameState()
  io.to(roomId).emit('player_list_updated', {
    players: gameState.players,
    desiredSeatCount: game.desiredSeatCount || gameState.players.length,
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
    desiredSeatCount: result.desiredSeatCount
  })
  broadcastPlayerList(io, roomId, game)

  return result.desiredSeatCount
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
            maxPlayers: 6,
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
      const maxSeatLimit = room.max_players || 6

      // Get or create game instance
      let game = activeRooms.get(roomId)
      if (!game) {
        game = new PokerGame(roomId, {
          smallBlind: room.small_blind,
          bigBlind: room.big_blind,
          maxPlayers: room.max_players,
          desiredSeatCount: isSinglePlayerRoom ? Math.min(maxSeatLimit, 6) : Math.max(3, Math.min(maxSeatLimit, 6))
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
        socket.emit('error', { error: '无法加入房间' })
        return
      }

      const currentPlayers = game.getPlayers()
      const realPlayers = currentPlayers.filter(p => !p.isAI)

      if (realPlayers.length === 1 && realPlayers[0].id === user.id) {
        await GameRoom.updateCreator(roomId, user.id)
        console.log(`更新房间 ${roomId} 的房主为: ${user.username}`)
      }

      if (isSinglePlayerRoom && typeof game.setDesiredSeatCount === 'function' && !game.gameStarted) {
        game.setDesiredSeatCount(Math.min(game.maxPlayers || 6, 6))
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

      console.log(`玩家 ${user.username} 加入房间 ${roomId}`)

    } catch (error) {
      console.error('加入房间错误:', error)
      socket.emit('error', { error: '加入房间失败' })
    }
  })

  // 离开房间
  socket.on('leave_room', async () => {
    await handleLeaveRoom(socket, io)
  })

  // 游戏操作
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
        // 广播游戏状态更新
        io.to(socket.currentRoomId).emit('game_update', {
          gameState: game.getGameState(),
          lastAction: result.action
        })

        // 更新数据库中的游戏状态
        await GameRoom.updateGameState(socket.currentRoomId, game.getGameState())

        // 处理AI行动（延迟1秒让用户看到过程）
        console.log('准备处理AI行动...')
        setTimeout(async () => {
          console.log('开始处理AI行动')
          await processAIActions(game, socket.currentRoomId, io)
        }, 1000)

        // 检查游戏是否结束
        if (game.isGameFinished()) {
          await handleGameFinish(game, socket.currentRoomId, io)
        }
      } else {
        socket.emit('action_error', { error: result.error })
      }

    } catch (error) {
      console.error('游戏操作错误:', error)
      socket.emit('error', { error: '操作失败' })
    }
  })

  // 开始游戏
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
        socket.emit('error', { error: '只有房主可以开始游戏' })
        return
      }

      const result = game.startGame()
      if (result.success) {
        // 更新房间状态
        await GameRoom.updateStatus(socket.currentRoomId, 'playing')
        
        // 广播游戏开始
        io.to(socket.currentRoomId).emit('game_started', {
          gameState: game.getGameState()
        })

        await processAIActions(game, socket.currentRoomId, io)

        console.log(`游戏开始: 房间 ${socket.currentRoomId}`)
      } else {
        socket.emit('error', { error: result.error })
      }

    } catch (error) {
      console.error('开始游戏错误:', error)
      socket.emit('error', { error: '开始游戏失败' })
    }
  })

  // 重开游戏
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

      // 重置游戏状态
      game.gameStarted = false
      game.gameFinished = false
      game.phase = 'waiting'
      game.pot = 0
      game.currentBet = 0
      game.currentPlayerIndex = 0
      game.communityCards = []
      game.actionHistory = []

      // 重置玩家状态
      game.players.forEach(player => {
        player.cards = []
        player.currentBet = 0
        player.totalBet = 0
        player.folded = false
        player.allIn = false
        player.active = player.chips > 0
      })

      // 更新房间状态
      await GameRoom.updateStatus(socket.currentRoomId, 'waiting')
      await GameRoom.updateGameState(socket.currentRoomId, game.getGameState())

      // 广播游戏重开
      io.to(socket.currentRoomId).emit('game_reset', {
        gameState: game.getGameState(),
        message: '游戏已重开'
      })

      console.log(`游戏重开: 房间 ${socket.currentRoomId}`)

    } catch (error) {
      console.error('重开游戏错误:', error)
      socket.emit('error', { error: '重开游戏失败' })
    }
  })

  socket.on('set_ai_count', async (data) => {
    const requested = parseInt(
      data?.totalPlayers ?? data?.desiredSeatCount ?? data?.count,
      10
    )
    const updated = await updateSeatCount(socket, io, () => requested)
    if (updated !== null) {
      console.log(`房间 ${socket.currentRoomId} 调整目标座位数至 ${updated} (请求: ${requested})`)
    }
  })

  socket.on('add_ai', async () => {
    const updated = await updateSeatCount(socket, io, (current) => current + 1)
    if (updated !== null) {
      console.log(`房间 ${socket.currentRoomId} 手动添加 AI，目标座位数 ${updated}`)
    }
  })

  socket.on('remove_ai', async () => {
    const updated = await updateSeatCount(socket, io, (current) => current - 1)
    if (updated !== null) {
      console.log(`房间 ${socket.currentRoomId} 移除 AI，目标座位数 ${updated}`)
    }
  })

  // 聊天消息
  socket.on('send_chat_message', async (data) => {
    try {
      if (!socket.userId || !socket.currentRoomId) {
        socket.emit('error', { error: '请先加入房间' })
        return
      }

      const { message } = data
      if (!message || message.trim().length === 0) {
        return
      }

      // 消息长度限制
      const trimmedMessage = message.trim().substring(0, 200)

      // 广播聊天消息到房间内所有玩家
      io.to(socket.currentRoomId).emit('chat_message', {
        userId: socket.userId,
        username: socket.username,
        message: trimmedMessage,
        timestamp: Date.now()
      })

      console.log(`聊天消息 [${socket.currentRoomId}] ${socket.username}: ${trimmedMessage}`)

    } catch (error) {
      console.error('发送聊天消息错误:', error)
      socket.emit('error', { error: '发送消息失败' })
    }
  })

  // 断开连接
  socket.on('disconnect', async () => {
    console.log(`Socket断开连接: ${socket.id}`)
    await handleLeaveRoom(socket, io)
  })
}

// 处理玩家离开房间
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
      console.log(`房间 ${roomId} 已清理`)
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
  console.log(`玩家 ${socket.username} 离开房间 ${roomId}`)
}


// 处理AI连续行动
const processAIActions = async (game, roomId, io) => {
  try {
    const playerCount = typeof game.getPlayers === 'function' ? game.getPlayers().length : (game.players?.length || 0)
    const maxAIActions = Math.max(60, playerCount * 12) // 防止无限循环，并确保足够的AI行动次数
    let aiActionCount = 0

    while (aiActionCount < maxAIActions) {
      const aiResult = game.processAIAction()

      if (!aiResult) {
        // 没有AI需要行动，或者游戏结束
        break
      }

      aiActionCount++

      // 广播AI行动
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

      // 广播游戏状态更新
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

      // 更新数据库中的游戏状态
      await GameRoom.updateGameState(roomId, aiResult.gameState)

      // AI行动间隔 - 5秒延迟让玩家能够看清AI的操作
      await new Promise(resolve => setTimeout(resolve, 5000))
      
      // 检查游戏是否结束
      if (game.isGameFinished()) {
        await handleGameFinish(game, roomId, io)
        break
      }
    }

    if (aiActionCount >= maxAIActions) {
      console.warn(`AI action loop limit reached for room ${roomId} after ${aiActionCount} actions`)
    }

  } catch (error) {
    console.error('AI行动处理错误:', error)
  }
}

// 处理游戏结束
const handleGameFinish = async (game, roomId, io) => {
  try {
    const results = game.getGameResults()

    if (!results) {
      console.warn(`房间 ${roomId} 的游戏结果为空，无法结算`)
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

    console.log(`游戏结束: 房间 ${roomId}, 获胜者 ${results.winner.name}`)

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
        console.error('准备下一局时出错:', error)
      }
    }, 2500)

  } catch (error) {
    console.error('处理游戏结束错误:', error)
  }
}
