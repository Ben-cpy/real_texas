<template>
  <div class="game">
    <!-- Game Header -->
    <header class="game-header">
      <div class="game-info">
        <h1 class="game-title">德州扑克</h1>
        <div class="room-details">
          <span class="room-id">房间: {{ gameStore.roomId || 'N/A' }}</span>
          <span class="blinds">底注: ${{ gameStore.smallBlind }}/${{ gameStore.bigBlind }}</span>
          <span class="seats">座位: {{ gameStore.players.length }}/{{ gameStore.desiredSeatCount }}</span>
        </div>
      </div>
      <div class="user-controls">
        <div class="user-identity">
          <span class="username">{{ userStore.username }}</span>
          <span v-if="gameStore.isRoomCreator" class="user-role">房主</span>
        </div>
        <div class="control-buttons">
          <div
            v-if="gameStore.isRoomCreator && gameStore.gamePhase === 'waiting'"
            class="player-seat-controls"
          >
            <button
              class="btn btn-secondary"
              @click="decreaseSeats"
              :disabled="seatDecreaseDisabled"
              title="减少座位"
            >
              -
            </button>
            <span class="seat-count">座位 {{ gameStore.desiredSeatCount }}</span>
            <span class="ai-count">AI {{ aiPlayerCount }}</span>
            <button
              class="btn btn-secondary"
              @click="increaseSeats"
              :disabled="seatIncreaseDisabled"
              title="增加座位"
            >
              +
            </button>
          </div>
          <button
            v-if="gameStore.gamePhase === 'waiting' && gameStore.isRoomCreator"
            class="btn btn-success"
            @click="startGame"
            :disabled="!gameStore.canStartGame"
          >
            开始游戏 ({{ gameStore.players.length }}/{{ gameStore.desiredSeatCount }})
          </button>
          <span
            v-if="gameStore.gamePhase === 'waiting' && !gameStore.isRoomCreator"
            class="waiting-status"
          >
            等待房主开始…
          </span>
          <button
            class="btn"
            :class="soundEnabled ? 'btn-primary' : 'btn-secondary'"
            @click="toggleSound"
            title="切换音效"
          >
            {{ soundEnabled ? '🔊' : '🔇' }}
          </button>
          <button class="btn btn-warning" @click="resetGame">重开</button>
          <button class="btn btn-danger" @click="leaveGame">离开</button>
        </div>
      </div>
    </header>

    <!-- Main Game Area -->
    <main class="game-main">
      <!-- Poker Table Container -->
      <section class="table-container">
        <div class="poker-table" ref="pokerTableRef">
          <!-- Community Cards Area -->
          <div class="community-area">
            <div class="pot-display">
              <div class="pot-amount">奖池 ${{ gameStore.totalPot }}</div>
              <div class="current-bet" v-if="gameStore.currentBet > 0">下注 ${{ gameStore.currentBet }}</div>
            </div>
            <div class="community-cards">
              <div
                v-for="(card, index) in gameStore.communityCards"
                :key="`community-${index}`"
                class="game-card"
              >
                <span :class="getCardColor(card.suit)">
                  {{ card.suit }}{{ card.rank }}
                </span>
              </div>
            </div>
          </div>

          <!-- Players Around Table -->
          <div class="players-container">
            <div
              v-for="(player, index) in gameStore.players"
              :key="player.id"
              class="player-seat"
              :class="{
                'active-player': index === gameStore.currentPlayerIndex,
                'folded-player': player.folded,
                'all-in-player': player.allIn,
                'current-user': player.id === userStore.user?.id
              }"
              :style="getPlayerPosition(index)"
            >
              <!-- Player Avatar -->
              <div class="player-avatar">
                <div class="avatar-image">
                  <span class="avatar-initial">{{ player.name.charAt(0).toUpperCase() }}</span>
                  <span v-if="player.isAI" class="ai-badge">AI</span>
                </div>
              </div>

              <!-- Player Info -->
              <div class="player-details">
                <div class="player-name">{{ player.name }}</div>
                <div class="player-chips">${{ player.chips }}</div>
                <div class="player-action" v-if="player.lastAction">
                  {{ getActionText(player.lastAction) }}
                </div>
                <div class="player-bet" v-if="player.currentBet > 0">
                  ${{ player.currentBet }}
                </div>
              </div>

              <!-- Player Cards -->
              <div class="player-cards" v-if="player.cards && player.cards.length > 0">
                <div
                  v-for="(card, cardIndex) in player.cards"
                  :key="`${player.id}-card-${cardIndex}`"
                  class="game-card player-card"
                  :class="{
                    'own-card': player.id === userStore.user?.id,
                    'opponent-card': player.id !== userStore.user?.id,
                    'card-back': player.id !== userStore.user?.id && !card.revealed
                  }"
                >
                  <span v-if="player.id === userStore.user?.id || card.revealed" :class="getCardColor(card.suit)">
                    {{ card.suit }}{{ card.rank }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Side Panel -->
      <aside class="side-panel">
        <!-- Action Panel -->
        <section class="action-panel" v-if="gameStore.isMyTurn">
          <h3 class="panel-title">您的回合</h3>

          <!-- Primary Actions -->
          <div class="primary-actions">
            <button class="action-btn fold-btn" @click="fold">
              <span class="btn-label">FOLD</span>
              <span class="btn-desc">弃牌</span>
            </button>

            <button
              class="action-btn call-btn"
              @click="canCheck ? check() : call()"
            >
              <span class="btn-label">{{ canCheck ? 'CHECK' : 'CALL' }}</span>
              <span class="btn-desc">
                {{ canCheck ? '过牌' : `跟注 $${callAmount}` }}
              </span>
            </button>

            <button
              class="action-btn raise-btn"
              @click="showRaiseDialog = true"
            >
              <span class="btn-label">RAISE</span>
              <span class="btn-desc">加注</span>
            </button>

            <button class="action-btn allin-btn" @click="allIn">
              <span class="btn-label">ALL-IN</span>
              <span class="btn-desc">全下</span>
            </button>
          </div>

          <!-- Raise Dialog -->
          <div v-if="showRaiseDialog" class="raise-dialog">
            <h4>加注金额</h4>
            <input
              v-model.number="raiseAmount"
              type="number"
              :min="gameStore.minRaise"
              :max="gameStore.myPlayer?.chips"
              class="raise-input"
            />
            <div class="raise-actions">
              <button @click="showRaiseDialog = false" class="btn btn-secondary">取消</button>
              <button @click="raise" class="btn btn-primary">确认加注</button>
            </div>
          </div>
        </section>

        <!-- Chat Panel -->
        <section class="chat-panel">
          <h3 class="panel-title">聊天</h3>
          <div class="chat-messages">
            <div v-for="(msg, index) in chatMessages" :key="index" class="chat-message" :class="{ 'own-message': msg.userId === userStore.user?.id }">
              <span class="chat-username">{{ msg.username }}:</span>
              <span class="chat-text">{{ msg.message }}</span>
            </div>
          </div>
          <div class="chat-input-container">
            <input
              v-model="chatInput"
              @keyup.enter="sendChatMessage"
              type="text"
              placeholder="输入消息..."
              class="chat-input"
              maxlength="200"
            />
            <button @click="sendChatMessage" class="btn btn-primary chat-send-btn">发送</button>
          </div>
        </section>

        <!-- Game Log -->
        <section class="game-log">
          <h3 class="panel-title">游戏记录</h3>
          <div class="log-entries">
            <div v-for="(log, index) in gameLogs" :key="index" class="log-entry">
              {{ log }}
            </div>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
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

const MAX_SEATS = 6
const MIN_SEATS = 3

// UI state
const pokerTableRef = ref(null)
const showRaiseDialog = ref(false)
const raiseAmount = ref(0)
const gameLogs = ref([])
const chatMessages = ref([])
const chatInput = ref('')
const soundEnabled = ref(soundService.enabled)

// Computed properties
const canCheck = computed(() => gameStore.currentBet === 0)
const callAmount = computed(() => {
  if (!gameStore.myPlayer) return 0
  return gameStore.currentBet - (gameStore.myPlayer.currentBet || 0)
})

const aiPlayerCount = computed(() => gameStore.aiPlayerCount)
const seatDecreaseDisabled = computed(() => {
  const minimumSeats = Math.max(MIN_SEATS, gameStore.realPlayerCount)
  return gameStore.desiredSeatCount <= minimumSeats
})
const seatIncreaseDisabled = computed(() => gameStore.desiredSeatCount >= MAX_SEATS)

// Methods
const getPlayerPosition = (index) => {
  if (!pokerTableRef.value) {
    return { transform: 'translate(0px, 0px)' }
  }

  const container = pokerTableRef.value
  const containerRect = container.getBoundingClientRect()
  const containerWidth = containerRect.width || 600
  const containerHeight = containerRect.height || 400

  const totalPlayers = gameStore.players.length
  const angle = (360 / totalPlayers) * index - 90 // Start from top

  const radiusX = Math.min(containerWidth * 0.35, 280)
  const radiusY = Math.min(containerHeight * 0.3, 160)

  const x = Math.cos((angle * Math.PI) / 180) * radiusX
  const y = Math.sin((angle * Math.PI) / 180) * radiusY

  return {
    transform: `translate(${x}px, ${y}px)`
  }
}

const getCardColor = (suit) => {
  if (suit === '♥' || suit === '♦') {
    return 'red-suit'
  } else {
    return 'black-suit'
  }
}

const getActionText = (action) => {
  const actionMap = {
    'call': 'CALL',
    'raise': 'RAISE',
    'fold': 'FOLD',
    'check': 'CHECK',
    'all_in': 'ALL-IN',
    'bet': 'BET'
  }
  return actionMap[action] || action.toUpperCase()
}

// Game actions
const fold = () => {
  soundService.playFold()
  gameStore.sendAction('fold')
  addLog('您选择了弃牌')
}

const check = () => {
  soundService.playCheck()
  gameStore.sendAction('check')
  addLog('您选择了过牌')
}

const call = () => {
  soundService.playCall()
  gameStore.sendAction('call')
  addLog(`您跟注 $${callAmount.value}`)
}

const raise = () => {
  if (raiseAmount.value < gameStore.minRaise) {
    soundService.playError()
    ElMessage.error(`最小加注金额为 $${gameStore.minRaise}`)
    return
  }
  soundService.playRaise()
  gameStore.sendAction('raise', raiseAmount.value)
  addLog(`您加注 $${raiseAmount.value}`)
  showRaiseDialog.value = false
}

const allIn = () => {
  soundService.playAllIn()
  gameStore.sendAction('all_in')
  addLog('您选择了全下！')
}

const startGame = () => {
  soundService.playGameStart()
  gameStore.startGame()
  addLog('游戏开始！')
}

const resetGame = () => {
  soundService.playClick()
  gameStore.resetGame()
  addLog('游戏重置')
}

const leaveGame = () => {
  gameStore.leaveRoom()
  router.push('/')
}

const addLog = (message) => {
  gameLogs.value.unshift(`[${new Date().toLocaleTimeString()}] ${message}`)
  if (gameLogs.value.length > 50) {
    gameLogs.value.pop()
  }
}

const sendChatMessage = () => {
  if (!chatInput.value || chatInput.value.trim().length === 0) {
    return
  }
  socketService.sendChatMessage(chatInput.value)
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

// Socket event handlers
const setupSocketListeners = () => {
  // Log game events
  socketService.on('game_update', (data) => {
    if (data.lastAction) {
      const action = data.lastAction
      addLog(`${action.playerName} ${getActionText(action.action)}${action.amount ? ` $${action.amount}` : ''}`)

      // Play sound for actions
      if (action.action === 'fold') soundService.playFold()
      else if (action.action === 'check') soundService.playCheck()
      else if (action.action === 'call') soundService.playCall()
      else if (action.action === 'bet' || action.action === 'raise') soundService.playRaise()
      else if (action.action === 'all_in') soundService.playAllIn()
    }

    // Check if it's the current player's turn
    if (gameStore.isMyTurn) {
      soundService.playYourTurn()
    }
  })

  socketService.on('game_started', () => {
    soundService.playGameStart()
    soundService.playCardDeal()
    addLog('游戏已开始！')
  })

  socketService.on('game_finished', (data) => {
    if (data.winners && data.winners.length > 0) {
      const winnerNames = data.winners.map(w => w.name).join(', ')
      addLog(`游戏结束！获胜者: ${winnerNames}`)

      // Check if current user is the winner
      const isWinner = data.winners.some(w => w.id === userStore.user?.id)
      if (isWinner) {
        soundService.playWin()
      } else {
        soundService.playLose()
      }
    }
  })

  socketService.on('player_joined', (data) => {
    soundService.playNotification()
    addLog(`${data.player.name} 加入了游戏`)
  })

  socketService.on('player_left', (data) => {
    soundService.playNotification()
    addLog(`${data.player.name} 离开了游戏`)
  })

  socketService.on('action_error', (data) => {
    soundService.playError()
    ElMessage.error(data.error)
    addLog(`错误: ${data.error}`)
  })

  socketService.on('error', (data) => {
    soundService.playError()
    ElMessage.error(data.error)
    addLog(`错误: ${data.error}`)
  })

  socketService.on('chat_message', (data) => {
    chatMessages.value.push({
      userId: data.userId,
      username: data.username,
      message: data.message,
      timestamp: data.timestamp
    })
    // Keep only last 50 messages
    if (chatMessages.value.length > 50) {
      chatMessages.value.shift()
    }
  })

  socketService.on('achievements_unlocked', (data) => {
    if (data.playerId === userStore.user?.id) {
      // Play success sound
      soundService.playSuccess()

      // Show achievement notifications
      data.achievements.forEach((achievement, index) => {
        setTimeout(() => {
          ElMessage.success({
            message: `🎉 成就解锁！${achievement.icon} ${achievement.name}\n${achievement.description}\n奖励: ${achievement.reward} 筹码`,
            duration: 5000,
            showClose: true
          })
          addLog(`解锁成就: ${achievement.name} (+${achievement.reward} 筹码)`)
        }, index * 1000)
      })
    } else {
      // Another player unlocked achievement
      addLog(`玩家解锁了 ${data.achievements.length} 个成就`)
    }
  })
}

// Lifecycle
onMounted(async () => {
  // Check if user is logged in
  if (!userStore.isLoggedIn) {
    ElMessage.error('请先登录')
    router.push('/login')
    return
  }

  // Get room ID from query params or use default
  const roomIdParam = route.query.roomId || 'default-room'

  // Initialize stores
  gameStore.initSocket()
  setupSocketListeners()

  // Connect socket
  socketService.connect()

  // Wait for socket to connect
  setTimeout(() => {
    if (socketService.getStatus().connected) {
      socketService.authenticate(userStore.token)

      // Wait for authentication
      socketService.on('authenticated', () => {
        gameStore.joinRoom(roomIdParam)
        addLog('已连接到游戏服务器')
      })
    } else {
      ElMessage.error('无法连接到游戏服务器')
    }
  }, 500)
})

onBeforeUnmount(() => {
  gameStore.cleanup()
  gameStore.leaveRoom()
})
</script>

<style scoped>
/* Import CSS Custom Properties */
.game {
  min-height: 100vh;
  background: var(--color-background);
  padding: var(--space-md);
  position: relative;
  display: flex;
  flex-direction: column;
  color: var(--color-text-primary);
  container-type: size;
  overflow: hidden;
}

/* Ambient Background Effects */
.game::before {
  content: '';
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(245, 158, 11, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(31, 41, 55, 0.12) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}

/* Header Styles */
.game-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-lg);
  background: var(--color-surface);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius-lg);
  padding: var(--space-md) var(--space-lg);
  margin-bottom: var(--space-md);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.game-title {
  color: var(--color-text-primary);
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: 700;
  letter-spacing: -0.025em;
  line-height: var(--line-height-tight);
}

.room-details {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-xs);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.room-id,
.blinds {
  font-weight: 500;
}

.user-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  align-items: flex-end;
}

