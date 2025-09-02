import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { GameRoom } from '../models/GameRoom.js'
import { PokerGame } from '../services/PokerGame.js'

// 存储活跃的游戏房间
const activeRooms = new Map()

export const handleSocketConnection = (socket, io) => {
  console.log(`Socket连接: ${socket.id}`)

  // 验证用户身份
  socket.on('authenticate', async (data) => {
    try {
      const { token } = data
      const decoded = jwt.verify(token, process.env.JWT_SECRET)
      const user = await User.findById(decoded.userId)
      
      if (!user) {
        socket.emit('auth_error', { error: '用户不存在' })
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

      console.log(`用户 ${user.username} 已认证`)

    } catch (error) {
      console.error('Socket认证错误:', error)
      socket.emit('auth_error', { error: '认证失败' })
    }
  })

  // 加入房间
  socket.on('join_room', async (data) => {
    try {
      if (!socket.userId) {
        socket.emit('error', { error: '请先登录' })
        return
      }

      const { roomId } = data
      const room = await GameRoom.findById(roomId)
      
      if (!room) {
        socket.emit('error', { error: '房间不存在' })
        return
      }

      // 获取或创建游戏实例
      let game = activeRooms.get(roomId)
      if (!game) {
        game = new PokerGame(roomId, {
          smallBlind: room.small_blind,
          bigBlind: room.big_blind,
          maxPlayers: room.max_players
        })
        activeRooms.set(roomId, game)
      }

      // 添加玩家到游戏
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

      // 如果是第一个玩家，自动添加AI玩家便于测试
      if (game.getPlayerCount() === 1) {
        game.addAIPlayer()
        console.log(`自动添加AI玩家到房间 ${roomId}`)
      }

      // 加入Socket房间
      socket.join(roomId)
      socket.currentRoomId = roomId

      // 更新数据库中的房间玩家信息
      await GameRoom.updatePlayers(roomId, game.getPlayers())

      // 通知房间内所有玩家
      io.to(roomId).emit('player_joined', {
        player: {
          id: user.id,
          name: user.username,
          chips: user.chips
        },
        players: game.getPlayers(),
        gameState: game.getGameState()
      })

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
        socket.emit('error', { error: '无效的游戏状态' })
        return
      }

      const game = activeRooms.get(socket.currentRoomId)
      if (!game) {
        socket.emit('error', { error: '游戏不存在' })
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
        socket.emit('error', { error: '无效的游戏状态' })
        return
      }

      const game = activeRooms.get(socket.currentRoomId)
      if (!game) {
        socket.emit('error', { error: '游戏不存在' })
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

        console.log(`游戏开始: 房间 ${socket.currentRoomId}`)
      } else {
        socket.emit('error', { error: result.error })
      }

    } catch (error) {
      console.error('开始游戏错误:', error)
      socket.emit('error', { error: '开始游戏失败' })
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
    game.removePlayer(socket.userId)
    
    // 更新数据库中的房间玩家信息
    await GameRoom.updatePlayers(roomId, game.getPlayers())

    // 通知房间内其他玩家
    io.to(roomId).emit('player_left', {
      playerId: socket.userId,
      players: game.getPlayers(),
      gameState: game.getGameState()
    })

    // 如果房间没有玩家了，清理游戏实例
    if (game.getPlayerCount() === 0) {
      activeRooms.delete(roomId)
      await GameRoom.updateStatus(roomId, 'finished')
      console.log(`房间 ${roomId} 已清理`)
    }
  }

  socket.leave(roomId)
  socket.currentRoomId = null
  console.log(`玩家 ${socket.username} 离开房间 ${roomId}`)
}

// 处理AI连续行动
const processAIActions = async (game, roomId, io) => {
  try {
    let maxAIActions = 10 // 防止无限循环
    let aiActionCount = 0
    
    while (aiActionCount < maxAIActions) {
      const aiResult = game.processAIAction()
      
      if (!aiResult) {
        // 没有AI需要行动，或者游戏结束
        break
      }
      
      aiActionCount++
      
      // 广播AI行动
      io.to(roomId).emit('ai_action', {
        playerId: aiResult.playerId,
        playerName: aiResult.playerName,
        action: aiResult.action,
        amount: aiResult.amount
      })
      
      // 广播游戏状态更新
      io.to(roomId).emit('game_update', {
        gameState: aiResult.gameState,
        lastAction: {
          type: aiResult.action,
          player: aiResult.playerName,
          amount: aiResult.amount
        }
      })
      
      // 更新数据库中的游戏状态
      await GameRoom.updateGameState(roomId, aiResult.gameState)
      
      // AI行动间隔
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // 检查游戏是否结束
      if (game.isGameFinished()) {
        await handleGameFinish(game, roomId, io)
        break
      }
    }
    
  } catch (error) {
    console.error('AI行动处理错误:', error)
  }
}

// 处理游戏结束
const handleGameFinish = async (game, roomId, io) => {
  try {
    const results = game.getGameResults()
    
    // 更新玩家筹码和统计数据 (只更新真实玩家，跳过AI)
    for (const player of results.players) {
      if (!player.isAI) {
        await User.updateChips(player.id, player.finalChips)
        await User.updateGameStats(player.id, {
          gamesPlayed: 1,
          gamesWon: player.id === results.winner.id ? 1 : 0,
          chipsWon: Math.max(0, player.chipsChange),
          chipsLost: Math.max(0, -player.chipsChange)
        })
      }
    }

    // 更新房间状态
    await GameRoom.updateStatus(roomId, 'finished')

    // 广播游戏结果
    io.to(roomId).emit('game_finished', {
      results,
      winner: results.winner,
      pot: results.pot
    })

    // 清理游戏实例
    activeRooms.delete(roomId)
    
    console.log(`游戏结束: 房间 ${roomId}, 获胜者: ${results.winner.name}`)

  } catch (error) {
    console.error('处理游戏结束错误:', error)
  }
}