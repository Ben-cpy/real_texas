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

// 导入端口管理工具
import { ensurePort, getPortInfo } from './utils/portManager.js'

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
const gracefulShutdown = (signal) => {
  console.log(`收到 ${signal} 信号，正在优雅地关闭服务器...`);

  // 首先关闭 Socket.IO 服务器，这将断开所有连接的客户端
  io.close(() => {
    console.log('Socket.IO 服务器已关闭。');

    // 然后关闭 HTTP 服务器
    server.close(() => {
      console.log('HTTP 服务器已关闭。');
      process.exit(0);
    });
  });

  // 添加一个超时以强制退出，以防万一
  setTimeout(() => {
    console.error('无法在10秒内完成关闭，强制退出。');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server with port management
async function startServer() {
  const preferredPort = PORT

  try {
    // Get port information
    const portInfo = await getPortInfo(preferredPort)

    if (!portInfo.available) {
      console.log(`⚠️  Port ${preferredPort} is occupied`)
      if (portInfo.process) {
        console.log(`   Process: ${portInfo.process.name || 'Unknown'} (PID: ${portInfo.process.pid})`)
      }
    }

    // Ensure port is available with auto-cleanup and fallback
    const result = await ensurePort(preferredPort, {
      autoClear: true,      // Auto-kill process on port
      findAlternative: true // Find alternative port if needed
    })

    if (!result.success) {
      console.error(`❌ Failed to secure port: ${result.message}`)
      console.error(`   Please manually close the application using port ${preferredPort}`)
      console.error(`   Or run: netstat -ano | findstr :${preferredPort}`)
      process.exit(1)
    }

    const finalPort = result.port

    if (result.wasCleared) {
      console.log(`✅ Port ${finalPort} was cleared and is now available`)
    } else if (result.wasAlternative) {
      console.log(`ℹ️  Using alternative port ${finalPort} (preferred port ${preferredPort} was occupied)`)
    }

    // Start listening
    server.listen(finalPort, () => {
      console.log(`🚀 Server running at http://localhost:${finalPort}`)
      console.log(`📝 API health check: http://localhost:${finalPort}/api/health`)
      console.log(`🎮 Socket.IO service started`)
      console.log(`🌐 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`)
      console.log(``)
      console.log(`Press Ctrl+C to stop`)
    })

    // Handle server errors
    server.on('error', (error) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${finalPort} is already in use`)
        process.exit(1)
      } else {
        console.error(`❌ Server error:`, error.message)
        process.exit(1)
      }
    })

  } catch (error) {
    console.error(`❌ Failed to start server:`, error.message)
    process.exit(1)
  }
}

// Start the server
startServer()