.user-identity {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.username {
  color: var(--color-text-primary);
  font-weight: 600;
  font-size: var(--font-size-md);
}

.user-role {
  background: var(--color-warning);
  color: #1f2937;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-xs);
  font-weight: 700;
}

.control-buttons {
  display: flex;
  gap: var(--space-sm);
  flex-wrap: wrap;
}

.waiting-status {
  color: var(--color-warning);
  font-style: italic;
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: var(--space-xs) var(--space-sm);
  align-self: center;
}

/* Main Game Layout */
.game-main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--space-lg);
  min-height: 0;
  position: relative;
  z-index: 1;
}

.table-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.side-panel {
  width: clamp(280px, 25vw, 320px);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  flex-shrink: 0;
}

/* Poker Table Styles */
.poker-table {
  position: relative;
  width: clamp(500px, 80vw, 800px);
  height: clamp(350px, 60vh, 500px);
  aspect-ratio: 8 / 5;
  background: 
    radial-gradient(ellipse at center, #0b3d2e 0%, #083529 40%, #062e1a 80%);
  border-radius: 50% / 35%;
  border: clamp(4px, 1vw, 8px) solid #1f2937;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 0 0 2px rgba(245, 158, 11, 0.3),
    var(--shadow-lg),
    inset 0 0 clamp(20px, 3vw, 40px) rgba(0, 0, 0, 0.4);
  container-type: size;
}

.poker-table::before {
  content: '';
  position: absolute;
  inset: calc(-1 * clamp(4px, 1vw, 8px));
  background: linear-gradient(135deg, 
    #1f2937 0%,
    #374151 15%,
    rgba(245, 158, 11, 0.3) 45%,
    rgba(245, 158, 11, 0.5) 50%,
    rgba(245, 158, 11, 0.3) 55%,
    #374151 85%,
    #1f2937 100%
  );
  border-radius: 50% / 35%;
  z-index: -1;
}

.poker-table::after {
  content: '';
  position: absolute;
  top: clamp(8px, 2vw, 16px);
  left: clamp(12px, 3vw, 24px);
  right: clamp(12px, 3vw, 24px);
  bottom: clamp(8px, 2vw, 16px);
  border: 1px dashed rgba(248, 250, 252, 0.15);
  border-radius: 50% / 35%;
  pointer-events: none;
}

/* Community Area */
.community-area {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 10;
  text-align: center;
}

.pot-display {
  background: rgba(31, 41, 55, 0.8);
  border-radius: var(--border-radius-lg);
  padding: var(--space-md);
  margin-bottom: var(--space-md);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(245, 158, 11, 0.3);
  box-shadow: var(--shadow-md);
}

.community-cards {
  display: flex;
  gap: var(--space-sm);
  justify-content: center;
  flex-wrap: wrap;
}

.pot-amount {
  color: var(--color-warning);
  font-family: 'Montserrat', sans-serif;
  font-weight: 800;
  font-size: clamp(1.2rem, 3vw, 1.8rem);
  margin: 0;
  text-shadow: 0 0 12px rgba(245, 158, 11, 0.6);
  letter-spacing: 0.5px;
}

.current-bet {
  color: var(--color-text-primary);
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: var(--font-size-md);
  margin-top: var(--space-xs);
  opacity: 0.9;
}



/* Card Styles */
.game-card {
  width: clamp(32px, 4vw, 54px);
  height: clamp(46px, 5.6vw, 76px);
  aspect-ratio: var(--card-aspect-ratio);
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  border-radius: var(--border-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Montserrat', sans-serif;
  font-size: clamp(0.8rem, 2vw, 1.3rem);
  font-weight: 700;
  box-shadow: var(--shadow-md), inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: all var(--transition-base);
  position: relative;
  transform-style: preserve-3d;
}

@media (hover: hover) {
  .game-card:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.95);
  }
}

