<template>
  <div class="game-screen" :class="[`phase-${gameStore.gamePhase}`]">
    <header class="top-bar">
      <div class="room-info">
        <h1>Texas Hold'em</h1>
        <div class="meta-row">
          <span class="meta-pill">Room {{ gameStore.roomId || 'N/A' }}</span>
          <span class="meta-pill">Blinds ${{ gameStore.smallBlind }}/{{ gameStore.bigBlind }}</span>
          <span class="meta-pill">{{ gameStore.players.length }} / {{ gameStore.desiredSeatCount }} players</span>
        </div>
        <div class="meta-row secondary">
          <span class="meta-pill">Dealer: {{ dealerName }}</span>
          <span class="meta-pill">Phase: {{ phaseLabel }}</span>
          <span class="meta-pill" v-if="gameStore.currentBet > 0">Current bet ${{ gameStore.currentBet }}</span>
        </div>
      </div>

      <div class="control-cluster">
        <button class="btn icon-btn" @click="toggleSound" :aria-pressed="soundEnabled">
          <span>{{ soundEnabled ? '??' : '??' }}</span>
        </button>
        <button class="btn" @click="resetGame" v-if="gameStore.gamePhase !== 'waiting'">Restart</button>
        <button class="btn danger" @click="leaveGame">Leave</button>
      </div>

      <div class="account-panel">
        <div class="account-name">
          <span>{{ userStore.username }}</span>
          <small>ID: {{ userStore.user?.id || '?' }}</small>
        </div>
        <div class="account-chips">${{ formattedChips }}</div>
        <div class="account-stats">
          <span>Games {{ userStore.gamesPlayed }}</span>
          <span>Wins {{ userStore.gamesWon }}</span>
          <span>Win rate {{ userStore.winRate }}%</span>
        </div>
      </div>
    </header>

    <transition name="phase-banner">
      <div v-if="showPhaseBanner" class="phase-banner">
        <div class="phase-banner-content">
          <h2>{{ phaseBannerText }}</h2>
          <p v-if="phaseBannerSubtext">{{ phaseBannerSubtext }}</p>
        </div>
      </div>
    </transition>

    <main class="content">
      <section class="table-area">
        <div class="table-felt">
          <div class="table-glow"></div>

          <div class="pot-info">
            <span class="label">Pot</span>
            <span class="value">${{ gameStore.totalPot }}</span>
            <span class="call" v-if="callAmount > 0">To call ${{ callAmount }}</span>
          </div>

          <div class="community-row">
            <div
              v-for="(card, index) in paddedCommunityCards"
              :key="`community-${index}`"
              class="card-slot"
              :class="{ revealed: !!card }"
            >
              <span
                v-if="card"
                class="card-face"
                :class="getCardColor(card.suit)"
              >
                {{ card.suit }}{{ card.rank }}
              </span>
            </div>
          </div>

          <div
            v-if="dealerIndex !== -1 && tablePlayers.length"
            class="dealer-chip"
            :class="seatClasses[dealerIndex % seatClasses.length]"
          >
            D
          </div>

          <div class="player-layer">
            <div
              v-for="(player, index) in tablePlayers"
              :key="player.id"
              class="seat"
              :class="[
                seatClasses[index % seatClasses.length],
                {
                  me: player.id === userStore.user?.id,
                  active: player.id === currentTurnPlayerId,
                  folded: player.folded,
                  allin: player.allIn
                }
              ]"
            >
              <div class="seat-frame">
                <div class="seat-header">
                  <span class="name">{{ player.name }}</span>
                  <span class="chips">${{ player.chips }}</span>
                </div>
                <div class="seat-body">
                  <div class="last-action" v-if="player.lastAction && !player.folded">
                    {{ formatPlayerAction(player.lastAction) }}
                  </div>
                  <div class="bet-stack" v-if="player.currentBet > 0 && !player.folded">
                    Bet ${{ player.currentBet }}
                  </div>
                </div>
                <div class="hole-cards">
                  <div
                    v-for="n in 2"
                    :key="`hole-${player.id}-${n}`"
                    class="card-slot"
                    :class="{ revealed: shouldRevealPlayerCard(player, n - 1) }"
                  >
                    <span
                      v-if="shouldRevealPlayerCard(player, n - 1)"
                      class="card-face"
                      :class="getCardColor(player.cards[n - 1]?.suit)"
                    >
                      {{ player.cards[n - 1]?.suit }}{{ player.cards[n - 1]?.rank }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="!tablePlayers.length" class="empty-state">
              Waiting for players to join?
            </div>
          </div>
        </div>

        <div class="table-footer">
          <div class="host-controls" v-if="gameStore.isRoomCreator">
            <div class="seat-controls" v-if="gameStore.gamePhase === 'waiting'">
              <button class="btn light" @click="decreaseSeats" :disabled="seatDecreaseDisabled">-</button>
              <span>{{ gameStore.desiredSeatCount }} seats</span>
              <button class="btn light" @click="increaseSeats" :disabled="seatIncreaseDisabled">+</button>
            </div>
            <div class="ai-controls" v-if="gameStore.gamePhase === 'waiting'">
              <button class="btn success" @click="addAI" :disabled="gameStore.players.length >= gameStore.desiredSeatCount">
                Add AI
              </button>
              <button class="btn warning" @click="removeAI" :disabled="gameStore.aiPlayerCount === 0">
                Remove AI
              </button>
            </div>
            <button class="btn primary" @click="startGame" :disabled="!gameStore.canStartGame">
              {{ gameStore.gamePhase === 'waiting' ? 'Start Game' : 'Deal Next Hand' }}
            </button>
          </div>
          <div class="waiting-banner" v-else-if="gameStore.gamePhase === 'waiting'">
            Waiting for the host to start the game?
          </div>
        </div>
      </section>

      <aside class="sidebar">
        <section class="action-panel" :class="{ inactive: !gameStore.isMyTurn }">
          <h3>Actions</h3>
          <div class="action-buttons">
            <button class="btn ghost" @click="fold" :disabled="!gameStore.isMyTurn">Fold</button>
            <button class="btn ghost" @click="checkOrCall" :disabled="!gameStore.isMyTurn">
              {{ canCheck ? 'Check' : `Call $${callAmount}` }}
            </button>
            <button class="btn primary" @click="openRaisePanel" :disabled="!canRaise">
              Raise
            </button>
            <button class="btn danger" @click="allIn" :disabled="!gameStore.isMyTurn">All-in</button>
          </div>

          <transition name="raise-panel">
            <div v-if="showRaisePanel" class="raise-panel">
              <header>
                <span>Raise Amount</span>
                <button class="icon-btn" @click="closeRaisePanel">?</button>
              </header>
              <div class="slider-row">
                <input
                  type="range"
                  :min="Math.min(minRaiseValue, maxRaiseValue)"
                  :max="maxRaiseValue"
                  step="1"
                  v-model.number="raiseAmount"
                />
                <div class="slider-value">${{ raiseAmount }}</div>
              </div>
              <div class="quick-raise">
                <button class="btn light" @click="setRaiseFraction(0.25)">+25%</button>
                <button class="btn light" @click="setRaiseFraction(0.5)">+50%</button>
                <button class="btn light" @click="setRaiseFraction(1)">Pot</button>
                <button class="btn light" @click="setRaiseAllIn">All-in</button>
              </div>
              <button class="btn primary full" @click="confirmRaise">Confirm Raise</button>
            </div>
          </transition>
        </section>

        <section class="info-panel">
          <h3>Table Snapshot</h3>
          <ul>
            <li><span>Phase</span><span>{{ phaseLabel }}</span></li>
            <li><span>Dealer</span><span>{{ dealerName }}</span></li>
            <li><span>Your stack</span><span>${{ myStack }}</span></li>
            <li><span>Minimum raise</span><span>${{ Math.min(minRaiseValue, maxRaiseValue) }}</span></li>
          </ul>
        </section>

        <section class="log-panel">
          <h3>Game Log</h3>
          <div class="log-scroll">
            <div v-for="(entry, index) in gameLogs" :key="`log-${index}`" class="log-entry">
              {{ entry }}
            </div>
          </div>
        </section>

        <section class="chat-panel">
          <h3>Table Chat</h3>
          <div class="chat-scroll">
            <div
              v-for="(msg, index) in chatMessages"
              :key="`chat-${index}`"
              class="chat-line"
              :class="{ mine: msg.userId === userStore.user?.id }"
            >
              <span class="user">{{ msg.username }}</span>
              <span class="message">{{ msg.message }}</span>
            </div>
          </div>
          <div class="chat-input-row">
            <input
              type="text"
              v-model="chatInput"
              placeholder="Say something?"
              maxlength="150"
              @keyup.enter="sendChatMessage"
            />
            <button class="btn primary" @click="sendChatMessage">Send</button>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useUserStore } from '../stores/user'
