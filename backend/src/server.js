import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

// 导入路由
import authRoutes from './routes/auth.js'
import gameRoutes from './routes/game.js'
import userRoutes from './routes/user.js'

// 导入Socket处理
import { handleSocketConnection } from './socket/gameSocket.js'

// 导入中间件
import errorHandler from './middleware/errorHandler.js'
import { authenticateToken } from './middleware/auth.js'

// ES模块的__dirname替代方案
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 加载环境变量
dotenv.config()

const app = express()
const server = createServer(app)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
})

const PORT = process.env.PORT || 3001

// 中间件
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// 静态文件服务
app.use(express.static(path.join(__dirname, '../public')))

// API路由
app.use('/api/auth', authRoutes)
app.use('/api/game', authenticateToken, gameRoutes)
app.use('/api/user', authenticateToken, userRoutes)

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  })
})

// Socket.IO连接处理
io.on('connection', (socket) => {
  console.log(`用户连接: ${socket.id}`)
  handleSocketConnection(socket, io)
})

// 错误处理中间件
app.use(errorHandler)

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'API端点不存在',
    path: req.originalUrl 
  })
})

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('收到SIGTERM信号，正在关闭服务器...')
  server.close(() => {
    console.log('服务器已关闭')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('收到SIGINT信号，正在关闭服务器...')
  server.close(() => {
    console.log('服务器已关闭')
    process.exit(0)
  })
})

server.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`)
  console.log(`📝 API文档: http://localhost:${PORT}/api/health`)
  console.log(`🎮 Socket.IO 服务已启动`)
})