/* Card Animations */
@keyframes deal-card {
  0% {
    transform: translateX(-200px) translateY(-100px) rotate(15deg) scale(0.8);
    opacity: 0;
  }
  50% {
    opacity: 0.7;
  }
  100% {
    transform: translateX(0) translateY(0) rotate(0deg) scale(1);
    opacity: 1;
  }
}

.game-card.dealing {
  animation: deal-card 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes flip-card {
  0% {
    transform: rotateY(0deg);
  }
  50% {
    transform: rotateY(90deg) scale(0.95);
  }
  100% {
    transform: rotateY(0deg) scale(1);
  }
}

.game-card.flipping {
  animation: flip-card 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Deal Animation Delays */
.community-cards .game-card:nth-child(1) { animation-delay: 0ms; }
.community-cards .game-card:nth-child(2) { animation-delay: 50ms; }
.community-cards .game-card:nth-child(3) { animation-delay: 100ms; }
.community-cards .game-card:nth-child(4) { animation-delay: 200ms; }
.community-cards .game-card:nth-child(5) { animation-delay: 250ms; }

/* Card States */
.player-card {
  width: clamp(24px, 3vw, 42px);
  height: clamp(34px, 4.2vw, 59px);
  font-size: clamp(0.6rem, 1.5vw, 1rem);
}

.own-card {
  width: clamp(32px, 4vw, 50px);
  height: clamp(46px, 5.6vw, 70px);
  background: #ffffff;
  font-size: clamp(0.8rem, 2vw, 1.2rem);
}

.game-card.revealed {
  transform: rotateY(0deg);
}

.game-card:not(.revealed) {
  background: #4a5568;
  color: #fff;
}

/* Card Back Design */
.card-back {
  background: 
    linear-gradient(135deg, #1e40af 0%, #1d4ed8 25%, #2563eb 50%, #1d4ed8 75%, #1e40af 100%),
    radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  background-size: 100% 100%, 20px 20px;
  position: relative;
  overflow: hidden;
  color: transparent;
}

.card-back::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: 
    repeating-linear-gradient(45deg, 
      transparent 0px, 
      transparent 2px, 
      rgba(255, 255, 255, 0.08) 2px, 
      rgba(255, 255, 255, 0.08) 4px
    );
  background-size: 8px 8px;
}

.card-back::after {
  content: '';
  position: absolute;
  inset: 3px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--border-radius-sm);
  background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
}

/* Players Layout */
.players-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.player-seat {
  position: absolute;
  top: 50%;
  left: 50%;
  width: clamp(100px, 15vw, 160px);
  height: clamp(80px, 12vw, 140px);
  margin-left: clamp(-50px, -7.5vw, -80px);
  margin-top: clamp(-40px, -6vw, -70px);
  text-align: center;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  pointer-events: auto;
  transition: all var(--transition-base);
}

/* Player Avatar */
.player-avatar {
  position: relative;
  width: clamp(40px, 6vw, 60px);
  height: clamp(40px, 6vw, 60px);
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
  border: clamp(2px, 0.5vw, 3px) solid #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  box-shadow: var(--shadow-md), inset 0 2px 4px rgba(255, 255, 255, 0.1);
}

.avatar-initial {
  color: var(--color-text-primary);
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: clamp(0.8rem, 2vw, 1.2rem);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* Active Player Highlight */
.active-player .avatar-image {
  border-color: var(--color-warning);
  box-shadow: 
    0 4px 16px rgba(245, 158, 11, 0.4),
    0 0 0 2px rgba(245, 158, 11, 0.6),
    inset 0 2px 4px rgba(255, 255, 255, 0.2);
  animation: pulse-glow 2s infinite;
}

/* Countdown Timer */
.countdown-timer {
  position: absolute;
  top: clamp(-3px, -0.5vw, -4px);
  left: clamp(-3px, -0.5vw, -4px);
  width: calc(100% + clamp(6px, 1vw, 8px));
  height: calc(100% + clamp(6px, 1vw, 8px));
  z-index: 1;
}

.timer-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.timer-bg {
  fill: none;
  stroke: rgba(75, 85, 99, 0.3);
  stroke-width: 2;
}

.timer-progress {
  fill: none;
  stroke: var(--color-warning);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-dasharray: 100, 100;
  transition: stroke-dasharray var(--transition-base);
}

@keyframes pulse-glow {
  0%, 100% { 
    box-shadow: 
      0 4px 16px rgba(245, 158, 11, 0.4),
      0 0 0 2px rgba(245, 158, 11, 0.6),
      inset 0 2px 4px rgba(255, 255, 255, 0.2);
  }
  50% { 
    box-shadow: 
      0 4px 20px rgba(245, 158, 11, 0.6),
      0 0 0 3px rgba(245, 158, 11, 0.8),
      inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
}

@keyframes countdown-tick {
  0% { stroke-dasharray: 100, 100; }
  100% { stroke-dasharray: 0, 100; }
}

/* Player Info */
.player-details {
  background: rgba(31, 41, 55, 0.9);
  backdrop-filter: blur(12px);
  border-radius: var(--border-radius-md);
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-xs);
  border: 1px solid rgba(245, 158, 11, 0.2);
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(245, 158, 11, 0.1);
  transition: all var(--transition-base);
  min-width: clamp(80px, 12vw, 120px);
}

.active-player .player-details {
  border: 1px solid rgba(245, 158, 11, 0.5);
  box-shadow: 
    0 4px 12px rgba(245, 158, 11, 0.3),
    0 0 0 1px rgba(245, 158, 11, 0.3),
    inset 0 1px 0 rgba(245, 158, 11, 0.2);
}

.folded-player .player-details {
  background: rgba(75, 85, 99, 0.6);
  opacity: 0.6;
  border: 1px solid rgba(107, 114, 128, 0.3);
}

/* Player Action Tags */
.player-action {
  display: inline-block;
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  color: #1f2937;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: clamp(0.6rem, 1.2vw, 0.8rem);
  padding: var(--space-xs);
  border-radius: var(--border-radius-sm);
  margin: var(--space-xs) 0;
  letter-spacing: 0.5px;
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(217, 119, 6, 0.5);
}

.player-name {
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: var(--space-xs);
  font-size: clamp(0.75rem, 1.5vw, 0.9rem);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.player-chips {
  color: var(--color-warning);
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: clamp(0.7rem, 1.4vw, 0.85rem);
  margin-bottom: var(--space-xs);
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.player-bet {
  color: var(--color-text-primary);
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: clamp(0.6rem, 1.2vw, 0.75rem);
  background: rgba(245, 158, 11, 0.25);
  padding: var(--space-xs);
  border-radius: var(--border-radius-sm);
  border: 1px solid rgba(245, 158, 11, 0.4);
  box-shadow: var(--shadow-sm), inset 0 1px 0 rgba(255, 255, 255, 0.2);
  margin-top: var(--space-xs);
  display: inline-block;
}

/* Player State Styles */
.active-player .player-name {
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.active-player .player-chips {
  text-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
}

.folded-player .player-name {
  color: #9ca3af;
  text-shadow: none;
}

.folded-player .player-chips {
  color: #6b7280;
  text-shadow: none;
}

.folded-player .player-bet {
  color: #9ca3af;
  background: rgba(156, 163, 175, 0.2);
  border: 1px solid rgba(156, 163, 175, 0.3);
  box-shadow: none;
}

.player-cards {
  display: flex;
  gap: clamp(2px, 0.5vw, 4px);
  justify-content: center;
  margin-top: var(--space-xs);
}

/* Action Panel Styles */
.action-panel {
  background: var(--color-surface);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-lg);
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(245, 158, 11, 0.1);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.panel-title {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: 700;
  margin: 0;
  text-align: center;
}

/* Primary Action Buttons */
.primary-actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
}

.action-btn {
  background: rgba(75, 85, 99, 0.9);
  border: 1px solid rgba(107, 114, 128, 0.4);
  border-radius: var(--border-radius-md);
  padding: var(--space-sm);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  font-family: 'Montserrat', sans-serif;
  position: relative;
  overflow: hidden;
  min-height: var(--min-touch-size);
}

@media (hover: hover) {
  .action-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 
      var(--shadow-md),
      0 0 0 1px rgba(245, 158, 11, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }
}

.action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.action-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.btn-label {
  font-weight: 700;
  font-size: var(--font-size-sm);
  letter-spacing: 0.5px;
  color: var(--color-text-primary);
}

.btn-desc {
  font-weight: 500;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}

/* Button Variants */
.fold-btn {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.8) 0%, rgba(185, 28, 28, 0.8) 100%);
  border: 1px solid rgba(239, 68, 68, 0.4);
}

@media (hover: hover) {
  .fold-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%);
    box-shadow: 
      0 4px 12px rgba(220, 38, 38, 0.4),
      0 0 0 1px rgba(239, 68, 68, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

.call-btn {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.8) 100%);
  border: 1px solid rgba(96, 165, 250, 0.4);
}

@media (hover: hover) {
  .call-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(96, 165, 250, 0.9) 0%, rgba(59, 130, 246, 0.9) 100%);
    box-shadow: 
      0 4px 12px rgba(59, 130, 246, 0.4),
      0 0 0 1px rgba(96, 165, 250, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }
}

