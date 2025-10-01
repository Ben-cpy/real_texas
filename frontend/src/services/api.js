import axios from 'axios'

// API base URL from environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor to add JWT token to headers
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor to handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      const { status, data } = error.response

      if (status === 401) {
        // Unauthorized - clear token and redirect to login
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.href = '/login'
      }

      console.error('API Error:', data.error || error.message)
    } else if (error.request) {
      // Request was made but no response received
      console.error('Network Error: No response from server')
    } else {
      // Something else happened
      console.error('Error:', error.message)
    }

    return Promise.reject(error)
  }
)

// ============ Authentication APIs ============

/**
 * Register a new user
 * @param {string} username - Username (3-20 characters)
 * @param {string} password - Password (min 6 characters)
 * @returns {Promise} Response with token and user data
 */
export const register = async (username, password) => {
  const response = await apiClient.post('/api/auth/register', {
    username,
    password
  })
  return response.data
}

/**
 * Login user
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise} Response with token and user data
 */
export const login = async (username, password) => {
  const response = await apiClient.post('/api/auth/login', {
    username,
    password
  })
  return response.data
}

/**
 * Verify JWT token
 * @returns {Promise} Response with user data if token is valid
 */
export const verifyToken = async () => {
  const response = await apiClient.post('/api/auth/verify')
  return response.data
}

// ============ User APIs ============

/**
 * Get current user profile
 * @returns {Promise} User profile data
 */
export const getUserProfile = async () => {
  const response = await apiClient.get('/api/user/profile')
  return response.data
}

/**
 * Update user profile
 * @param {Object} userData - User data to update
 * @returns {Promise} Updated user data
 */
export const updateUserProfile = async (userData) => {
  const response = await apiClient.put('/api/user/profile', userData)
  return response.data
}

/**
 * Get user statistics
 * @returns {Promise} User stats (games played, won, win rate, etc.)
 */
export const getUserStats = async () => {
  const response = await apiClient.get('/api/user/stats')
  return response.data
}

/**
 * Get leaderboard
 * @param {string} type - Leaderboard type ('chips', 'wins', 'winrate')
 * @param {number} limit - Number of users to retrieve
 * @returns {Promise} Leaderboard data
 */
export const getLeaderboard = async (type = 'chips', limit = 10) => {
  const response = await apiClient.get('/api/user/leaderboard', {
    params: { type, limit }
  })
  return response.data
}

// ============ Game Room APIs ============

/**
 * Get all available game rooms
 * @returns {Promise} List of game rooms
 */
export const getRooms = async () => {
  const response = await apiClient.get('/api/game/rooms')
  return response.data
}

/**
 * Create a new game room
 * @param {Object} roomData - Room configuration
 * @param {string} roomData.name - Room name
 * @param {number} roomData.maxPlayers - Maximum players (default: 6)
 * @param {number} roomData.smallBlind - Small blind amount (default: 10)
 * @param {number} roomData.bigBlind - Big blind amount (default: 20)
 * @returns {Promise} Created room data
 */
export const createRoom = async (roomData) => {
  const response = await apiClient.post('/api/game/rooms', roomData)
  return response.data
}

/**
 * Join a game room
 * @param {string} roomId - Room ID to join
 * @returns {Promise} Join confirmation
 */
export const joinRoom = async (roomId) => {
  const response = await apiClient.post(`/api/game/rooms/${roomId}/join`)
  return response.data
}

/**
 * Leave a game room
 * @param {string} roomId - Room ID to leave
 * @returns {Promise} Leave confirmation
 */
export const leaveRoom = async (roomId) => {
  const response = await apiClient.post(`/api/game/rooms/${roomId}/leave`)
  return response.data
}

/**
 * Get room details
 * @param {string} roomId - Room ID
 * @returns {Promise} Room details
 */
export const getRoomDetails = async (roomId) => {
  const response = await apiClient.get(`/api/game/rooms/${roomId}`)
  return response.data
}

// Export the axios instance for custom requests if needed
export default apiClient
