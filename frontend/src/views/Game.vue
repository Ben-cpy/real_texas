<template>
  <div class="game">
    <!-- Game Header -->
    <header class="game-header">
      <div class="game-info">
        <h1 class="game-title">德州扑克</h1>
        <div class="room-details">
          <span class="room-id">房间: {{ roomId }}</span>
          <span class="blinds">底注: ${{ blinds.small }}/${{ blinds.big }}</span>
        </div>
      </div>
      <div class="user-controls">
        <div class="user-identity">
          <span class="username">{{ username }}</span>
          <span v-if="isRoomCreator" class="user-role">房主</span>
        </div>
        <div class="control-buttons">
          <button 
            v-if="!gameState.gameStarted && isRoomCreator" 
            class="btn btn-success"
            @click="startGame"
            :disabled="players.length < 2"
          >
            开始游戏 ({{ players.length }}/6)
          </button>
          <span v-if="!gameState.gameStarted && !isRoomCreator" class="waiting-status">
            等待房主开始...
          </span>
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
              <div class="pot-amount">奖池 ${{ pot }}</div>
              <div class="current-bet" v-if="currentBet > 0">下注 ${{ currentBet }}</div>
            </div>
            <div class="community-cards">
              <div
                v-for="(card, index) in communityCards"
                :key="`community-${index}`"
                class="game-card"
                :class="{ 
                  'revealed': card.revealed,
                  'card-back': !card.revealed
                }"
              >
                <span v-if="card.revealed" :class="getCardColor(card.suit)">
                  {{ card.suit }}{{ card.rank }}
                </span>
              </div>
            </div>
          </div>
          
          <!-- Players Around Table -->
          <div class="players-container">
            <div
              v-for="(player, index) in players"
              :key="player.id"
              class="player-seat"
              :class="{
                'active-player': player.id === currentPlayer,
                'folded-player': player.folded,
                'all-in-player': player.allIn,
                'current-user': player.id === userId
              }"
              :style="getPlayerPosition(index)"
            >
              <!-- Player Avatar -->
              <div class="player-avatar">
                <div class="avatar-image">
                  <span class="avatar-initial">{{ player.name.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="countdown-timer" v-if="player.id === currentPlayer">
                  <svg class="timer-svg" viewBox="0 0 36 36">
                    <circle class="timer-bg" cx="18" cy="18" r="16"/>
                    <circle class="timer-progress" cx="18" cy="18" r="16"/>
                  </svg>
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
              <div class="player-cards" v-if="player.cards.length > 0">
                <div
                  v-for="(card, cardIndex) in player.cards"
                  :key="`${player.id}-card-${cardIndex}`"
                  class="game-card player-card"
                  :class="{ 
                    'own-card': player.id === userId,
                    'opponent-card': player.id !== userId,
                    'card-back': player.id !== userId
                  }"
                >
                  <span v-if="player.id === userId" :class="getCardColor(card.suit)">
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
        <section class="action-panel" v-if="isMyTurn">
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
              :disabled="!canCheck && callAmount > currentPlayer?.chips"
            >
              <span class="btn-label">{{ canCheck ? 'CHECK' : 'CALL' }}</span>
              <span class="btn-desc">
                {{ canCheck ? '过牌' : `跟注 $${callAmount}` }}
              </span>
            </button>
            
            <button 
              class="action-btn raise-btn" 
              @click="bet"
              :disabled="betAmount > currentPlayer?.chips"
            >
              <span class="btn-label">{{ gameState.currentBet > 0 ? 'RAISE' : 'BET' }}</span>
              <span class="btn-desc">
                {{ gameState.currentBet > 0 ? '加注' : '下注' }} ${{ betAmount }}
              </span>
            </button>
          </div>
          
          <!-- Betting Slider -->
          <div class="betting-controls">
            <div class="slider-section">
              <input 
                type="range" 
                v-model="betAmount" 
                :min="minBet" 
                :max="maxBet" 
                :step="blinds.small"
                class="bet-slider"
              >
              <div class="slider-labels">
                <span class="min-label">${{ minBet }}</span>
                <span class="current-label">${{ betAmount }}</span>
                <span class="max-label">${{ maxBet }}</span>
              </div>
            </div>
          </div>
          
          <!-- Quick Bet Options -->
          <div class="quick-bets">
            <button 
              class="quick-bet-btn" 
              @click="setBetAmount(Math.floor(gameState.pot * 0.5))"
              :disabled="Math.floor(gameState.pot * 0.5) > currentPlayer?.chips"
            >
              <span class="bet-type">1/2 POT</span>
              <span class="bet-amount">${{ Math.floor(gameState.pot * 0.5) }}</span>
            </button>
            
            <button 
              class="quick-bet-btn" 
              @click="setBetAmount(Math.floor(gameState.pot * 0.67))"
              :disabled="Math.floor(gameState.pot * 0.67) > currentPlayer?.chips"
            >
              <span class="bet-type">2/3 POT</span>
              <span class="bet-amount">${{ Math.floor(gameState.pot * 0.67) }}</span>
            </button>
            
            <button 
              class="quick-bet-btn" 
              @click="setBetAmount(gameState.pot)"
              :disabled="gameState.pot > currentPlayer?.chips"
            >
              <span class="bet-type">POT</span>
              <span class="bet-amount">${{ gameState.pot }}</span>
            </button>
            
            <button class="quick-bet-btn all-in-btn" @click="allIn">
              <span class="bet-type">ALL-IN</span>
              <span class="bet-amount">${{ currentPlayer?.chips || 0 }}</span>
            </button>
          </div>
        </section>
        
        <!-- Game Log -->
        <section class="game-log">
          <h3 class="panel-title">游戏记录</h3>
          <div class="log-container">
            <div class="debug-section">
              <h4 class="debug-title">状态信息</h4>
              <div class="debug-grid">
                <div class="debug-item">
                  <span class="debug-label">连接</span>
                  <span class="debug-value">{{ socket ? '已连接' : '未连接' }}</span>
                </div>
                <div class="debug-item">
                  <span class="debug-label">阶段</span>
                  <span class="debug-value">{{ gameState.phase }}</span>
                </div>
                <div class="debug-item">
                  <span class="debug-label">玩家</span>
                  <span class="debug-value">{{ players.length }}/6</span>
                </div>
                <div class="debug-item">
                  <span class="debug-label">底池</span>
                  <span class="debug-value">${{ gameState.pot }}</span>
                </div>
              </div>
            </div>
            
            <div class="log-entries">
              <div
                v-for="(log, index) in gameLog"
                :key="`log-${index}`"
                class="log-entry"
              >
                <time class="log-time">{{ formatTime(log.time) }}</time>
                <span class="log-message">{{ log.message }}</span>
              </div>
            </div>
          </div>
        </section>
      </aside>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { io } from 'socket.io-client'

const router = useRouter()

// 用户和房间状态
const username = ref(localStorage.getItem('username') || 'Guest')
const userId = ref('user1')
const roomId = ref('ROOM001')
const isRoomCreator = ref(false)
const roomStatus = ref('waiting')
let socket = null

// 响应式容器引用
const pokerTableRef = ref(null)

// 初始化为空状态，等待后端数据
const gameState = reactive({
  currentPlayer: null,
  phase: 'waiting',
  pot: 0,
  currentBet: 0,
  minBet: 10,
  maxBet: 1000,
  gameStarted: false
})

const blinds = reactive({
  small: 10,
  big: 20
})

const betAmount = ref(20) // 默认为大盲注

// 初始化为空，等待后端数据
const communityCards = ref([])

// 初始化为空，等待后端数据  
const players = ref([])

// 初始化为空，等待后端数据
const gameLog = ref([])

const currentPlayer = computed(() => gameState.currentPlayer)
const pot = computed(() => gameState.pot)
const currentBet = computed(() => gameState.currentBet)
const minBet = computed(() => Math.max(gameState.minBet, gameState.currentBet))
const maxBet = computed(() => {
  const myPlayer = players.value.find(p => p.id === userId.value)
  return myPlayer ? myPlayer.chips : 0
})
const isMyTurn = computed(() => gameState.currentPlayer === userId.value)
const canCheck = computed(() => gameState.currentBet === 0)
const callAmount = computed(() => gameState.currentBet)

// 响应式玩家位置计算
const getPlayerPosition = (index) => {
  if (!pokerTableRef.value) {
    // 默认位置，用于服务端渲染或初始渲染
    return { transform: 'translate(0px, 0px)' }
  }
  
  const container = pokerTableRef.value
  const containerRect = container.getBoundingClientRect()
  const containerWidth = containerRect.width || 600
  const containerHeight = containerRect.height || 400
  
  const totalPlayers = players.value.length
  const angle = (360 / totalPlayers) * index
  
  // 根据容器大小动态计算半径
  const radiusX = Math.min(containerWidth * 0.35, 280)
  const radiusY = Math.min(containerHeight * 0.3, 160)
  
  const x = Math.cos((angle * Math.PI) / 180) * radiusX
  const y = Math.sin((angle * Math.PI) / 180) * radiusY
  
  return {
    transform: `translate(${x}px, ${y}px)`,
    '--player-radius-x': `${radiusX}px`,
    '--player-radius-y': `${radiusY}px`
  }
}

const fold = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  socket.emit('game_action', { action: 'fold' })
}