.raise-btn {
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  border: 1px solid #fbbf24;
  animation: pulse-main-btn 2s infinite;
}

@media (hover: hover) {
  .raise-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #fbbf24 0%, var(--color-warning) 100%);
    box-shadow: 
      0 6px 16px rgba(245, 158, 11, 0.5),
      0 0 0 2px rgba(251, 191, 36, 0.7),
      inset 0 1px 0 rgba(255, 255, 255, 0.3);
    animation: none;
  }
}

.raise-btn .btn-label {
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.raise-btn .btn-desc {
  color: #374151;
}

@keyframes pulse-main-btn {
  0%, 100% { 
    box-shadow: 
      0 4px 12px rgba(245, 158, 11, 0.4),
      0 0 0 1px rgba(245, 158, 11, 0.5);
  }
  50% { 
    box-shadow: 
      0 6px 16px rgba(245, 158, 11, 0.6),
      0 0 0 2px rgba(245, 158, 11, 0.7);
  }
}

/* Betting Controls */
.betting-controls {
  background: rgba(31, 41, 55, 0.5);
  border-radius: var(--border-radius-md);
  padding: var(--space-md);
  border: 1px solid rgba(75, 85, 99, 0.3);
}

.slider-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.bet-slider {
  width: 100%;
  height: clamp(4px, 1vw, 6px);
  background: linear-gradient(to right, rgba(75, 85, 99, 0.5) 0%, rgba(245, 158, 11, 0.3) 100%);
  border-radius: 3px;
  outline: none;
  cursor: pointer;
  -webkit-appearance: none;
  appearance: none;
}

.bet-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: clamp(16px, 3vw, 20px);
  height: clamp(16px, 3vw, 20px);
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fbbf24;
  box-shadow: var(--shadow-sm);
}