import { useGameStore } from '../stores/game'
import socketService from '../services/socket'
import soundService from '../services/sound'

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const gameStore = useGameStore()
const roomIdParam = ref(route.query.roomId || 'default-room')

const MAX_SEATS = 6
const MIN_SEATS = 3

const showRaisePanel = ref(false)
const raiseAmount = ref(0)
const gameLogs = ref([])
const chatMessages = ref([])
const chatInput = ref('')
const soundEnabled = ref(soundService.enabled)
const showPhaseBanner = ref(false)
const phaseBannerText = ref('')
const phaseBannerSubtext = ref('')

const hasJoinedRoom = ref(false)
const socketListeners = []

const registerSocketListener = (event, handler) => {
  socketService.on(event, handler)
  socketListeners.push({ event, handler })
}

const cleanupSocketListeners = () => {
  socketListeners.forEach(({ event, handler }) => {
    socketService.off(event, handler)
  })
  socketListeners.length = 0
}

const seatClasses = ['seat-0', 'seat-1', 'seat-2', 'seat-3', 'seat-4', 'seat-5']

const tablePlayers = computed(() => gameStore.players || [])
const dealerIndex = computed(() => (typeof gameStore.dealerIndex === 'number' ? gameStore.dealerIndex : -1))
const dealerName = computed(() => {
  if (dealerIndex.value < 0 || dealerIndex.value >= tablePlayers.value.length) {
    return '—'
  }
  return tablePlayers.value[dealerIndex.value]?.name || '—'
})