const check = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  socket.emit('game_action', { action: 'check' })
}

const call = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  socket.emit('game_action', { action: 'call' })
}

const bet = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  socket.emit('game_action', { action: 'bet', amount: betAmount.value })
}

const allIn = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  socket.emit('game_action', { action: 'all_in' })
}

const addLog = (message) => {
  gameLog.value.push({
    time: new Date(),
    message
  })
}

const formatTime = (time) => {
  return time.toLocaleTimeString()
}

const getCardColor = (suit) => {
  // 红桃和方块用红色，黑桃和梅花用黑色
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

const leaveGame = () => {
  router.push('/')
}

const initSocket = () => {
  socket = io('http://localhost:3001')
  
  socket.on('connect', () => {
    console.log('Socket连接成功')
    
    // 验证身份
    const token = localStorage.getItem('token')
    if (token && token !== 'null' && token !== 'undefined' && token.length > 10) {
      console.log('使用现有token进行认证')
      socket.emit('authenticate', { token })
    } else {
      console.log('没有有效token，创建临时用户')
      // 清理无效token
      localStorage.removeItem('token')
      localStorage.removeItem('username')
      // 创建一个临时用户
      createTemporaryUser()
    }
  })
  
  const createTemporaryUser = async () => {
    try {
      const tempUsername = `Player_${Date.now()}`
      const response = await fetch('http://localhost:3001/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: tempUsername,
          password: '123456'
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        localStorage.setItem('token', data.token)
        localStorage.setItem('username', data.user.username)
        username.value = data.user.username
        socket.emit('authenticate', { token: data.token })
      } else {
        console.error('创建临时用户失败')
        ElMessage.error('创建临时用户失败')
      }
    } catch (error) {
      console.error('创建临时用户错误:', error)
      ElMessage.error('连接服务器失败')
    }
  }

  // 认证成功
  socket.on('authenticated', (data) => {
    console.log('身份验证成功:', data)
    userId.value = data.user.id
    username.value = data.user.username
    
    // 重置游戏状态，确保与后端同步
    gameState.gameStarted = false
    gameState.phase = 'waiting' 
    gameState.pot = 0
    gameState.currentBet = 0
    gameState.currentPlayer = null
    players.value = []
    communityCards.value = []
    gameLog.value.push({
      time: new Date(),
      message: `${data.user.username} 连接成功`
    })
    
    // 加入房间
    socket.emit('join_room', { roomId: roomId.value })
  })

  // 认证失败
  socket.on('auth_error', (data) => {
    console.error('认证失败:', data)
    ElMessage.error(`认证失败: ${data.error}`)
    
    // 清理无效token并创建新用户
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    console.log('认证失败，创建新的临时用户')
    createTemporaryUser()
  })

  socket.on('player_joined', (data) => {
    console.log('玩家加入:', data)
    players.value = data.players
    updateGameState(data.gameState)
    
    // 使用后端返回的房主ID判断当前用户是否为房主
    if (data.roomCreatorId) {
      isRoomCreator.value = data.roomCreatorId === userId.value
      console.log(`房主检查: 房主ID=${data.roomCreatorId}, 当前用户ID=${userId.value}, 是否房主=${isRoomCreator.value}`)
    }
    
    ElMessage.success(`${data.player.name} 加入了游戏`)
    
    gameLog.value.push({
      time: new Date(),
      message: `${data.player.name} 加入了游戏`
    })
  })

  socket.on('game_started', (data) => {
    console.log('游戏开始:', data)
    updateGameState(data.gameState)
    addLog('游戏开始，发放底牌')
  })

  socket.on('game_reset', (data) => {
    console.log('游戏重开:', data)
    updateGameState(data.gameState)
    addLog(data.message || '游戏已重开')
  })

  socket.on('game_update', (data) => {
    console.log('游戏状态更新:', data)
    updateGameState(data.gameState)
    if (data.lastAction) {
      addLog(`${data.lastAction.player} ${data.lastAction.type === 'fold' ? '弃牌' : 
                                         data.lastAction.type === 'check' ? '过牌' : 
                                         data.lastAction.type === 'call' ? '跟注' : 
                                         data.lastAction.type === 'bet' ? '下注' : 
                                         data.lastAction.type === 'all_in' ? '全押' : data.lastAction.type} ${data.lastAction.amount ? '$' + data.lastAction.amount : ''}`)
    }
  })

  socket.on('ai_action', (data) => {
    console.log('AI行动:', data)
    const actionText = data.action === 'fold' ? '弃牌' : 
                       data.action === 'check' ? '过牌' : 
                       data.action === 'call' ? '跟注' : 
                       data.action === 'bet' ? '下注' : 
                       data.action === 'all_in' ? '全押' : data.action
    addLog(`${data.playerName} ${actionText} ${data.amount ? '$' + data.amount : ''}`)
  })

  socket.on('action_error', (data) => {
    console.error('操作错误:', data)
    ElMessage.error(data.error)
  })

  socket.on('error', (data) => {
    console.error('Socket错误:', data)
    ElMessage.error(data.error)
  })

  socket.on('disconnect', () => {
    console.log('Socket连接断开')
  })
}

const updateGameState = (newState) => {
  if (!newState) return
  
  gameState.currentPlayer = newState.players[newState.currentPlayerIndex]?.id
  gameState.phase = newState.phase
  gameState.pot = newState.pot
  gameState.currentBet = newState.currentBet
  gameState.gameStarted = newState.gameStarted
  
  // 更新玩家数据
  players.value = newState.players.map(player => ({
    id: player.id,
    name: player.name,
    chips: player.chips,
    currentBet: player.currentBet,
    cards: player.cards || [],
    folded: player.folded,
    allIn: player.allIn
  }))
  
  // 更新公共牌
  communityCards.value = newState.communityCards || []
}

const startGame = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  
  if (!userId.value) {
    ElMessage.error('用户未认证')
    return
  }
  
  if (players.value.length < 2) {
    ElMessage.warning('至少需要2名玩家才能开始游戏')
    return
  }
  
  if (gameState.gameStarted) {
    ElMessage.warning('游戏已经开始了')
    return
  }
  
  console.log('发送开始游戏请求...')
  socket.emit('start_game')
}