.bet-slider::-moz-range-thumb {
  width: clamp(16px, 3vw, 20px);
  height: clamp(16px, 3vw, 20px);
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fbbf24;
  box-shadow: var(--shadow-sm);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-family: 'Montserrat', sans-serif;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.current-label {
  color: var(--color-warning);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

/* Quick Bet Buttons */
.quick-bets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-sm);
}

.quick-bet-btn {
  background: rgba(31, 41, 55, 0.9);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--border-radius-sm);
  padding: var(--space-xs) var(--space-xs);
  cursor: pointer;
  transition: all var(--transition-base);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  font-family: 'Montserrat', sans-serif;
  min-height: calc(var(--min-touch-size) * 0.8);
}

@media (hover: hover) {
  .quick-bet-btn:hover:not(:disabled) {
    background: rgba(245, 158, 11, 0.15);
    border-color: rgba(245, 158, 11, 0.5);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
  }
}

.quick-bet-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.quick-bet-btn:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.bet-type {
  font-size: clamp(0.6rem, 1.2vw, 0.7rem);
  font-weight: 700;
  color: var(--color-warning);
  letter-spacing: 0.3px;
}

.bet-amount {
  font-size: clamp(0.55rem, 1.1vw, 0.65rem);
  font-weight: 500;
  color: var(--color-text-secondary);
}