const paddedCommunityCards = computed(() => {
  const cards = gameStore.communityCards ? [...gameStore.communityCards] : []
  while (cards.length < 5) {
    cards.push(null)
  }
  return cards
})

const currentTurnPlayerId = computed(() => {
  if (gameStore.currentPlayerIndex == null || gameStore.currentPlayerIndex < 0) {
    return null
  }
  return tablePlayers.value[gameStore.currentPlayerIndex]?.id || null
})

const callAmount = computed(() => {
  const player = gameStore.myPlayer
  if (!player) return 0
  const target = (gameStore.currentBet || 0) - (player.currentBet || 0)
  return target > 0 ? Math.round(target) : 0
})

const canCheck = computed(() => callAmount.value === 0)
const canRaise = computed(() => gameStore.isMyTurn && (gameStore.myPlayer?.chips || 0) > 0)

const maxRaiseValue = computed(() => Math.max(0, gameStore.myPlayer?.chips || 0))

const minRaiseValue = computed(() => {
  const chips = maxRaiseValue.value
  if (chips <= 0) return 0
  const call = callAmount.value
  const base = Math.max(gameStore.minRaise || gameStore.bigBlind || 1, 1)
  const required = call + base
  if (required >= chips) {
    return chips
  }
  return required
})

const formattedChips = computed(() => (userStore.chips || 0).toLocaleString())
const myStack = computed(() => gameStore.myPlayer?.chips ?? 0)

const phaseNames = {
  waiting: 'Waiting',
  preflop: 'Pre-Flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'Showdown'
}

const phaseDescriptions = {
  waiting: 'Gather players before dealing.',
  preflop: 'Players act on their hole cards.',
  flop: 'Three community cards reveal the board.',
  turn: 'The turn card changes the possibilities.',
  river: 'Final community card before the showdown.',
  showdown: 'Reveal hands to determine the winner.'
}

const phaseLabel = computed(() => phaseNames[gameStore.gamePhase] || (gameStore.gamePhase || '').toUpperCase())

const aiPlayerCount = computed(() => gameStore.aiPlayerCount)
const seatDecreaseDisabled = computed(() => {
  const minimumSeats = Math.max(MIN_SEATS, gameStore.realPlayerCount)
  return gameStore.desiredSeatCount <= minimumSeats
})
const seatIncreaseDisabled = computed(() => gameStore.desiredSeatCount >= MAX_SEATS)

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

watch(showRaisePanel, (visible) => {
  if (visible) {
    const chips = maxRaiseValue.value
    if (chips <= 0) {
      raiseAmount.value = 0
      return
    }
    const base = Math.min(minRaiseValue.value || chips, chips)
    raiseAmount.value = base || chips
  }
})

watch(
  () => gameStore.isMyTurn,
  (isMyTurn) => {
    if (!isMyTurn) {
      showRaisePanel.value = false
    }
  }
)

watch(
  () => [callAmount.value, minRaiseValue.value, maxRaiseValue.value],
  () => {
    if (!showRaisePanel.value) return
    const chips = maxRaiseValue.value
    if (chips <= 0) {
      raiseAmount.value = 0
      return
    }
    const min = Math.min(minRaiseValue.value || chips, chips)
    raiseAmount.value = clamp(raiseAmount.value || min, min || 1, chips)
  }
)

