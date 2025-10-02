import { io } from 'socket.io-client'

// Socket.IO server URL from environment variable or default to localhost
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001'

class SocketService {
  constructor() {
    this.socket = null
    this.isConnected = false
    this.isAuthenticated = false
    this.eventHandlers = new Map()
  }

  /**
   * Initialize socket connection
   * @returns {Promise} Resolves when connected
   */
  connect() {
    if (this.socket && this.isConnected) {
      console.log('Socket already connected')
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      this.socket = io(SOCKET_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000
      })

      this.setupConnectionHandlers()

      // Resolve when connected
      this.socket.once('connect', () => {
        resolve()
      })

      // Reject on connection error
      this.socket.once('connect_error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * Setup connection event handlers
   */
  setupConnectionHandlers() {
    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id)
      this.isConnected = true
      this.emit('connection_status', { connected: true })
    })

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason)
      this.isConnected = false
      this.isAuthenticated = false
      this.emit('connection_status', { connected: false, reason })
    })

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error)
      this.emit('connection_error', { error: error.message })
    })

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts')
      this.emit('reconnected', { attempts: attemptNumber })

      // Re-authenticate after reconnection
      const token = localStorage.getItem('token')
      if (token) {
        this.authenticate(token)
      }
    })
  }

  /**
   * Authenticate with JWT token
   * @param {string} token - JWT token
   */
  authenticate(token) {
    if (!this.socket || !this.isConnected) {
      console.error('Cannot authenticate: socket not connected')
      return
    }

    console.log('Authenticating with token...')
    this.socket.emit('authenticate', { token })

    // Listen for authentication response (one-time)
    this.socket.once('authenticated', (data) => {
      console.log('Authentication successful:', data.user)
      this.isAuthenticated = true
      this.emit('authenticated', data)
    })

    this.socket.once('auth_error', (data) => {
      console.error('Authentication failed:', data.error)
      this.isAuthenticated = false
      this.emit('auth_error', data)
    })
  }

  /**
   * Join a game room
   * @param {string} roomId - Room ID to join
   */
  joinRoom(roomId) {
    if (!this.isAuthenticated) {
      console.error('Cannot join room: not authenticated')
      return
    }

    console.log('Joining room:', roomId)
    this.socket.emit('join_room', { roomId })
  }

  /**
   * Leave current room
   */
  leaveRoom() {
    if (!this.socket) return

    console.log('Leaving room')
    this.socket.emit('leave_room')
  }

  /**
   * Send game action (fold, check, call, raise)
   * @param {string} action - Action type
   * @param {number} amount - Bet amount (for raise action)
   */
  sendGameAction(action, amount = 0) {
    if (!this.isAuthenticated) {
      console.error('Cannot send action: not authenticated')
      return
    }

    console.log('Sending game action:', action, amount)
    this.socket.emit('game_action', { action, amount })
  }

  /**
   * Start the game (room creator only)
   */
  startGame() {
    if (!this.isAuthenticated) {
      console.error('Cannot start game: not authenticated')
      return
    }

    console.log('Starting game')
    this.socket.emit('start_game')
  }

  /**
   * Reset/restart the game
   */
  resetGame() {
    if (!this.isAuthenticated) {
      console.error('Cannot reset game: not authenticated')
      return
    }

    console.log('Resetting game')
    this.socket.emit('reset_game')
  }

  /**
   * Add AI player to the game
   */
  addAI() {
    if (!this.isAuthenticated) {
      console.error('Cannot add AI: not authenticated')
      return
    }

    console.log('Adding AI player')
    this.socket.emit('add_ai')
  }

  setAICount(totalPlayers) {
    if (!this.isAuthenticated) {
      console.error('Cannot set AI count: not authenticated')
      return
    }

    this.socket.emit('set_ai_count', { totalPlayers })
  }

  removeAI() {
    if (!this.isAuthenticated) {
      console.error('Cannot remove AI: not authenticated')
      return
    }

    this.socket.emit('remove_ai')
  }

  /**
   * Send chat message to room
   * @param {string} message - Chat message content
   */
  sendChatMessage(message) {
    if (!this.isAuthenticated) {
      console.error('Cannot send chat message: not authenticated')
      return
    }

    if (!message || message.trim().length === 0) {
      return
    }

    console.log('Sending chat message:', message)
    this.socket.emit('send_chat_message', { message })
  }

  /**
   * Listen for server events
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this.socket) {
      console.error('Socket not initialized')
      return
    }

    // Store handler for cleanup
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, [])
    }
    this.eventHandlers.get(event).push(callback)

    this.socket.on(event, callback)
  }

  /**
   * Remove event listener
   * @param {string} event - Event name
   * @param {Function} callback - Event handler to remove
   */
  off(event, callback) {
    if (!this.socket) return

    this.socket.off(event, callback)

    // Remove from handlers map
    if (this.eventHandlers.has(event)) {
      const handlers = this.eventHandlers.get(event)
      const index = handlers.indexOf(callback)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  /**
   * Emit custom event (for internal event handling)
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => handler(data))
    }
  }

  /**
   * Disconnect socket
   */
  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket')

      // Clean up all event listeners
      this.eventHandlers.forEach((handlers, event) => {
        handlers.forEach(handler => {
          this.socket.off(event, handler)
        })
      })
      this.eventHandlers.clear()

      this.socket.disconnect()
      this.socket = null
      this.isConnected = false
      this.isAuthenticated = false
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    return {
      connected: this.isConnected,
      authenticated: this.isAuthenticated,
      socketId: this.socket?.id
    }
  }
}

// Create singleton instance
const socketService = new SocketService()

export default socketService
