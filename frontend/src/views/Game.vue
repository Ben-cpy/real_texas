<template>
  <div class="game">
    <div class="game-header">
      <div class="game-info">
        <h3>德州扑克游戏</h3>
        <p>房间号: {{ roomId }} | 底注: {{ blinds.small }}/{{ blinds.big }}</p>
      </div>
      <div class="user-info">
        <span>{{ username }}</span>
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
              :class="{ 'revealed': card.revealed }"
            >
              <span v-if="card.revealed" :class="getCardColor(card.suit)">
                {{ card.suit }}{{ card.rank }}
              </span>
              <span v-else>🂠</span>
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
            <div class="player-info">
              <div class="player-name">{{ player.name }}</div>
              <div class="player-chips">${{ player.chips }}</div>
              <div class="player-bet" v-if="player.currentBet > 0">${{ player.currentBet }}</div>
            </div>
            <div class="player-cards" v-if="player.cards.length > 0">
              <div
                v-for="(card, cardIndex) in player.cards"
                :key="cardIndex"
                class="card small"
                :class="{ 'face-up': player.id === userId }"
              >
                <span v-if="player.id === userId" :class="getCardColor(card.suit)">{{ card.suit }}{{ card.rank }}</span>
                <span v-else>🂠</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 操作面板 -->
      <div class="action-panel" v-if="isMyTurn">
        <div class="betting-controls">
          <el-slider
            v-model="betAmount"
            :min="minBet"
            :max="maxBet"
            :step="blinds.small"
            show-input
            :input-size="'small'"
          />
          <div class="bet-buttons">
            <el-button @click="fold" type="danger">弃牌</el-button>
            <el-button @click="check" v-if="canCheck">过牌</el-button>
            <el-button @click="call" v-if="!canCheck">跟注 (${{ callAmount }})</el-button>
            <el-button @click="bet" type="primary">下注 (${{ betAmount }})</el-button>
            <el-button @click="allIn" type="warning">全押</el-button>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 游戏日志 -->
    <div class="game-log">
      <div class="log-header">
        <h4>游戏日志</h4>
      </div>
      <div class="log-content">
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
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const router = useRouter()

const username = ref(localStorage.getItem('username') || 'Guest')
const userId = ref('user1') // 当前用户ID
const roomId = ref('ROOM001')

const gameState = reactive({
  currentPlayer: 'user1',
  phase: 'preflop', // preflop, flop, turn, river, showdown
  pot: 150,
  currentBet: 50,
  minBet: 10,
  maxBet: 1000
})

const blinds = reactive({
  small: 10,
  big: 20
})

const betAmount = ref(50)

const communityCards = ref([
  { suit: '♠', rank: 'A', revealed: true },
  { suit: '♥', rank: 'K', revealed: true },
  { suit: '♦', rank: 'Q', revealed: true },
  { suit: '♣', rank: 'J', revealed: false },
  { suit: '♠', rank: '10', revealed: false }
])

const players = ref([
  {
    id: 'user1',
    name: '我',
    chips: 1000,
    currentBet: 50,
    cards: [
      { suit: '♠', rank: 'A' },
      { suit: '♥', rank: 'K' }
    ],
    folded: false,
    allIn: false
  },
  {
    id: 'user2',
    name: '玩家2',
    chips: 850,
    currentBet: 50,
    cards: [
      { suit: '♣', rank: '??' },
      { suit: '♦', rank: '??' }
    ],
    folded: false,
    allIn: false
  },
  {
    id: 'user3',
    name: '玩家3',
    chips: 1200,
    currentBet: 0,
    cards: [],
    folded: true,
    allIn: false
  }
])

const gameLog = ref([
  { time: new Date(), message: '游戏开始，发放底牌' },
  { time: new Date(), message: '玩家2 下注 $50' },
  { time: new Date(), message: '我 跟注 $50' },
  { time: new Date(), message: '玩家3 弃牌' }
])

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
  const radius = 200
  const x = Math.cos((angle * Math.PI) / 180) * radius
  const y = Math.sin((angle * Math.PI) / 180) * radius
  
  return {
    transform: `translate(${x}px, ${y}px)`
  }
}

const fold = () => {
  addLog('我 弃牌')
  // TODO: 发送弃牌请求到服务器
  nextPlayer()
}