.all-in-btn {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

@media (hover: hover) {
  .all-in-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(248, 113, 113, 0.9) 0%, rgba(239, 68, 68, 0.9) 100%);
    border-color: rgba(248, 113, 113, 0.6);
    box-shadow: var(--shadow-sm);
  }
}

.all-in-btn .bet-type {
  color: #fecaca;
}

.all-in-btn .bet-amount {
  color: #fed7d7;
}

/* 筹码移动动画 - 320-380ms */
@keyframes chip-move-to-pot {
  0% {
    transform: translateX(0) translateY(0) scale(1);
    opacity: 1;
  }
  50% {
    transform: translateX(-100px) translateY(-50px) scale(0.8);
    opacity: 0.8;
  }
  100% {
    transform: translateX(-200px) translateY(-100px) scale(0.6);
    opacity: 0;
  }
}

.chip.moving-to-pot {
  animation: chip-move-to-pot 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;
}

@keyframes chip-stack-bounce {
  0% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.1); }
  100% { transform: translateY(0) scale(1); }
}

.chip-stack.adding {
  animation: chip-stack-bounce 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

/* 玩家动作提示动画 */
@keyframes action-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.8;
  }
  50% {
    transform: scale(1.05);
    opacity: 1;
  }
}

.player-seat.taking-action {
  animation: action-pulse 0.8s ease-in-out 3;
}