const getCardColor = (suit) => (suit === '♥' || suit === '♦' ? 'red' : 'black')

const formatPlayerAction = (action) => {
  const key = typeof action === 'string' ? action : action?.action || action?.type
  if (!key) return ''
  const map = {
    call: 'Called',
    raise: 'Raised',
    bet: 'Bet',
    fold: 'Folded',
    check: 'Checked',
    all_in: 'All-in',
    small_blind: 'Posted small blind',
    big_blind: 'Posted big blind'
  }
  const label = map[key] || key.toUpperCase()
  const amount = typeof action === 'object' && action?.amount ? ` $${action.amount}` : ''
  return `${label}${amount}`
}

const shouldRevealPlayerCard = (player, index) => {
  if (!player || !player.cards || !player.cards[index]) return false
  if (player.id === userStore.user?.id) return true
  if (gameStore.gamePhase === 'showdown' && !player.folded) return true
  return !!player.cards[index].revealed
}

const addLog = (message) => {
  const timestamp = new Date().toLocaleTimeString()
  gameLogs.value.unshift(`[${timestamp}] ${message}`)
  if (gameLogs.value.length > 80) {
    gameLogs.value.pop()
  }
}

const fold = () => {
  if (!gameStore.isMyTurn) return
  soundService.playFold()
  gameStore.sendAction('fold')
  addLog('You folded')
}

const checkOrCall = () => {
  if (!gameStore.isMyTurn) return
  if (canCheck.value) {
    soundService.playCheck()
    gameStore.sendAction('check')
    addLog('You checked')
  } else {
    soundService.playCall()
    gameStore.sendAction('call')
    addLog(`You called $${callAmount.value}`)
  }
}

const openRaisePanel = () => {
  if (!canRaise.value) return
  soundService.playClick()
  showRaisePanel.value = true
  const chips = maxRaiseValue.value
  if (chips <= 0) {
    raiseAmount.value = 0
    return
  }
  const base = Math.min(minRaiseValue.value || chips, chips)
  raiseAmount.value = base || chips
}

const closeRaisePanel = () => {
  showRaisePanel.value = false
}

const setRaiseFraction = (fraction) => {
  const chips = maxRaiseValue.value
  if (chips <= 0) return
  const call = callAmount.value
  const additional = Math.max(chips - call, 0) * fraction
  const target = Math.round(call + additional)
  const min = Math.min(minRaiseValue.value || chips, chips)
  raiseAmount.value = clamp(target || min, min || 1, chips)
}

const setRaiseAllIn = () => {
  raiseAmount.value = maxRaiseValue.value
}

const confirmRaise = () => {
  if (!gameStore.isMyTurn) return
  const chips = maxRaiseValue.value
  if (chips <= 0) {
    soundService.playError()
    ElMessage.error('Not enough chips to raise')
    return
  }
  const min = Math.min(minRaiseValue.value || chips, chips)
  const amount = Math.round(clamp(raiseAmount.value || min, min || 1, chips))
  if (amount < callAmount.value && amount < chips) {
    soundService.playError()
    ElMessage.error('Raise amount is too small')
    return
  }
  soundService.playRaise()
  gameStore.sendAction('raise', amount)
  addLog(`You raised to $${amount}`)
  showRaisePanel.value = false
}

const allIn = () => {
  if (!gameStore.isMyTurn) return
  soundService.playAllIn()
  gameStore.sendAction('all_in')
  addLog('You went all-in')
  showRaisePanel.value = false
}

const startGame = () => {
  soundService.playGameStart()
  gameStore.startGame()
  addLog('Game started')
}

const addAI = () => {
  soundService.playClick()
  gameStore.addAI()
  addLog('AI player added')
}

const removeAI = () => {
  soundService.playClick()
  gameStore.removeAI()
  addLog('AI player removed')
}

const resetGame = () => {
  if (gameStore.gamePhase === 'waiting') {
    return
  }
  soundService.playClick()
  gameStore.resetGame()
  addLog('Game reset')
}

const leaveGame = () => {
  hasJoinedRoom.value = false
  gameStore.leaveRoom()
  router.push('/')
}

const handleLogout = () => {
  soundService.playClick()
  hasJoinedRoom.value = false
  cleanupSocketListeners()
  gameStore.cleanup()
  gameStore.leaveRoom()
  userStore.logout()
  router.push('/login')
}

