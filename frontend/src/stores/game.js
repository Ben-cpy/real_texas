import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import socketService from '../services/socket'

export const useGameStore = defineStore('game', () => {
  // State
  const roomId = ref(null)
  const roomName = ref('')
  const roomCreatorId = ref(null)
  const players = ref([])
  const communityCards = ref([])
  const pot = ref(0)
  const currentBet = ref(0)
  const minRaise = ref(0)
  const gamePhase = ref('waiting') // waiting, preflop, flop, turn, river, showdown
  const currentPlayerIndex = ref(-1)
  const dealerIndex = ref(0)
  const smallBlind = ref(10)
  const bigBlind = ref(20)
  const desiredSeatCount = ref(6)
  const maxPlayers = ref(6)
  const winners = ref([])
  const lastAction = ref(null)
  const gameFinished = ref(false)
  const lastPot = ref(0)
  const isConnected = ref(false)
  const isAuthenticated = ref(false)
  const error = ref(null)

  const normalizePlayers = (list = []) => {
    if (!Array.isArray(list)) return []

    return [...list].sort((a, b) => {
      const seatA = Number.isInteger(a?.seatIndex) ? a.seatIndex : Number.MAX_SAFE_INTEGER
      const seatB = Number.isInteger(b?.seatIndex) ? b.seatIndex : Number.MAX_SAFE_INTEGER

      if (seatA !== seatB) {
        return seatA - seatB
      }

      const idA = (a?.id || '').toString()
      const idB = (b?.id || '').toString()
      return idA.localeCompare(idB)
    })
  }

  // Computed
  const isMyTurn = computed(() => {
    if (
      gamePhase.value === 'waiting' ||
      gamePhase.value === 'showdown' ||
      currentPlayerIndex.value === -1 ||
      players.value.length === 0
    ) {
      return false
    }

    const currentPlayer = players.value[currentPlayerIndex.value]
    const userId = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user')).id
      : null
    return currentPlayer?.id === userId && !currentPlayer?.isAI
  })

  const myPlayer = computed(() => {
    const userId = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user')).id
      : null
    return players.value.find((p) => p.id === userId)
  })

  const isRoomCreator = computed(() => {
    const userId = localStorage.getItem('user')
      ? JSON.parse(localStorage.getItem('user')).id
      : null
    return roomCreatorId.value === userId
  })

  const canStartGame = computed(() => {
    const minimumSeats = Math.max(3, players.value.filter((p) => !p.isAI).length)
    const hasPlayers = players.value.length >= minimumSeats
    const waitingToStart = gamePhase.value === 'waiting'
    const readyForNextHand = gamePhase.value === 'showdown' && gameFinished.value

    return isRoomCreator.value && hasPlayers && (waitingToStart || readyForNextHand)
  })

  const activePlayers = computed(() => {
    return players.value.filter((p) => !p.folded && !p.allIn)
  })

  const realPlayerCount = computed(() => players.value.filter((p) => !p.isAI).length)
  const aiPlayerCount = computed(() => players.value.filter((p) => p.isAI).length)

  const totalPot = computed(() => {
    return pot.value + players.value.reduce((sum, p) => sum + (p.currentBet || 0), 0)
  })

  // Actions

  /**
   * Initialize socket service and setup event listeners
   */
  function initSocket() {
    // Setup connection status listeners
    socketService.on('connection_status', (data) => {
      isConnected.value = data.connected
      if (!data.connected) {
        error.value = 'Connection lost'
      }
    })

    socketService.on('authenticated', (data) => {
      isAuthenticated.value = true
      console.log('Socket authenticated:', data)
    })

    socketService.on('auth_error', (data) => {
      isAuthenticated.value = false
      error.value = data.error
    })

    // Game event listeners
    socketService.on('player_joined', handlePlayerJoined)
    socketService.on('player_left', handlePlayerLeft)
    socketService.on('player_list_updated', handlePlayerListUpdated)
    socketService.on('ai_count_updated', handleAICountUpdated)
    socketService.on('game_update', handleGameUpdate)
    socketService.on('game_started', handleGameStarted)
    socketService.on('game_finished', handleGameFinished)
    socketService.on('game_reset', handleGameReset)
    socketService.on('action_error', handleActionError)
    socketService.on('error', handleError)
  }

  /**
   * Join a game room
   * @param {string} id - Room ID
   * @param {string} name - Room name (optional)
   */
  function joinRoom(id, name = '') {
    roomId.value = id
    roomName.value = name
    socketService.joinRoom(id)
  }

  /**
   * Leave current room
   */
  function leaveRoom() {
    socketService.leaveRoom()
    resetGameState()
  }

  /**
   * Send game action
   * @param {string} action - Action type (fold, check, call, raise)
   * @param {number} amount - Bet amount (for raise)
   */
  function sendAction(action, amount = 0) {
    socketService.sendGameAction(action, amount)
  }

  /**
   * Start the game
   */
  function startGame() {
    socketService.startGame()
  }

  /**
   * Reset/restart the game
   */
  function resetGame() {
    socketService.resetGame()
  }

  /**
   * Add AI player
   */
  function addAI() {
    socketService.addAI()
  }

  function setAICount(totalPlayers) {
    socketService.setAICount(totalPlayers)
  }

  function removeAI() {
    socketService.removeAI()
  }

  // Event Handlers

  function handlePlayerJoined(data) {
    console.log('Player joined:', data)
    players.value = data.players || []
    roomCreatorId.value = data.roomCreatorId
    if (data.gameState) {
      updateGameState(data.gameState)
    }
  }

  function handlePlayerLeft(data) {
    console.log('Player left:', data)
    players.value = data.players || []
    if (data.gameState) {
      updateGameState(data.gameState)
    }
  }

  function handlePlayerListUpdated(data) {
    if (data && Array.isArray(data.players)) {
      players.value = normalizePlayers(data.players)
    }
    if (data && typeof data.desiredSeatCount === 'number') {
      desiredSeatCount.value = data.desiredSeatCount
    }
    if (data && typeof data.maxPlayers === 'number') {
      maxPlayers.value = data.maxPlayers
    }
    if (data && data.phase) {
      gamePhase.value = data.phase
    }
  }

  function handleAICountUpdated(data) {
    if (data && typeof data.desiredSeatCount === 'number') {
      desiredSeatCount.value = data.desiredSeatCount
    }
    if (data && typeof data.maxPlayers === 'number') {
      maxPlayers.value = data.maxPlayers
    }
  }

  function handleGameUpdate(data) {
    console.log('Game update:', data)
    if (data.gameState) {
      updateGameState(data.gameState)
    }
    if (data.lastAction) {
      lastAction.value = data.lastAction
    }
  }

  function handleGameStarted(data) {
    console.log('Game started:', data)
    gameFinished.value = false
    lastPot.value = 0
    if (data.gameState) {
      updateGameState(data.gameState)
    }
  }

  function handleGameFinished(data) {
    console.log('Game finished:', data)
    const winnerList = data.winners || data.results?.winners || (data.winner ? [data.winner] : [])
    winners.value = winnerList || []
    const resolvedPot = data?.pot ?? data?.results?.pot ?? 0
    lastPot.value = resolvedPot
    gameFinished.value = true
    if (data.gameState) {
      updateGameState(data.gameState)
    } else if (data.results?.gameState) {
      updateGameState(data.results.gameState)
    }
  }

  function handleGameReset(data) {
    console.log('Game reset:', data)
    if (data.gameState) {
      updateGameState(data.gameState)
    }
    winners.value = []
    lastAction.value = null
    gameFinished.value = false
    lastPot.value = 0
  }

  function handleActionError(data) {
    console.error('Action error:', data)
    error.value = data.error
  }

  function handleError(data) {
    console.error('Socket error:', data)
    error.value = data.error
  }

  /**
   * Update game state from server data
   * @param {Object} state - Game state
   */
  function updateGameState(state) {
    if (state.players) players.value = normalizePlayers(state.players)
    if (state.communityCards) communityCards.value = state.communityCards
    if (state.pot !== undefined) pot.value = state.pot
    if (state.currentBet !== undefined) currentBet.value = state.currentBet
    if (state.minRaise !== undefined) minRaise.value = state.minRaise
    if (state.phase) {
      gamePhase.value = state.phase
      if (state.phase !== 'showdown') {
        winners.value = []
        if (!state.gameFinished) {
          lastPot.value = 0
        }
      }
    }
    if (state.currentPlayerIndex !== undefined)
      currentPlayerIndex.value = state.currentPlayerIndex
    if (state.dealerIndex !== undefined) dealerIndex.value = state.dealerIndex
    if (state.smallBlind !== undefined) smallBlind.value = state.smallBlind
    if (state.bigBlind !== undefined) bigBlind.value = state.bigBlind
    if (state.desiredSeatCount !== undefined) desiredSeatCount.value = state.desiredSeatCount
    if (state.maxPlayers !== undefined) maxPlayers.value = state.maxPlayers
    if (state.gameFinished !== undefined) gameFinished.value = state.gameFinished
  }

  /**
   * Reset game state to initial values
   */
  function resetGameState() {
    roomId.value = null
    roomName.value = ''
    roomCreatorId.value = null
    players.value = []
    communityCards.value = []
    pot.value = 0
    currentBet.value = 0
    minRaise.value = 0
    gamePhase.value = 'waiting'
    currentPlayerIndex.value = -1
    dealerIndex.value = 0
    maxPlayers.value = 6
    winners.value = []
    lastAction.value = null
    error.value = null
    desiredSeatCount.value = 6
    gameFinished.value = false
    lastPot.value = 0
  }

  /**
   * Clear error message
   */
  function clearError() {
    error.value = null
  }

  /**
   * Cleanup socket listeners
   */
  function cleanup() {
    socketService.off('connection_status')
    socketService.off('authenticated')
    socketService.off('auth_error')
    socketService.off('player_joined', handlePlayerJoined)
    socketService.off('player_left', handlePlayerLeft)
    socketService.off('player_list_updated', handlePlayerListUpdated)
    socketService.off('ai_count_updated', handleAICountUpdated)
    socketService.off('game_update', handleGameUpdate)
    socketService.off('game_started', handleGameStarted)
    socketService.off('game_finished', handleGameFinished)
    socketService.off('game_reset', handleGameReset)
    socketService.off('action_error', handleActionError)
    socketService.off('error', handleError)
  }

  return {
    // State
    roomId,
    roomName,
    roomCreatorId,
    players,
    communityCards,
    pot,
    currentBet,
    minRaise,
    gamePhase,
    currentPlayerIndex,
    dealerIndex,
    smallBlind,
    bigBlind,
    desiredSeatCount,
    maxPlayers,
    winners,
    lastAction,
    gameFinished,
    lastPot,
    isConnected,
    isAuthenticated,
    error,
    // Computed
    isMyTurn,
    myPlayer,
    isRoomCreator,
    canStartGame,
    activePlayers,
    realPlayerCount,
    aiPlayerCount,
    totalPot,
    // Actions
    initSocket,
    joinRoom,
    leaveRoom,
    sendAction,
    startGame,
    resetGame,
    addAI,
    setAICount,
    removeAI,
    updateGameState,
    resetGameState,
    clearError,
    cleanup
  }
})