/* 筹码计数器动画 */
@keyframes counter-update {
  0% { 
    transform: scale(1); 
    color: #f8fafc; 
  }
  50% { 
    transform: scale(1.2); 
    color: #f59e0b; 
  }
  100% { 
    transform: scale(1); 
    color: #f8fafc; 
  }
}

.chips-count.updating {
  animation: counter-update 0.6s ease-out;
}

/* 底池增长动画 */
@keyframes pot-grow {
  0% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}

.pot-display.growing {
  animation: pot-grow 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.bet-buttons .el-button {
  height: 44px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 12px;
  border: none;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}

.bet-buttons .el-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.6s ease;
}

.bet-buttons .el-button:hover::before {
  left: 100%;
}

.bet-buttons .el-button--danger {
  background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4);
}

.bet-buttons .el-button--danger:hover {
  background: linear-gradient(135deg, #b91c1c 0%, #991b1b 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(220, 38, 38, 0.5);
}

.bet-buttons .el-button--primary {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);
}

.bet-buttons .el-button--primary:hover {
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(59, 130, 246, 0.5);
}

.bet-buttons .el-button--warning {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);
}

.bet-buttons .el-button--warning:hover {
  background: linear-gradient(135deg, #d97706 0%, #b45309 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(245, 158, 11, 0.5);
}

.bet-buttons .el-button--success {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
}

.bet-buttons .el-button--success:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
}

/* Chat Panel */
.chat-panel {
  background: var(--color-surface);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  margin-bottom: var(--space-sm);
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
  transition: background var(--transition-base);
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

.chat-message {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--border-radius-sm);
  background: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(148, 163, 184, 0.1);
  font-size: var(--font-size-sm);
  word-wrap: break-word;
}

.chat-message.own-message {
  background: rgba(59, 130, 246, 0.2);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.chat-username {
  color: var(--color-warning);
  font-weight: 600;
  margin-right: var(--space-xs);
}

.chat-text {
  color: var(--color-text-primary);
}

.chat-input-container {
  display: flex;
  gap: var(--space-sm);
}

.chat-input {
  flex: 1;
  padding: var(--space-sm);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.chat-input:focus {
  outline: none;
  border-color: var(--color-primary);
  background: rgba(255, 255, 255, 0.15);
}

.chat-send-btn {
  padding: var(--space-sm) var(--space-md);
  white-space: nowrap;
}

/* Game Log */
.game-log {
  background: var(--color-surface);
  backdrop-filter: blur(20px);
  border-radius: var(--border-radius-lg);
  border: 1px solid var(--color-border);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-shadow: var(--shadow-lg), inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.log-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--space-md);
}

.debug-section {
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--border-radius-md);
  padding: var(--space-sm);
}

.debug-title {
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  font-weight: 700;
  margin: 0 0 var(--space-sm) 0;
}

