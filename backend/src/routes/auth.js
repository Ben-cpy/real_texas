import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { User } from '../models/User.js'

const router = express.Router()

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ 
        error: '用户名和密码不能为空' 
      })
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ 
        error: '用户名长度必须在3-20个字符之间' 
      })
    }

    if (password.length < 6) {
      return res.status(400).json({ 
        error: '密码长度不能少于6个字符' 
      })
    }

    // 检查用户是否已存在
    const existingUser = await User.findByUsername(username)
    if (existingUser) {
      return res.status(409).json({ 
        error: '用户名已存在' 
      })
    }

    // 创建新用户
    const userId = uuidv4()
    const hashedPassword = await bcrypt.hash(password, 12)
    
    const user = await User.create({
      id: userId,
      username,
      password: hashedPassword,
      chips: parseInt(process.env.DEFAULT_CHIPS) || 1000
    })

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    )

    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        chips: user.chips,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
      }
    })

  } catch (error) {
    console.error('注册错误:', error)
    res.status(500).json({ 
      error: '服务器内部错误' 
    })
  }
})

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({ 
        error: '用户名和密码不能为空' 
      })
    }

    // 查找用户
    const user = await User.findByUsername(username)
    if (!user) {
      return res.status(401).json({ 
        error: '用户名或密码错误' 
      })
    }

    // 验证密码
    const isValidPassword = await bcrypt.compare(password, user.password)
    if (!isValidPassword) {
      return res.status(401).json({ 
        error: '用户名或密码错误' 
      })
    }

    // 更新最后登录时间
    await User.updateLastLogin(user.id)

    // 生成JWT
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    )

    res.json({
      message: '登录成功',
      token,
      user: {
        id: user.id,
        username: user.username,
        chips: user.chips,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
      }
    })

  } catch (error) {
    console.error('登录错误:', error)
    res.status(500).json({ 
      error: '服务器内部错误' 
    })
  }
})

// 验证token
router.post('/verify', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]
    
    if (!token) {
      return res.status(401).json({ 
        error: '未提供访问令牌' 
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(decoded.userId)
    
    if (!user) {
      return res.status(401).json({ 
        error: '用户不存在' 
      })
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        chips: user.chips,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon
      }
    })

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        error: '无效的访问令牌' 
      })
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: '访问令牌已过期' 
      })
    }

    console.error('Token验证错误:', error)
    res.status(500).json({ 
      error: '服务器内部错误' 
    })
  }
})

export default router