<template>
  <div class="game">
    <div class="game-header">
      <div class="game-info">
        <h3>德州扑克游戏</h3>
        <p>房间号: {{ roomId }} | 底注: {{ blinds.small }}/{{ blinds.big }}</p>
      </div>
      <div class="user-info">
        <span>{{ username }}</span>
        <el-button 
          v-if="!gameState.gameStarted && isRoomCreator" 
          type="success" 
          @click="startGame"
          :disabled="players.length < 2"
        >
          开始游戏 ({{ players.length }}/6)
        </el-button>
        <span v-if="!gameState.gameStarted && !isRoomCreator" class="room-status">
          等待房主开始游戏...
        </span>
        <el-button type="warning" @click="resetGame">重开游戏</el-button>
        <el-button type="primary" @click="leaveGame">离开游戏</el-button>
      </div>
    </div>
    
    <div class="game-table">
      <!-- 牌桌 -->
      <div class="poker-table">
        <!-- 公共牌区域 -->
        <div class="community-cards">
          <div class="pot-info">
            <div class="pot-amount">奖池: ${{ pot }}</div>
            <div class="current-bet" v-if="currentBet > 0">当前下注: ${{ currentBet }}</div>
          </div>
          <div class="cards">
            <div
              v-for="(card, index) in communityCards"
              :key="index"
              class="card"
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
        
        <!-- 玩家位置 -->
        <div class="players">
          <div
            v-for="(player, index) in players"
            :key="player.id"
            class="player-seat"
            :class="{
              'current-player': player.id === currentPlayer,
              'folded': player.folded,
              'all-in': player.allIn
            }"
            :style="getPlayerPosition(index)"
          >
            <!-- 圆形头像和倒计时 -->
            <div class="player-avatar" :class="{ 'active': player.id === currentPlayer }">
              <div class="avatar-circle">
                <span class="avatar-text">{{ player.name.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="countdown-ring" v-if="player.id === currentPlayer">
                <svg class="countdown-svg" viewBox="0 0 36 36">
                  <path class="countdown-bg" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                  <path class="countdown-progress" 
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    stroke-dasharray="60, 100"/>
                </svg>
              </div>
            </div>
            
            <!-- 玩家信息 -->
            <div class="player-info">
              <div class="player-name">{{ player.name }}</div>
              <div class="player-chips">${{ player.chips }}</div>
              
              <!-- 最近动作标签 -->
              <div class="action-tag" v-if="player.lastAction">
                {{ getActionText(player.lastAction) }}
              </div>
              
              <!-- 当前下注 -->
              <div class="player-bet" v-if="player.currentBet > 0">${{ player.currentBet }}</div>
            </div>
            <div class="player-cards" v-if="player.cards.length > 0">
              <div
                v-for="(card, cardIndex) in player.cards"
                :key="cardIndex"
                class="card"
                :class="{ 
                  'face-up': player.id === userId,
                  'small': player.id !== userId,
                  'card-back': player.id !== userId
                }"
              >
                <span v-if="player.id === userId" :class="getCardColor(card.suit)">{{ card.suit }}{{ card.rank }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
    </div>
    
    <!-- 右侧面板 -->
    <div class="right-panel">
      <!-- 操作面板 -->
      <div class="action-panel" v-if="isMyTurn">
        <!-- 主操作按钮 -->
        <div class="action-buttons">
          <!-- 左：弃牌 -->
          <button class="action-btn fold-btn" @click="fold">
            <span class="btn-text">FOLD</span>
            <span class="btn-subtitle">弃牌</span>
          </button>
          
          <!-- 中：过牌/跟注 -->
          <button 
            class="action-btn call-btn" 
            @click="canCheck ? check() : call()"
            :disabled="!canCheck && callAmount > currentPlayer?.chips"
          >
            <span class="btn-text">{{ canCheck ? 'CHECK' : 'CALL' }}</span>
            <span class="btn-subtitle">
              {{ canCheck ? '过牌' : `跟注 $${callAmount}` }}
            </span>
          </button>
          
          <!-- 右：下注/加注（主按钮） -->
          <button 
            class="action-btn raise-btn primary-btn" 
            @click="bet"
            :disabled="betAmount > currentPlayer?.chips"
          >
            <span class="btn-text">{{ gameState.currentBet > 0 ? 'RAISE' : 'BET' }}</span>
            <span class="btn-subtitle">
              {{ gameState.currentBet > 0 ? '加注' : '下注' }} ${{ betAmount }}
            </span>
          </button>
        </div>
        
        <!-- 下注滑条 -->
        <div class="betting-slider">
          <div class="slider-container">
            <input 
              type="range" 
              v-model="betAmount" 
              :min="minBet" 
              :max="maxBet" 
              :step="blinds.small"
              class="bet-slider"
            >
            <div class="slider-labels">
              <span>${{ minBet }}</span>
              <span>${{ betAmount }}</span>
              <span>${{ maxBet }}</span>
            </div>
          </div>
        </div>
        
        <!-- 快捷筹码按钮 -->
        <div class="quick-chips">
          <button 
            class="chip-btn" 
            @click="setBetAmount(Math.floor(gameState.pot * 0.5))"
            :disabled="Math.floor(gameState.pot * 0.5) > currentPlayer?.chips"
          >
            <span class="chip-amount">1/2 POT</span>
            <span class="chip-value">${{ Math.floor(gameState.pot * 0.5) }}</span>
          </button>
          
          <button 
            class="chip-btn" 
            @click="setBetAmount(Math.floor(gameState.pot * 0.67))"
            :disabled="Math.floor(gameState.pot * 0.67) > currentPlayer?.chips"
          >
            <span class="chip-amount">2/3 POT</span>
            <span class="chip-value">${{ Math.floor(gameState.pot * 0.67) }}</span>
          </button>
          
          <button 
            class="chip-btn" 
            @click="setBetAmount(gameState.pot)"
            :disabled="gameState.pot > currentPlayer?.chips"
          >
            <span class="chip-amount">POT</span>
            <span class="chip-value">${{ gameState.pot }}</span>
          </button>
          
          <button 
            class="chip-btn all-in-chip" 
            @click="allIn"
          >
            <span class="chip-amount">ALL-IN</span>
            <span class="chip-value">${{ currentPlayer?.chips || 0 }}</span>
          </button>
        </div>
      </div>
      
      <!-- 游戏日志 -->
      <div class="game-log">
        <div class="log-header">
          <h4>游戏日志</h4>
        </div>
        <div class="log-content">
          <div class="debug-info">
            <p><strong>游戏状态:</strong></p>
            <p>连接状态: {{ socket ? '✓ 已连接' : '✗ 未连接' }}</p>
            <p>用户身份: {{ userId || '未认证' }}</p>
            <p>房间权限: {{ isRoomCreator ? '房主' : '普通玩家' }}</p>
            <p>游戏阶段: {{ gameState.phase }}</p>
            <p>游戏状态: {{ gameState.gameStarted ? '进行中' : '等待中' }}</p>
            <p>玩家数量: {{ players.length }}/6</p>
            <p>当前轮到: {{ gameState.currentPlayer || '无' }}</p>
            <p>底池: ${{ gameState.pot }}</p>
          </div>
          <hr style="margin: 10px 0; border-color: #666;">
          <div
            v-for="(log, index) in gameLog"
            :key="index"
            class="log-item"
          >
            <span class="log-time">{{ formatTime(log.time) }}</span>
            <span class="log-message">{{ log.message }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { io } from 'socket.io-client'

const router = useRouter()

const username = ref(localStorage.getItem('username') || 'Guest')
const userId = ref('user1') // 当前用户ID
const roomId = ref('ROOM001')
const isRoomCreator = ref(false) // 标记是否为房主
const roomStatus = ref('waiting') // 房间状态
let socket = null

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

const getPlayerPosition = (index) => {
  const totalPlayers = players.value.length
  const angle = (360 / totalPlayers) * index
  const radiusX = 280  // 长椭圆的横向半径
  const radiusY = 160  // 长椭圆的纵向半径
  const x = Math.cos((angle * Math.PI) / 180) * radiusX
  const y = Math.sin((angle * Math.PI) / 180) * radiusY
  
  return {
    transform: `translate(${x}px, ${y}px)`
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

onMounted(() => {
  // 开发阶段：强制清空localStorage确保干净的开始
  if (import.meta.env.DEV) {
    console.log('开发模式：清空localStorage确保干净的开始')
    localStorage.removeItem('token')
    localStorage.removeItem('username')
  }
  
  initSocket()
  ElMessage.success('正在连接游戏服务器...')
})

onUnmounted(() => {
  if (socket) {
    socket.emit('leave_room')
    socket.disconnect()
  }
})
</script>

<style scoped>
.game {
  height: 100vh;
  background: 
    radial-gradient(ellipse at center, #0b3d2e 0%, #062e1a 70%),
    linear-gradient(135deg, #062e1a 0%, #0b3d2e 25%, #083529 50%, #0b3d2e 75%, #062e1a 100%);
  background-size: 100% 100%, 200% 200%;
  background-attachment: fixed;
  padding: 15px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  color: #f8fafc;
}

.game::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: 
    radial-gradient(circle at 20% 30%, rgba(245, 158, 11, 0.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 70%, rgba(31, 41, 55, 0.15) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, rgba(6, 46, 26, 0.1) 0%, transparent 70%);
  pointer-events: none;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #1f2937 0%, rgba(31, 41, 55, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  padding: 12px 20px;
  margin-bottom: 15px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(245, 158, 11, 0.1);
  position: relative;
  z-index: 10;
  flex-shrink: 0;
}

.game-info h3 {
  color: #f8fafc;
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.025em;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.game-info p {
  color: #f8fafc;
  opacity: 0.8;
  margin: 8px 0 0 0;
  font-size: 0.95rem;
  font-weight: 500;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info span {
  color: #f8fafc;
  font-weight: 600;
  font-size: 1rem;
}

.room-status {
  color: #fbbf24;
  font-style: italic;
  font-size: 0.9rem;
  font-weight: 500;
}

.game-table {
  flex: 1;
  display: flex;
  gap: 15px;
  min-height: 0;
  position: relative;
}

.right-panel {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 15px;
  flex-shrink: 0;
}

.poker-table {
  position: relative;
  flex: 1;
  background: 
    /* 噪声纹理层 */
    url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><defs><filter id="noiseFilter"><feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="1" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.02 0"/></filter></defs><rect width="100%" height="100%" filter="url(%23noiseFilter)"/></svg>'),
    /* 毡面渐变 */
    radial-gradient(ellipse at center, #0b3d2e 0%, #083529 40%, #062e1a 80%),
    radial-gradient(ellipse 160% 60% at 50% 50%, rgba(11, 61, 46, 0.3) 0%, transparent 70%);
  border-radius: 50% / 30%;
  border: 8px solid transparent;
  background-clip: padding-box;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  max-height: 500px;
  margin: 0;
  box-shadow: 
    /* 桌沿阴影 */
    0 0 0 3px #1f2937,
    0 0 0 4px rgba(245, 158, 11, 0.4),
    0 0 0 6px #1f2937,
    /* 外部阴影 */
    0 15px 40px rgba(0, 0, 0, 0.5),
    /* 内部阴影 */
    inset 0 0 30px rgba(0, 0, 0, 0.4),
    inset 1px 1px 3px rgba(0, 0, 0, 0.3);
}

.poker-table::before {
  content: '';
  position: absolute;
  top: -8px;
  left: -8px;
  right: -8px;
  bottom: -8px;
  background: linear-gradient(135deg, 
    /* 金属高光效果 */
    #1f2937 0%,
    #374151 15%,
    #4b5563 30%,
    rgba(245, 158, 11, 0.3) 45%,
    rgba(245, 158, 11, 0.6) 50%,
    rgba(245, 158, 11, 0.3) 55%,
    #4b5563 70%,
    #374151 85%,
    #1f2937 100%
  );
  border-radius: 50% / 30%;
  z-index: -1;
}

.poker-table::after {
  content: '';
  position: absolute;
  top: 12px;
  left: 18px;
  right: 18px;
  bottom: 12px;
  border: 1px dashed rgba(248, 250, 252, 0.2);
  border-radius: 50% / 30%;
  pointer-events: none;
}

.community-cards {
  text-align: center;
  z-index: 10;
  background: rgba(31, 41, 55, 0.3);
  border-radius: 20px;
  padding: 20px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(245, 158, 11, 0.2);
}

.pot-info {
  margin-bottom: 20px;
  padding: 16px 24px;
  background: linear-gradient(135deg, rgba(31, 41, 55, 0.8) 0%, rgba(31, 41, 55, 0.6) 100%);
  border-radius: 12px;
  border: 2px solid rgba(245, 158, 11, 0.4);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(245, 158, 11, 0.2);
}

.pot-amount {
  color: #f59e0b;
  font-family: 'Montserrat', sans-serif;
  font-weight: 800;
  font-size: 1.6rem;
  margin: 0;
  text-shadow: 
    0 0 12px rgba(245, 158, 11, 0.6),
    0 2px 4px rgba(0, 0, 0, 0.4);
  letter-spacing: 0.5px;
}

.current-bet {
  color: #f8fafc;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 1.1rem;
  margin: 8px 0 0 0;
  opacity: 0.9;
}

.cards {
  display: flex;
  gap: 12px;  /* 8-12px间距 */
  justify-content: center;
}

/* 卡片样式和动画 */
.card {
  width: 54px;
  height: 76px;
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Montserrat', sans-serif;
  font-size: 1.3rem;
  font-weight: 700;
  box-shadow: 
    /* 投影效果 */
    0 6px 16px rgba(0, 0, 0, 0.4),
    0 3px 8px rgba(0, 0, 0, 0.2),
    /* 细黑描边 */
    inset 0 0 0 1px rgba(0, 0, 0, 0.1),
    /* 高光 */
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
  transition: all 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  transform-style: preserve-3d;
}

.card:hover {
  transform: translateY(-3px) scale(1.08);
  box-shadow: 
    0 12px 24px rgba(0, 0, 0, 0.5),
    0 6px 16px rgba(0, 0, 0, 0.3),
    inset 0 0 0 1px rgba(0, 0, 0, 0.1),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
}

/* 卡牌发牌动画 - 180-220ms */
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

.card.dealing {
  animation: deal-card 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 卡牌翻面动画 - 280ms */
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

.card.flipping {
  animation: flip-card 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

/* 公共牌发牌延迟 */
.community-cards .card:nth-child(1) { animation-delay: 0ms; }
.community-cards .card:nth-child(2) { animation-delay: 50ms; }
.community-cards .card:nth-child(3) { animation-delay: 100ms; }
.community-cards .card:nth-child(4) { animation-delay: 200ms; }
.community-cards .card:nth-child(5) { animation-delay: 250ms; }

.card.small {
  width: 35px;
  height: 50px;
  font-size: 0.8rem;
}

/* 玩家自己的卡牌应该是正常大小和白色背景 */
.card.face-up {
  width: 50px;
  height: 70px;
  background: #fff;
  font-size: 1.2rem;
}

.card.revealed {
  transform: rotateY(0deg);
}

.card:not(.revealed) {
  background: #4a5568;
  color: #fff;
}

/* 优雅的几何图案卡牌背面 */
.card-back {
  background: 
    linear-gradient(135deg, #1e40af 0%, #1d4ed8 25%, #2563eb 50%, #1d4ed8 75%, #1e40af 100%),
    radial-gradient(circle at 25% 25%, rgba(255, 255, 255, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  background-size: 100% 100%, 20px 20px, 15px 15px;
  position: relative;
  overflow: hidden;
  color: transparent;
}

.card-back::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: 
    repeating-linear-gradient(45deg, 
      transparent 0px, 
      transparent 2px, 
      rgba(255, 255, 255, 0.1) 2px, 
      rgba(255, 255, 255, 0.1) 4px
    ),
    repeating-linear-gradient(-45deg, 
      transparent 0px, 
      transparent 2px, 
      rgba(255, 255, 255, 0.1) 2px, 
      rgba(255, 255, 255, 0.1) 4px
    );
  background-size: 8px 8px;
}

.card-back::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  right: 3px;
  bottom: 3px;
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  background: 
    radial-gradient(ellipse at center, rgba(255, 255, 255, 0.05) 0%, transparent 70%);
}

.players {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 100%;
  height: 100%;
}

.player-seat {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 160px;
  height: 140px;
  margin-left: -80px;
  margin-top: -70px;
  text-align: center;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

/* 玩家头像 */
.player-avatar {
  position: relative;
  width: 60px;
  height: 60px;
}

.avatar-circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
  border: 3px solid #4b5563;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 2;
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.4),
    inset 0 2px 4px rgba(255, 255, 255, 0.1);
}

.avatar-text {
  color: #f8fafc;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 1.2rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 当前玩家头像高亮 */
.player-avatar.active .avatar-circle {
  border-color: #f59e0b;
  box-shadow: 
    0 4px 16px rgba(245, 158, 11, 0.4),
    0 0 0 2px rgba(245, 158, 11, 0.6),
    inset 0 2px 4px rgba(255, 255, 255, 0.2);
  animation: pulse-glow 2s infinite;
}

/* 倒计时环 */
.countdown-ring {
  position: absolute;
  top: -4px;
  left: -4px;
  width: 68px;
  height: 68px;
  z-index: 1;
}

.countdown-svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.countdown-bg {
  fill: none;
  stroke: rgba(75, 85, 99, 0.3);
  stroke-width: 2;
}

.countdown-progress {
  fill: none;
  stroke: #f59e0b;
  stroke-width: 3;
  stroke-linecap: round;
  animation: countdown-tick 30s linear infinite;
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

.player-info {
  background: linear-gradient(135deg, rgba(31, 41, 55, 0.9) 0%, rgba(31, 41, 55, 0.7) 100%);
  backdrop-filter: blur(12px);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.8rem;
  border: 1px solid rgba(245, 158, 11, 0.2);
  box-shadow: 
    0 3px 10px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(245, 158, 11, 0.1);
  transition: all 0.3s ease;
  min-width: 100px;
}

.player-seat.current-player .player-info {
  border: 1px solid rgba(245, 158, 11, 0.5);
  box-shadow: 
    0 4px 12px rgba(245, 158, 11, 0.3),
    0 0 0 1px rgba(245, 158, 11, 0.3),
    inset 0 1px 0 rgba(245, 158, 11, 0.2);
}

.player-seat.folded .player-info {
  background: linear-gradient(135deg, rgba(75, 85, 99, 0.6) 0%, rgba(55, 65, 81, 0.6) 100%);
  opacity: 0.6;
  border: 1px solid rgba(107, 114, 128, 0.3);
}

/* 动作标签 */
.action-tag {
  display: inline-block;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  color: #1f2937;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: 12px;
  margin: 4px 0;
  letter-spacing: 0.5px;
  box-shadow: 
    0 2px 6px rgba(245, 158, 11, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  border: 1px solid rgba(217, 119, 6, 0.5);
}

.player-name {
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  color: #f8fafc;
  margin-bottom: 3px;
  font-size: 0.85rem;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}

.player-chips {
  color: #f59e0b;
  font-family: 'Montserrat', sans-serif;
  font-weight: 700;
  font-size: 0.8rem;
  margin-bottom: 2px;
  text-shadow: 0 0 6px rgba(245, 158, 11, 0.4);
}

.player-bet {
  color: #f8fafc;
  font-family: 'Montserrat', sans-serif;
  font-weight: 600;
  font-size: 0.7rem;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.3) 0%, rgba(245, 158, 11, 0.2) 100%);
  padding: 3px 8px;
  border-radius: 8px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  box-shadow: 
    0 2px 4px rgba(245, 158, 11, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
  margin-top: 4px;
  display: inline-block;
}

.player-seat.current-player .player-name {
  color: #f8fafc;
  text-shadow: 0 0 8px rgba(245, 158, 11, 0.6);
}

.player-seat.current-player .player-chips {
  color: #f59e0b;
  text-shadow: 0 0 10px rgba(245, 158, 11, 0.6);
}

.player-seat.folded .player-name {
  color: #9ca3af;
  text-shadow: none;
}

.player-seat.folded .player-chips {
  color: #6b7280;
  text-shadow: none;
}

.player-seat.folded .player-bet {
  color: #9ca3af;
  background: rgba(156, 163, 175, 0.2);
  border: 1px solid rgba(156, 163, 175, 0.3);
  box-shadow: none;
}

.player-cards {
  display: flex;
  gap: 3px;
  justify-content: center;
}

/* 操作面板样式 */
.action-panel {
  background: linear-gradient(135deg, rgba(31, 41, 55, 0.95) 0%, rgba(17, 24, 39, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(245, 158, 11, 0.2);
  padding: 20px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(245, 158, 11, 0.1);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 主操作按钮组 */
.action-buttons {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.action-btn {
  background: linear-gradient(135deg, rgba(75, 85, 99, 0.9) 0%, rgba(55, 65, 81, 0.9) 100%);
  border: 1px solid rgba(107, 114, 128, 0.4);
  border-radius: 12px;
  padding: 12px 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-family: 'Montserrat', sans-serif;
  position: relative;
  overflow: hidden;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 
    0 4px 12px rgba(0, 0, 0, 0.3),
    0 0 0 1px rgba(245, 158, 11, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.action-btn:active:not(:disabled) {
  transform: translateY(0);
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-text {
  font-weight: 700;
  font-size: 0.9rem;
  letter-spacing: 0.5px;
  color: #f8fafc;
}

.btn-subtitle {
  font-weight: 500;
  font-size: 0.7rem;
  color: #cbd5e1;
}

/* 弃牌按钮 */
.fold-btn {
  background: linear-gradient(135deg, rgba(220, 38, 38, 0.8) 0%, rgba(185, 28, 28, 0.8) 100%);
  border: 1px solid rgba(239, 68, 68, 0.4);
}

.fold-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(220, 38, 38, 0.9) 100%);
  box-shadow: 
    0 4px 12px rgba(220, 38, 38, 0.4),
    0 0 0 1px rgba(239, 68, 68, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* 跟注/过牌按钮 */
.call-btn {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.8) 0%, rgba(37, 99, 235, 0.8) 100%);
  border: 1px solid rgba(96, 165, 250, 0.4);
}

.call-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.9) 0%, rgba(59, 130, 246, 0.9) 100%);
  box-shadow: 
    0 4px 12px rgba(59, 130, 246, 0.4),
    0 0 0 1px rgba(96, 165, 250, 0.6),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* 下注/加注按钮（主按钮） */
.raise-btn.primary-btn {
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border: 1px solid #fbbf24;
  animation: pulse-main-btn 1.1s infinite;
}

.raise-btn.primary-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
  box-shadow: 
    0 6px 16px rgba(245, 158, 11, 0.5),
    0 0 0 2px rgba(251, 191, 36, 0.7),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
  animation: none;
}

.raise-btn.primary-btn .btn-text {
  color: #1f2937;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.raise-btn.primary-btn .btn-subtitle {
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

/* 下注滑条 */
.betting-slider {
  background: rgba(31, 41, 55, 0.5);
  border-radius: 12px;
  padding: 16px;
  border: 1px solid rgba(75, 85, 99, 0.3);
}

.slider-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bet-slider {
  width: 100%;
  height: 6px;
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
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fbbf24;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}

.bet-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid #fbbf24;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
}

.slider-labels {
  display: flex;
  justify-content: space-between;
  font-family: 'Montserrat', sans-serif;
  font-size: 0.75rem;
  font-weight: 600;
  color: #cbd5e1;
}

.slider-labels span:nth-child(2) {
  color: #f59e0b;
  font-size: 0.8rem;
}

/* 快捷筹码按钮 */
.quick-chips {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 8px;
}

.chip-btn {
  background: linear-gradient(135deg, rgba(31, 41, 55, 0.9) 0%, rgba(17, 24, 39, 0.9) 100%);
  border: 1px solid rgba(245, 158, 11, 0.3);
  border-radius: 8px;
  padding: 8px 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-family: 'Montserrat', sans-serif;
}

.chip-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%);
  border-color: rgba(245, 158, 11, 0.5);
  transform: translateY(-1px);
  box-shadow: 0 3px 8px rgba(245, 158, 11, 0.3);
}

.chip-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chip-amount {
  font-size: 0.65rem;
  font-weight: 700;
  color: #f59e0b;
  letter-spacing: 0.3px;
}

.chip-value {
  font-size: 0.6rem;
  font-weight: 500;
  color: #cbd5e1;
}

.all-in-chip {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%);
  border: 1px solid rgba(248, 113, 113, 0.4);
}

.all-in-chip:hover:not(:disabled) {
  background: linear-gradient(135deg, rgba(248, 113, 113, 0.9) 0%, rgba(239, 68, 68, 0.9) 100%);
  border-color: rgba(248, 113, 113, 0.6);
  box-shadow: 0 3px 8px rgba(239, 68, 68, 0.4);
}

.all-in-chip .chip-amount {
  color: #fecaca;
}

.all-in-chip .chip-value {
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

.game-log {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
  backdrop-filter: blur(20px);
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  box-shadow: 
    0 6px 24px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.log-header h4 {
  background: linear-gradient(135deg, #f8fafc 0%, #cbd5e1 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin: 0 0 12px 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.log-content {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.3) transparent;
}

.log-content::-webkit-scrollbar {
  width: 6px;
}

.log-content::-webkit-scrollbar-track {
  background: rgba(148, 163, 184, 0.1);
  border-radius: 3px;
}

.log-content::-webkit-scrollbar-thumb {
  background: rgba(148, 163, 184, 0.3);
  border-radius: 3px;
  transition: background 0.3s ease;
}

.log-content::-webkit-scrollbar-thumb:hover {
  background: rgba(148, 163, 184, 0.5);
}

.log-item {
  display: flex;
  gap: 12px;
  margin-bottom: 10px;
  font-size: 0.85rem;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(30, 41, 59, 0.3);
  border: 1px solid rgba(148, 163, 184, 0.1);
  transition: all 0.3s ease;
}

.log-item:hover {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(148, 163, 184, 0.2);
}

.log-time {
  color: #94a3b8;
  min-width: 70px;
  font-weight: 500;
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
}

.log-message {
  color: #e2e8f0;
  font-weight: 500;
  flex: 1;
}

.debug-info {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  font-size: 0.8rem;
}

.debug-info p {
  color: #cbd5e1;
  margin: 4px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.debug-info strong {
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 700;
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

/* 响应式断点设计 */

/* 桌面端 - ≥1280px */
@media (min-width: 1280px) {
  .game {
    padding: 20px;
  }
  
  .poker-table {
    height: 520px;
    min-width: 800px;
  }
  
  .player-seat {
    width: 140px;
    height: 120px;
  }
  
  .card {
    width: 58px;
    height: 82px;
    font-size: 1.4rem;
  }
  
  .player-avatar {
    width: 70px;
    height: 70px;
  }
  
  .action-panel {
    padding: 24px;
    min-width: 320px;
  }
  
  .action-buttons {
    gap: 16px;
  }
  
  .action-btn {
    padding: 16px 12px;
  }
  
  .btn-text {
    font-size: 1rem;
  }
  
  .quick-chips {
    gap: 12px;
  }
}

/* 大屏平板端 - 1024px */
@media (max-width: 1279px) and (min-width: 1025px) {
  .game {
    padding: 18px;
  }
  
  .right-panel {
    width: 280px;
  }
  
  .poker-table {
    height: 480px;
  }
  
  .player-seat {
    width: 130px;
    height: 110px;
  }
  
  .action-panel {
    padding: 22px;
  }
}

/* 平板端 - ≤1024px */
@media (max-width: 1024px) {
  .game {
    padding: 15px;
  }
  
  .game-table {
    flex-direction: column;
    gap: 12px;
  }
  
  .right-panel {
    width: 100%;
    flex-direction: row;
    gap: 12px;
    max-height: 200px;
  }
  
  .action-panel {
    flex: 1.2;
    padding: 18px;
  }
  
  .game-log {
    flex: 0.8;
  }
  
  .poker-table {
    height: 420px;
    border-radius: 45% / 28%;
  }
  
  .poker-table::before,
  .poker-table::after {
    border-radius: 45% / 28%;
  }
  
  .player-seat {
    width: 110px;
    height: 90px;
  }
  
  .card {
    width: 48px;
    height: 68px;
    font-size: 1.1rem;
  }
  
  .player-avatar {
    width: 50px;
    height: 50px;
  }
  
  .action-buttons {
    gap: 8px;
  }
  
  .action-btn {
    padding: 10px 6px;
  }
  
  .btn-text {
    font-size: 0.8rem;
  }
  
  .btn-subtitle {
    font-size: 0.65rem;
  }
  
  .quick-chips {
    gap: 6px;
  }
  
  .chip-btn {
    padding: 6px 3px;
  }
}

/* 手机端 - <768px */
@media (max-width: 767px) {
  .game {
    padding: 12px;
    overflow-x: hidden;
  }
  
  .game-header {
    padding: 12px 16px;
    margin-bottom: 8px;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .game-header h2 {
    font-size: 1.3rem;
  }
  
  .game-table {
    gap: 8px;
  }
  
  .poker-table {
    height: 280px;
    border-radius: 50% / 32%;
  }
  
  .poker-table::before,
  .poker-table::after {
    border-radius: 50% / 32%;
  }
  
  .player-seat {
    width: 85px;
    height: 70px;
    margin-left: -42px;
    margin-top: -35px;
  }
  
  .card {
    width: 32px;
    height: 46px;
    font-size: 0.8rem;
  }
  
  .card.small {
    width: 24px;
    height: 34px;
    font-size: 0.6rem;
  }
  
  .player-avatar {
    width: 40px;
    height: 40px;
  }
  
  .player-info {
    padding: 6px 8px;
    font-size: 0.7rem;
    min-width: 80px;
  }
  
  .right-panel {
    flex-direction: column;
    gap: 8px;
    max-height: none;
  }
  
  .action-panel {
    padding: 16px;
  }
  
  .action-buttons {
    gap: 6px;
  }
  
  .action-btn {
    padding: 8px 4px;
  }
  
  .btn-text {
    font-size: 0.75rem;
  }
  
  .btn-subtitle {
    font-size: 0.6rem;
  }
  
  .betting-slider {
    padding: 12px;
  }
  
  .quick-chips {
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  
  .chip-btn {
    padding: 6px 4px;
  }
  
  .chip-amount {
    font-size: 0.6rem;
  }
  
  .chip-value {
    font-size: 0.55rem;
  }
  
  .community-cards {
    gap: 4px;
  }
  
  .game-log {
    max-height: 150px;
    font-size: 0.75rem;
  }
  
  .debug-info p {
    font-size: 0.7rem;
    margin: 2px 0;
  }
}

/* 超小屏设备 - <480px */
@media (max-width: 479px) {
  .game {
    padding: 8px;
  }
  
  .poker-table {
    height: 220px;
  }
  
  .player-seat {
    width: 70px;
    height: 60px;
    margin-left: -35px;
    margin-top: -30px;
  }
  
  .card {
    width: 28px;
    height: 40px;
    font-size: 0.7rem;
  }
  
  .card.small {
    width: 20px;
    height: 28px;
    font-size: 0.5rem;
  }
  
  .player-avatar {
    width: 32px;
    height: 32px;
  }
  
  .avatar-text {
    font-size: 0.7rem;
  }
  
  .action-panel {
    padding: 12px;
  }
  
  .btn-text {
    font-size: 0.7rem;
  }
  
  .btn-subtitle {
    font-size: 0.55rem;
  }
}
</style>