import express from 'express'
import { GameRoom } from '../models/GameRoom.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()

// 获取游戏房间列表
router.get('/rooms', async (req, res) => {
  try {
    const rooms = await GameRoom.findAll()
    res.json({ rooms })
  } catch (error) {
    console.error('获取房间列表错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 创建游戏房间
router.post('/rooms', async (req, res) => {
  try {
    const { name, maxPlayers = 6, smallBlind = 10, bigBlind = 20 } = req.body
    const { userId } = req.user

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: '房间名称不能为空' })
    }

    const roomId = uuidv4()
    const room = await GameRoom.create({
      id: roomId,
      name: name.trim(),
      creatorId: userId,
      maxPlayers,
      smallBlind,
      bigBlind,
      status: 'waiting'
    })

    res.status(201).json({
      message: '房间创建成功',
      room
    })

  } catch (error) {
    console.error('创建房间错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 加入游戏房间
router.post('/rooms/:roomId/join', async (req, res) => {
  try {
    const { roomId } = req.params
    const { userId } = req.user

    const room = await GameRoom.findById(roomId)
    if (!room) {
      return res.status(404).json({ error: '房间不存在' })
    }

    if (room.status !== 'waiting') {
      return res.status(400).json({ error: '房间已开始游戏，无法加入' })
    }

    const players = JSON.parse(room.players || '[]')
    
    if (players.some(p => p.id === userId)) {
      return res.status(400).json({ error: '您已在此房间中' })
    }

    if (players.length >= room.maxPlayers) {
      return res.status(400).json({ error: '房间已满' })
    }

    // 这里会在Socket连接时实际处理加入逻辑
    res.json({
      message: '准备加入房间',
      roomId
    })

  } catch (error) {
    console.error('加入房间错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 离开游戏房间
router.post('/rooms/:roomId/leave', async (req, res) => {
  try {
    const { roomId } = req.params
    const { userId } = req.user

    // 这里会在Socket断开时实际处理离开逻辑
    res.json({
      message: '已离开房间'
    })

  } catch (error) {
    console.error('离开房间错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 获取房间详细信息
router.get('/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params
    
    const room = await GameRoom.findById(roomId)
    if (!room) {
      return res.status(404).json({ error: '房间不存在' })
    }

    res.json({ room })

  } catch (error) {
    console.error('获取房间信息错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

export default router