const sendChatMessage = () => {
  if (!chatInput.value || chatInput.value.trim().length === 0) {
    return
  }
  socketService.sendChatMessage(chatInput.value.trim())
  chatInput.value = ''
}

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
  soundService.setEnabled(soundEnabled.value)
  if (soundEnabled.value) {
    soundService.playClick()
  }
}

const increaseSeats = () => {
  if (seatIncreaseDisabled.value) {
    return
  }
  soundService.playClick()
  gameStore.setAICount(Math.min(gameStore.desiredSeatCount + 1, MAX_SEATS))
}

const decreaseSeats = () => {
  const minimumSeats = Math.max(MIN_SEATS, gameStore.realPlayerCount)
  if (seatDecreaseDisabled.value) {
    return
  }
  soundService.playClick()
  const target = Math.max(minimumSeats, gameStore.desiredSeatCount - 1)
  gameStore.setAICount(target)
}

const joinCurrentRoom = () => {
  const targetRoom = roomIdParam.value
  if (!targetRoom) {
    return
  }
  const status = socketService.getStatus()
  if (!status.authenticated) {
    return
  }
  if (!hasJoinedRoom.value) {
    gameLogs.value = []
    chatMessages.value = []
    gameStore.joinRoom(targetRoom)
    addLog('Connected to game server')
    hasJoinedRoom.value = true
  }
}

const ensureAuthenticated = () => {
  if (!userStore.token) {
    return
  }
  const status = socketService.getStatus()
  if (!status.connected) {
    socketService.connect()
    return
  }
  if (!status.authenticated) {
    socketService.authenticate(userStore.token)
    return
  }
  joinCurrentRoom()
}

const handleAuthenticated = () => {
  joinCurrentRoom()
}

const handleConnectionStatus = (data) => {
  if (data?.connected) {
    ensureAuthenticated()
  } else {
    hasJoinedRoom.value = false
  }
}

const handleReconnected = () => {
  hasJoinedRoom.value = false
  ensureAuthenticated()
}

watch(
  () => route.query.roomId,
  (newRoomId) => {
    const resolvedRoom = newRoomId || 'default-room'
    if (roomIdParam.value !== resolvedRoom) {
      roomIdParam.value = resolvedRoom
      hasJoinedRoom.value = false
      if (socketService.getStatus().authenticated) {
        joinCurrentRoom()
      }
    }
  }
)

const showPhaseTransition = (phase) => {
  phaseBannerText.value = phaseNames[phase] || (phase || '').toUpperCase()
  phaseBannerSubtext.value = phaseDescriptions[phase] || ''
  showPhaseBanner.value = true
  setTimeout(() => {
    showPhaseBanner.value = false
  }, 2000)
}

const setupSocketListeners = () => {
  const handlers = {
    game_update: (data) => {
      if (data.gameState && data.gameState.phase && data.gameState.phase !== gameStore.gamePhase) {
        showPhaseTransition(data.gameState.phase)
      }

      if (data.lastAction) {
        const action = data.lastAction
        addLog(`${action.playerName || action.player || 'Player'} ${formatPlayerAction(action)}`)
        const actionType = action.action || action.type
        if (actionType === 'fold') soundService.playFold()
        else if (actionType === 'check') soundService.playCheck()
        else if (actionType === 'call') soundService.playCall()
        else if (actionType === 'bet' || actionType === 'raise') soundService.playRaise()
        else if (actionType === 'all_in') soundService.playAllIn()
      }

      if (gameStore.isMyTurn) {
        soundService.playYourTurn()
      }
    },
    game_started: (data) => {
      soundService.playGameStart()
      soundService.playCardDeal()
      addLog('New hand started')
      if (data?.gameState?.phase) {
        showPhaseTransition(data.gameState.phase)
      }
    },
    game_finished: (data) => {
      const winners =
        data?.winners ||
        data?.results?.winners ||
        (data?.winner ? [data.winner] : [])

      if (Array.isArray(winners) && winners.length > 0) {
        const winnerNames = winners.map((w) => w.name).join(', ')
        const potAmount = data?.pot ?? data?.results?.pot ?? 0
        addLog(`Hand finished. Winner(s): ${winnerNames} (Pot $${potAmount})`)
        const isWinner = winners.some((w) => w.id === userStore.user?.id)
        if (isWinner) {
          soundService.playWin()
        } else {
          soundService.playLose()
        }
      } else {
        addLog('Hand finished. Preparing next hand…')
      }
    },
    player_joined: (data) => {
      const name = data?.player?.name || data?.playerName
      if (!name) {
        return
      }
      soundService.playNotification()
      addLog(`${name} joined the table`)
    },
    player_left: (data) => {
      const name =
        data?.player?.name ||
        data?.playerName ||
        gameStore.players.find((p) => p.id === data?.playerId)?.name ||
        'A player'
      soundService.playNotification()
      addLog(`${name} left the table`)
    },
    action_error: (data) => {
      soundService.playError()
      ElMessage.error(data.error)
      addLog(`Error: ${data.error}`)
    },
    error: (data) => {
      soundService.playError()
      ElMessage.error(data.error)
      addLog(`Error: ${data.error}`)
    },
    chat_message: (data) => {
      chatMessages.value.push({
        userId: data.userId,
        username: data.username,
        message: data.message,
        timestamp: data.timestamp
      })
      if (chatMessages.value.length > 50) {
        chatMessages.value.shift()
      }
    },
    achievements_unlocked: (data) => {
      if (data.playerId === userStore.user?.id) {
        soundService.playSuccess()
        data.achievements.forEach((achievement, index) => {
          setTimeout(() => {
            ElMessage.success({
              message: `🎉 Achievement unlocked ${achievement.icon} ${achievement.name}\n${achievement.description}\nReward: ${achievement.reward} chips`,
              duration: 5000,
              showClose: true
            })
            addLog(`Achievement unlocked: ${achievement.name} (+${achievement.reward} chips)`)
          }, index * 1000)
        })
      } else {
        addLog(`Another player unlocked ${data.achievements.length} achievement(s)`)
      }
    },
    authenticated: handleAuthenticated,
    connection_status: handleConnectionStatus,
    reconnected: handleReconnected
  }

  Object.entries(handlers).forEach(([event, handler]) => {
    registerSocketListener(event, handler)
  })
}