const check = () => {
  addLog('我 过牌')
  // TODO: 发送过牌请求到服务器
  nextPlayer()
}

const call = () => {
  const amount = callAmount.value
  addLog(`我 跟注 $${amount}`)
  // TODO: 发送跟注请求到服务器
  nextPlayer()
}

const bet = () => {
  addLog(`我 下注 $${betAmount.value}`)
  // TODO: 发送下注请求到服务器
  nextPlayer()
}

const allIn = () => {
  const myPlayer = players.value.find(p => p.id === userId.value)
  if (myPlayer) {
    addLog(`我 全押 $${myPlayer.chips}`)
    // TODO: 发送全押请求到服务器
  }
  nextPlayer()
}

const nextPlayer = () => {
  // 简单的下一个玩家逻辑
  const currentIndex = players.value.findIndex(p => p.id === gameState.currentPlayer)
  const nextIndex = (currentIndex + 1) % players.value.length
  gameState.currentPlayer = players.value[nextIndex].id
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

const leaveGame = () => {
  router.push('/')
}

onMounted(() => {
  // TODO: 连接WebSocket，初始化游戏状态
  ElMessage.success('已加入游戏')
})

onUnmounted(() => {
  // TODO: 断开WebSocket连接
})
</script>

<style scoped>
.game {
  min-height: 100vh;
  background: linear-gradient(135deg, #0f1419 0%, #1a2332 100%);
  padding: 20px;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 10px;
  padding: 15px 25px;
  margin-bottom: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.game-info h3 {
  color: #fff;
  margin: 0;
  font-size: 1.2rem;
}

.game-info p {
  color: #ccc;
  margin: 5px 0 0 0;
  font-size: 0.9rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 15px;
  color: #fff;
}

.game-table {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 20px;
  height: calc(100vh - 180px);
}

.poker-table {
  position: relative;
  background: radial-gradient(ellipse at center, #1a4b3a 0%, #0d2818 100%);
  border-radius: 50%;
  border: 8px solid #8B4513;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 500px;
}

.community-cards {
  text-align: center;
  z-index: 10;
}

.pot-info {
  margin-bottom: 20px;
}

.pot-amount, .current-bet {
  color: #fff;
  font-weight: bold;
  font-size: 1.1rem;
  margin: 5px 0;
}

.cards {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.card {
  width: 50px;
  height: 70px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  transition: all 0.3s ease;
}

.card.small {
  width: 35px;
  height: 50px;
  font-size: 0.8rem;
}

.card.revealed {
  transform: rotateY(0deg);
}

.card:not(.revealed) {
  background: #4a5568;
  color: #fff;
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
  width: 120px;
  height: 100px;
  margin-left: -60px;
  margin-top: -50px;
  text-align: center;
}

.player-info {
  background: rgba(255, 255, 255, 0.9);
  border-radius: 10px;
  padding: 8px;
  margin-bottom: 5px;
  font-size: 0.8rem;
}

.player-seat.current-player .player-info {
  background: rgba(102, 126, 234, 0.9);
  color: white;
}

.player-seat.folded .player-info {
  background: rgba(255, 255, 255, 0.5);
  opacity: 0.6;
}

.player-name {
  font-weight: bold;
}

.player-chips {
  color: #2d5016;
  font-weight: bold;
}

.player-bet {
  color: #d63384;
  font-weight: bold;
  font-size: 0.7rem;
}

.player-cards {
  display: flex;
  gap: 3px;
  justify-content: center;
}

.action-panel {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 25px;
}

.betting-controls {
  text-align: center;
}

.bet-buttons {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game-log {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  border-radius: 15px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  padding: 20px;
  display: flex;
  flex-direction: column;
  max-height: 400px;
}

.log-header h4 {
  color: #fff;
  margin: 0 0 15px 0;
  font-size: 1.1rem;
}

.log-content {
  flex: 1;
  overflow-y: auto;
}

.log-item {
  display: flex;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 0.85rem;
}

.log-time {
  color: #999;
  min-width: 60px;
}

.log-message {
  color: #fff;
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

@media (max-width: 1024px) {
  .game-table {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
  
  .poker-table {
    min-height: 400px;
  }
}
</style>