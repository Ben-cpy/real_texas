import express from 'express'
import { User } from '../models/User.js'

const router = express.Router()

// 获取用户信息
router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.user
    
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        chips: user.chips,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt
      }
    })

  } catch (error) {
    console.error('获取用户信息错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 更新用户信息
router.put('/profile', async (req, res) => {
  try {
    const { userId } = req.user
    const { username } = req.body

    if (!username || username.trim().length === 0) {
      return res.status(400).json({ error: '用户名不能为空' })
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度必须在3-20个字符之间' })
    }

    // 检查用户名是否已被其他用户使用
    const existingUser = await User.findByUsername(username.trim())
    if (existingUser && existingUser.id !== userId) {
      return res.status(409).json({ error: '用户名已被使用' })
    }

    const updatedUser = await User.updateProfile(userId, {
      username: username.trim()
    })

    res.json({
      message: '用户信息更新成功',
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        chips: updatedUser.chips,
        gamesPlayed: updatedUser.gamesPlayed,
        gamesWon: updatedUser.gamesWon
      }
    })

  } catch (error) {
    console.error('更新用户信息错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 获取用户统计数据
router.get('/stats', async (req, res) => {
  try {
    const { userId } = req.user
    
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    const stats = {
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      gamesLost: user.gamesPlayed - user.gamesWon,
      winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0,
      chips: user.chips,
      totalChipsWon: user.totalChipsWon || 0,
      totalChipsLost: user.totalChipsLost || 0
    }

    res.json({ stats })

  } catch (error) {
    console.error('获取用户统计数据错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 获取排行榜
router.get('/leaderboard', async (req, res) => {
  try {
    const { type = 'chips', limit = 10 } = req.query

    let orderBy = 'chips'
    if (type === 'wins') {
      orderBy = 'gamesWon'
    } else if (type === 'winrate') {
      // 这里需要计算胜率，暂时按胜场数排序
      orderBy = 'gamesWon'
    }

    const users = await User.getLeaderboard(orderBy, parseInt(limit))

    const leaderboard = users.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      chips: user.chips,
      gamesPlayed: user.gamesPlayed,
      gamesWon: user.gamesWon,
      winRate: user.gamesPlayed > 0 ? Math.round((user.gamesWon / user.gamesPlayed) * 100) : 0
    }))

    res.json({ leaderboard })

  } catch (error) {
    console.error('获取排行榜错误:', error)
    res.status(500).json({ error: '服务器内部错误' })
  }
})

// 领取救济金
router.post('/relief-fund', async (req, res) => {
  try {
    const { userId } = req.user

    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ error: '用户不存在' })
    }

    // 检查是否有资格领取救济金（筹码少于1000）
    if (user.chips >= 1000) {
      return res.status(400).json({
        success: false,
        message: '您的筹码充足，暂时不能领取救济金',
        chips: user.chips
      })
    }

    // 增加10000筹码
    const reliefAmount = 10000
    await User.updateChips(userId, user.chips + reliefAmount)

    const updatedUser = await User.findById(userId)

    res.json({
      success: true,
      message: `成功领取救济金 ${reliefAmount} 筹码`,
      chips: updatedUser.chips,
      reliefAmount
    })

  } catch (error) {
    console.error('领取救济金错误:', error)
    res.status(500).json({
      success: false,
      error: '服务器内部错误'
    })
  }
})

export default router