onMounted(() => {
  if (!userStore.isLoggedIn) {
    userStore.initFromStorage()
  }

  if (!userStore.isLoggedIn) {
    ElMessage.error('Please login first')
    router.push('/login')
    return
  }

  roomIdParam.value = route.query.roomId || 'default-room'

  gameStore.initSocket()
  setupSocketListeners()
  ensureAuthenticated()
})

onBeforeUnmount(() => {
  cleanupSocketListeners()
  gameStore.cleanup()
  gameStore.leaveRoom()
  hasJoinedRoom.value = false
})
</script>
<style scoped>
* {
  box-sizing: border-box;
}

.game-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  background:
    radial-gradient(circle at 18% 20%, rgba(59, 130, 246, 0.25), transparent 55%),
    radial-gradient(circle at 82% 80%, rgba(139, 92, 246, 0.25), transparent 55%),
    rgba(15, 23, 42, 0.93);
  color: #f8fafc;
  font-family: 'Inter', 'Segoe UI', sans-serif;
}

.top-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1.5rem;
  padding: 1.25rem 1.5rem;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 50px rgba(15, 23, 42, 0.4);
  backdrop-filter: blur(16px);
}

.room-info h1 {
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.75rem;
  color: rgba(226, 232, 240, 0.8);
  font-size: 0.85rem;
}

.meta-row.secondary {
  color: rgba(148, 163, 184, 0.9);
}

.meta-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  border: 1px solid rgba(148, 163, 184, 0.25);
  font-weight: 500;
}

.control-cluster {
  display: flex;
  gap: 0.75rem;
  align-items: center;
}