.debug-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-xs);
}

.debug-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-xs);
}

.debug-label {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.debug-value {
  color: var(--color-text-primary);
  font-weight: 600;
}

.log-entries {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
}

.log-entries::-webkit-scrollbar {
  width: 6px;
}

.log-entries::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 3px;
}

.log-entries::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
  transition: background var(--transition-base);
}

.log-entries::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

.log-entry {
  display: flex;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--border-radius-sm);
  background: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(148, 163, 184, 0.1);
  transition: all var(--transition-base);
}

@media (hover: hover) {
  .log-entry:hover {
    background: rgba(30, 41, 59, 0.5);
    border: 1px solid rgba(148, 163, 184, 0.2);
  }
}

.log-time {
  color: #94a3b8;
  min-width: clamp(60px, 10vw, 80px);
  font-weight: 500;
  font-family: 'Courier New', monospace;
  font-size: var(--font-size-xs);
}

.log-message {
  color: var(--color-text-secondary);
  font-weight: 500;
  flex: 1;
}


/* 扑克牌花色颜色 */
.red-suit {
  color: #dc3545 !important; /* 红色 - 红桃♥和方块♦ */
}

.black-suit {
  color: #000 !important; /* 黑色 - 黑桃♠和梅花♣ */
}

:deep(.el-slider) {
  margin: 20px 0;
}

:deep(.el-slider__runway) {
  background-color: rgba(255, 255, 255, 0.2);
}

:deep(.el-slider__bar) {
  background-color: #667eea;
}

:deep(.el-slider__button) {
  border-color: #667eea;
}

/* Card Suit Colors */
.red-suit {
  color: #dc3545 !important;
}

.black-suit {
  color: #000 !important;
}

/* Animation Keyframes */
@keyframes pulse-glow {
  0%, 100% { 
    box-shadow: 
      var(--shadow-md),
      0 0 0 2px rgba(245, 158, 11, 0.6),
      inset 0 2px 4px rgba(255, 255, 255, 0.2);
  }
  50% { 
    box-shadow: 
      var(--shadow-lg),
      0 0 0 3px rgba(245, 158, 11, 0.8),
      inset 0 2px 4px rgba(255, 255, 255, 0.3);
  }
}

@keyframes pulse-main-btn {
  0%, 100% { 
    box-shadow: 
      0 4px 12px rgba(245, 158, 11, 0.4),
      0 0 0 1px rgba(245, 158, 11, 0.5);
  }
  50% { 
    box-shadow: 
      0 6px 16px rgba(245, 158, 11, 0.6),
      0 0 0 2px rgba(245, 158, 11, 0.7);
  }
}

/* Responsive Design */
@container (max-width: 600px) {
  .primary-actions {
    grid-template-columns: 1fr;
    gap: var(--space-xs);
  }
  
  .quick-bets {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Mobile Breakpoints */
@media (max-width: 1024px) {
  .game-main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  
  .side-panel {
    width: 100%;
    flex-direction: row;
    max-height: clamp(200px, 30vh, 300px);
  }
  
  .action-panel {
    flex: 1.5;
  }
  
  .game-log {
    flex: 1;
  }
}

@media (max-width: 768px) {
  .game-header {
    flex-direction: column;
    gap: var(--space-sm);
    align-items: stretch;
  }
  
  .seats {
    font-weight: 500;
  }

  .player-seat-controls {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    margin-right: var(--space-sm);
  }

  .player-seat-controls .seat-count,
  .player-seat-controls .ai-count {
    color: var(--color-text-secondary);
    font-size: var(--font-size-sm);
  }

  .player-seat-controls .seat-count {
    min-width: 88px;
  }

  .player-seat-controls .ai-count {
    min-width: 64px;
    text-align: center;
  }

  .user-controls {
    align-items: stretch;
  }
  
  .control-buttons {
    justify-content: center;
  }
  
  .side-panel {
    flex-direction: column;
    max-height: none;
  }
  
  .debug-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 480px) {
  .game {
    padding: var(--space-xs);
  }
  
  .game-header {
    padding: var(--space-sm);
  }
  
  .poker-table {
    width: clamp(300px, 90vw, 500px);
    height: clamp(200px, 50vh, 350px);
  }
  
  .primary-actions {
    grid-template-columns: 1fr;
  }
  
  .quick-bets {
    grid-template-columns: 1fr 1fr;
  }
}

.ai-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  font-size: 0.5rem;
  padding: 2px 4px;
  border-radius: 4px;
  font-weight: 700;
}

.allin-btn {
  grid-column: span 1;
}

.raise-dialog {
  margin-top: var(--space-md);
  padding: var(--space-md);
  background: rgba(31, 41, 55, 0.9);
  border-radius: var(--border-radius-md);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.raise-dialog h4 {
  color: var(--color-text-primary);
  margin-bottom: var(--space-sm);
  font-size: var(--font-size-md);
}

.raise-input {
  width: 100%;
  padding: var(--space-sm);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--border-radius-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-md);
  margin-bottom: var(--space-sm);
}

.raise-input:focus {
  outline: none;
  border-color: var(--color-warning);
}

.raise-actions {
  display: flex;
  gap: var(--space-sm);
}

.raise-actions .btn {
  flex: 1;
}
</style>