const resetGame = () => {
  if (!socket) {
    ElMessage.error('未连接到游戏服务器')
    return
  }
  
  // 重置本地游戏状态
  gameState.gameStarted = false
  gameState.phase = 'waiting'
  gameState.pot = 0
  gameState.currentBet = 0
  gameState.currentPlayer = null
  
  // 重置玩家数据
  players.value.forEach(player => {
    player.cards = []
    player.currentBet = 0
    player.folded = false
    player.allIn = false
  })
  
  // 重置公共牌
  communityCards.value = []
  
  // 清空游戏日志
  gameLog.value = []
  
  // 发送重开游戏请求
  socket.emit('reset_game')
  
  ElMessage.success('游戏已重开')
}

const setBetAmount = (amount) => {
  betAmount.value = Math.max(minBet.value, Math.min(amount, maxBet.value))
}

// 窗口大小变化处理
const handleResize = () => {
  // 强制重新计算玩家位置
  if (players.value.length > 0) {
    // 触发响应式更新
    players.value = [...players.value]
  }
}

onMounted(() => {
  // 开发阶段：强制清空localStorage确保干净的开始
  if (import.meta.env.DEV) {
    console.log('开发模式：清空localStorage确保干净的开始')
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }
  
  // 添加窗口大小变化监听
  window.addEventListener('resize', handleResize)
  
  initSocket()
  ElMessage.success('正在连接游戏服务器...')
})

onUnmounted(() => {
  // 清理事件监听器
  window.removeEventListener('resize', handleResize)
  
  if (socket) {
    socket.emit('leave_room')
    socket.disconnect()
  }
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
</style>