.account-panel {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem 1rem;
  background: rgba(30, 41, 59, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 16px;
  min-width: 220px;
}

.account-name {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  font-size: 1rem;
}

.account-name small {
  color: rgba(148, 163, 184, 0.7);
  font-weight: 500;
}

.account-chips {
  font-size: 1.4rem;
  font-weight: 700;
  color: #facc15;
}

.account-stats {
  display: flex;
  gap: 0.75rem;
  font-size: 0.8rem;
  color: rgba(203, 213, 225, 0.85);
}

.btn {
  appearance: none;
  border: none;
  border-radius: 999px;
  padding: 0.45rem 1.1rem;
  font-weight: 600;
  font-size: 0.9rem;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  color: #f8fafc;
  background: rgba(71, 85, 105, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 12px 25px rgba(15, 23, 42, 0.3);
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn.primary {
  background: linear-gradient(135deg, #38bdf8, #6366f1);
  border-color: rgba(148, 163, 184, 0.25);
}

.btn.primary:hover:not(:disabled) {
  box-shadow: 0 18px 35px rgba(99, 102, 241, 0.4);
}

.btn.danger {
  background: linear-gradient(135deg, #f97316, #ef4444);
  border-color: rgba(248, 113, 113, 0.45);
}

.btn.success {
  background: linear-gradient(135deg, #10b981, #059669);
  border-color: rgba(16, 185, 129, 0.45);
}

.btn.success:hover:not(:disabled) {
  box-shadow: 0 18px 35px rgba(16, 185, 129, 0.4);
}

.btn.warning {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  border-color: rgba(245, 158, 11, 0.45);
}

.btn.warning:hover:not(:disabled) {
  box-shadow: 0 18px 35px rgba(245, 158, 11, 0.4);
}

.btn.ghost {
  background: rgba(15, 23, 42, 0.35);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.btn.light {
  background: rgba(148, 163, 184, 0.18);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #e2e8f0;
  padding: 0.35rem 0.9rem;
}

.btn.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  padding: 0;
  font-size: 1rem;
}

.btn.full {
  width: 100%;
}

.phase-banner {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.9), rgba(99, 102, 241, 0.9));
  padding: 2.25rem 3rem;
  border-radius: 1.5rem;
  box-shadow: 0 30px 70px rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.4);
  z-index: 80;
  text-align: center;
  color: #fff;
}

.phase-banner-content h2 {
  margin: 0;
  font-size: 2.25rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.phase-banner-content p {
  margin: 0.75rem 0 0;
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.85);
}

.phase-banner-enter-active {
  animation: banner-in 0.4s ease-out;
}

.phase-banner-leave-active {
  animation: banner-out 0.35s ease-in forwards;
}

@keyframes banner-in {
  from {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.85);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes banner-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8);
  }
}

.content {
  flex: 1;
  display: flex;
  gap: 1.5rem;
}

.table-area {
  flex: 1.8;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: center;
}

.table-felt {
  position: relative;
  width: 100%;
  max-width: 980px;
  aspect-ratio: 16 / 9;
  border-radius: 220px;
  background: radial-gradient(circle at center, rgba(30, 64, 175, 0.18), rgba(15, 23, 42, 0.92));
  border: 2px solid rgba(148, 163, 184, 0.22);
  box-shadow: inset 0 0 60px rgba(15, 23, 42, 0.9), 0 25px 55px rgba(15, 23, 42, 0.5);
  overflow: hidden;
}

.table-glow {
  position: absolute;
  inset: 10%;
  border-radius: 180px;
  border: 1px dashed rgba(148, 163, 184, 0.2);
  pointer-events: none;
}

.pot-info {
  position: absolute;
  top: 10%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  padding: 0.5rem 1rem;
  background: rgba(15, 23, 42, 0.7);
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #e2e8f0;
}

.pot-info .label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(226, 232, 240, 0.75);
}

.pot-info .value {
  font-size: 1.35rem;
  font-weight: 700;
}

.pot-info .call {
  font-size: 0.75rem;
  color: rgba(226, 232, 240, 0.7);
}

.community-row {
  position: absolute;
  top: 40%;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 0.6rem;
}

.card-slot {
  width: 70px;
  height: 98px;
  border-radius: 10px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  background: rgba(30, 41, 59, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.4);
}

.card-slot.revealed {
  background: rgba(15, 23, 42, 0.8);
}

