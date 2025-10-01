import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import * as api from '../services/api'
import socketService from '../services/socket'

export const useUserStore = defineStore('user', () => {
  // State
  const user = ref(null)
  const token = ref(null)
  const isLoggedIn = ref(false)
  const stats = ref(null)

  // Computed
  const username = computed(() => user.value?.username || '')
  const chips = computed(() => user.value?.chips || 0)
  const gamesPlayed = computed(() => user.value?.gamesPlayed || 0)
  const gamesWon = computed(() => user.value?.gamesWon || 0)
  const winRate = computed(() => {
    if (!user.value || user.value.gamesPlayed === 0) return 0
    return Math.round((user.value.gamesWon / user.value.gamesPlayed) * 100)
  })

  // Actions

  /**
   * Initialize user from localStorage
   */
  function initFromStorage() {
    const storedToken = localStorage.getItem('token')
    const storedUser = localStorage.getItem('user')

    if (storedToken && storedUser) {
      token.value = storedToken
      user.value = JSON.parse(storedUser)
      isLoggedIn.value = true

      // Verify token is still valid
      verifyToken()
    }
  }

  /**
   * Login user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Login result
   */
  async function login(username, password) {
    try {
      const response = await api.login(username, password)

      // Save to state
      token.value = response.token
      user.value = response.user
      isLoggedIn.value = true

      // Save to localStorage
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))

      // Connect socket and authenticate
      socketService.connect()
      socketService.authenticate(response.token)

      return { success: true, message: response.message }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '登录失败'
      }
    }
  }

  /**
   * Register new user
   * @param {string} username - Username
   * @param {string} password - Password
   * @returns {Promise<Object>} Registration result
   */
  async function register(username, password) {
    try {
      const response = await api.register(username, password)

      // Save to state
      token.value = response.token
      user.value = response.user
      isLoggedIn.value = true

      // Save to localStorage
      localStorage.setItem('token', response.token)
      localStorage.setItem('user', JSON.stringify(response.user))

      // Connect socket and authenticate
      socketService.connect()
      socketService.authenticate(response.token)

      return { success: true, message: response.message }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '注册失败'
      }
    }
  }

  /**
   * Verify token validity
   */
  async function verifyToken() {
    try {
      const response = await api.verifyToken()
      user.value = response.user
      isLoggedIn.value = true

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(response.user))

      return { success: true }
    } catch (error) {
      // Token is invalid, logout
      logout()
      return { success: false }
    }
  }

  /**
   * Logout user
   */
  function logout() {
    // Clear state
    user.value = null
    token.value = null
    isLoggedIn.value = false
    stats.value = null

    // Clear localStorage
    localStorage.removeItem('token')
    localStorage.removeItem('user')

    // Disconnect socket
    socketService.disconnect()
  }

  /**
   * Refresh user profile
   */
  async function refreshProfile() {
    try {
      const response = await api.getUserProfile()
      user.value = response.user

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(response.user))

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '刷新用户信息失败'
      }
    }
  }

  /**
   * Update user profile
   * @param {Object} userData - User data to update
   */
  async function updateProfile(userData) {
    try {
      const response = await api.updateUserProfile(userData)
      user.value = response.user

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(response.user))

      return { success: true, message: response.message }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '更新用户信息失败'
      }
    }
  }

  /**
   * Fetch user statistics
   */
  async function fetchStats() {
    try {
      const response = await api.getUserStats()
      stats.value = response.stats
      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error.response?.data?.error || '获取统计数据失败'
      }
    }
  }

  /**
   * Update user chips (from game events)
   * @param {number} newChips - New chip amount
   */
  function updateChips(newChips) {
    if (user.value) {
      user.value.chips = newChips

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  /**
   * Update game statistics (from game events)
   * @param {Object} gameStats - Game statistics
   */
  function updateGameStats(gameStats) {
    if (user.value) {
      if (gameStats.gamesPlayed !== undefined) {
        user.value.gamesPlayed = gameStats.gamesPlayed
      }
      if (gameStats.gamesWon !== undefined) {
        user.value.gamesWon = gameStats.gamesWon
      }

      // Update localStorage
      localStorage.setItem('user', JSON.stringify(user.value))
    }
  }

  return {
    // State
    user,
    token,
    isLoggedIn,
    stats,
    // Computed
    username,
    chips,
    gamesPlayed,
    gamesWon,
    winRate,
    // Actions
    initFromStorage,
    login,
    register,
    verifyToken,
    logout,
    refreshProfile,
    updateProfile,
    fetchStats,
    updateChips,
    updateGameStats
  }
})