.card-face {
  font-size: 1.35rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.card-face.red {
  color: #f87171;
}

.card-face.black {
  color: #f8fafc;
}

.dealer-chip {
  position: absolute;
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #facc15;
  color: #1f2937;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 25px rgba(250, 204, 21, 0.4);
  border: 2px solid rgba(255, 255, 255, 0.7);
  pointer-events: none;
}

.player-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.seat {
  position: absolute;
  width: 180px;
  pointer-events: none;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.seat-frame {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 18px;
  padding: 0.65rem 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  box-shadow: 0 12px 25px rgba(15, 23, 42, 0.5);
}

.seat-header {
  display: flex;
  justify-content: space-between;
  font-weight: 600;
  font-size: 0.9rem;
}

.seat-header .chips {
  color: #facc15;
}

.seat-body {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  font-size: 0.78rem;
  color: rgba(226, 232, 240, 0.76);
}

.last-action {
  font-weight: 600;
}

.bet-stack {
  color: rgba(125, 211, 252, 0.95);
}

.hole-cards {
  display: flex;
  gap: 0.4rem;
}

.hole-cards .card-slot {
  width: 46px;
  height: 64px;
  border-radius: 8px;
  background: rgba(15, 23, 42, 0.85);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.seat.me .seat-frame {
  border-color: rgba(56, 189, 248, 0.5);
  box-shadow: 0 16px 40px rgba(56, 189, 248, 0.25);
}

.seat.active .seat-frame {
  border-color: rgba(129, 140, 248, 0.65);
  box-shadow: 0 18px 45px rgba(99, 102, 241, 0.35);
}

.seat.folded {
  opacity: 0.45;
}

.seat.allin .seat-frame {
  border-color: rgba(250, 204, 21, 0.6);
}

.seat-0 { top: 8%; left: 15%; }
.seat-1 { top: 5%; left: 50%; transform: translateX(-50%); }
.seat-2 { top: 8%; right: 15%; }
.seat-3 { bottom: 14%; right: 10%; }
.seat-4 { bottom: 6%; left: 50%; transform: translateX(-50%); }
.seat-5 { bottom: 14%; left: 10%; }

.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1rem;
  color: rgba(226, 232, 240, 0.75);
  background: rgba(15, 23, 42, 0.6);
  padding: 0.75rem 1.2rem;
  border-radius: 12px;
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.table-footer {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
}

.host-controls {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.seat-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(15, 23, 42, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.25);
  padding: 0.4rem 0.6rem;
  border-radius: 999px;
}

.ai-controls {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
}

.waiting-banner {
  font-size: 0.95rem;
  color: rgba(226, 232, 240, 0.85);
  background: rgba(15, 23, 42, 0.55);
  border: 1px solid rgba(148, 163, 184, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 12px;
}

.sidebar {
  flex: 1;
  display: grid;
  gap: 1rem;
  grid-template-rows: min-content min-content 1fr 1fr;
}

.sidebar section {
  background: rgba(15, 23, 42, 0.65);
  border: 1px solid rgba(148, 163, 184, 0.2);
  border-radius: 18px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
}

.sidebar h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}

.action-panel.inactive {
  opacity: 0.55;
}

.action-buttons {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.6rem;
}

.raise-panel {
  background: rgba(30, 41, 59, 0.75);
  border: 1px solid rgba(148, 163, 184, 0.25);
  border-radius: 16px;
  padding: 0.75rem;
  gap: 0.65rem;
  display: flex;
  flex-direction: column;
}

.raise-panel header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
}

.raise-panel .icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(148, 163, 184, 0.2);
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.slider-row input[type='range'] {
  flex: 1;
  accent-color: #6366f1;
  height: 4px;
}

.slider-value {
  font-weight: 600;
  font-size: 0.95rem;
}

.quick-raise {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.quick-raise .btn {
  padding: 0.4rem 0;
}

.info-panel ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.info-panel li {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  color: rgba(226, 232, 240, 0.8);
}

.log-scroll,
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.log-entry {
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.78);
  padding: 0.35rem 0.45rem;
  border-radius: 10px;
  background: rgba(30, 41, 59, 0.6);
}

.chat-line {
  display: flex;
  gap: 0.4rem;
  font-size: 0.8rem;
  color: rgba(226, 232, 240, 0.85);
}

.chat-line.mine {
  color: #38bdf8;
}

.chat-line .user {
  font-weight: 600;
}

.chat-input-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
}

.chat-input-row input {
  flex: 1;
  background: rgba(15, 23, 42, 0.7);
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 12px;
  padding: 0.55rem 0.75rem;
  color: #f8fafc;
  font-size: 0.85rem;
}

.chat-input-row input::placeholder {
  color: rgba(148, 163, 184, 0.6);
}

.raise-panel-enter-active {
  animation: raise-in 0.25s ease-out;
}

.raise-panel-leave-active {
  animation: raise-out 0.2s ease-in forwards;
}

@keyframes raise-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes raise-out {
  from {
    opacity: 1;
    transform: translateY(0);
  }
  to {
    opacity: 0;
    transform: translateY(10px);
  }
}

@media (max-width: 1200px) {
  .content {
    flex-direction: column;
  }
  .sidebar {
    grid-template-rows: repeat(4, minmax(0, auto));
  }
}

@media (max-width: 768px) {
  .game-screen {
    padding: 1rem;
  }
  .content {
    gap: 1rem;
  }
  .table-felt {
    aspect-ratio: 4 / 3;
  }
  .seat {
    width: 150px;
  }
  .seat-0 { top: 6%; left: 8%; }
  .seat-1 { top: 2%; left: 50%; transform: translateX(-50%); }
  .seat-2 { top: 6%; right: 8%; }
  .seat-3 { bottom: 16%; right: 6%; }
  .seat-4 { bottom: 8%; left: 50%; transform: translateX(-50%); }
  .seat-5 { bottom: 16%; left: 6%; }
}
</style>
