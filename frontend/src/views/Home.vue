<template>
  <div class="home">
    <div class="container">
      <header class="header">
        <div class="header-content">
          <div class="header-text">
            <h1 class="title">德州扑克</h1>
            <p class="subtitle">专业的在线德州扑克游戏平台</p>
          </div>
          <div class="header-actions">
            <div class="user-info-panel">
              <div class="user-name">
                <span class="name-label">Welcome,</span>
                <span class="name-value">{{ userStore.username }}</span>
              </div>
              <div class="current-chips">
                <span class="chips-label">当前筹码</span>
                <span class="chips-value">${{ userStats.chips.toLocaleString() }}</span>
              </div>
            </div>
            <button class="btn btn-logout" @click="handleLogout">Logout</button>
          </div>
        </div>
      </header>
      
      <main class="main-content">
        <div class="game-modes">
          <div class="card mode-card">
            <h3>快速游戏</h3>
            <p>立即开始一局德州扑克游戏</p>
            <button
              class="btn btn-primary"
              @click="startQuickGame"
              :disabled="isCreatingQuickGame"
            >
              {{ isCreatingQuickGame ? '创建中...' : '开始游戏' }}
            </button>
          </div>
          
          <div class="card mode-card">
            <h3>创建房间</h3>
            <p>创建私人房间，邀请朋友一起游戏</p>
            <button class="btn btn-secondary" @click="createRoom">创建房间</button>
          </div>
          
          <div class="card mode-card">
            <h3>加入房间</h3>
            <p>输入房间号加入朋友的游戏</p>
            <button class="btn btn-success" @click="joinRoom">加入房间</button>
          </div>
        </div>
        
        <div class="stats-section">
          <div class="card stats-card">
            <h3>游戏统计</h3>
            <div class="stats-grid">
              <div class="stat-item">
                <div class="stat-value">{{ userStats.gamesPlayed }}</div>
                <div class="stat-label">游戏场次</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ userStats.winRate }}%</div>
                <div class="stat-label">胜率</div>
              </div>
              <div class="stat-item">
                <div class="stat-value">{{ userStats.chips }}</div>
                <div class="stat-label">筹码</div>
              </div>
            </div>
            <button
              v-if="userStats.chips < 1000"
              class="btn btn-relief"
              @click="claimReliefFund"
            >
              领取救济金 (10,000筹码)
            </button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '../stores/user'
import * as api from '../services/api'

const router = useRouter()
const userStore = useUserStore()

const userStats = computed(() => ({
  gamesPlayed: userStore.gamesPlayed || 0,
  winRate: userStore.winRate || 0,
  chips: userStore.chips || 0
}))

const isCreatingQuickGame = ref(false)

const startQuickGame = async () => {
  if (isCreatingQuickGame.value) {
    return
  }

  try {
    isCreatingQuickGame.value = true

    const timestamp = new Date()
    const roomName = `Quick Game ${timestamp.getHours().toString().padStart(2, '0')}:${timestamp
      .getMinutes()
      .toString()
      .padStart(2, '0')}`

    const response = await api.createRoom({
      name: roomName,
      maxPlayers: 4,
      smallBlind: 10,
      bigBlind: 20
    })

    const roomId = response?.room?.id
    if (!roomId) {
      throw new Error('未获取到房间 ID')
    }

    await api.joinRoom(roomId)

    router.push(`/game?roomId=${roomId}`)
  } catch (error) {
    const message = error?.response?.data?.error || error.message || '创建快速游戏失败'
    ElMessage.error(message)
  } finally {
    isCreatingQuickGame.value = false
  }
}

const createRoom = async () => {
  try {
    const { value: roomName } = await ElMessageBox.prompt('请输入房间名称', '创建房间', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: '输入房间名称'
    })

    if (roomName) {
      try {
        const response = await api.createRoom({
          name: roomName,
          maxPlayers: 6,
          smallBlind: 10,
          bigBlind: 20
        })

        ElMessage.success(`房间 "${roomName}" 创建成功！`)

        // Navigate to game room
        router.push(`/game?roomId=${response.room.id}`)
      } catch (error) {
        ElMessage.error(error.response?.data?.error || '创建房间失败')
      }
    }
  } catch {
    // 用户取消
  }
}

const joinRoom = async () => {
  try {
    const { value: roomId } = await ElMessageBox.prompt('请输入房间号', '加入房间', {
      confirmButtonText: '加入',
      cancelButtonText: '取消',
      inputPlaceholder: '输入房间号'
    })

    if (roomId) {
      try {
        await api.joinRoom(roomId)
        ElMessage.success(`正在加入房间...`)

        // Navigate to game room
        router.push(`/game?roomId=${roomId}`)
      } catch (error) {
        ElMessage.error(error.response?.data?.error || '加入房间失败')
      }
    }
  } catch {
    // 用户取消
  }
}

const handleLogout = () => {
  userStore.logout()
  router.push('/login')
}

const claimReliefFund = async () => {
  try {
    const response = await api.claimReliefFund()
    if (response.success) {
      ElMessage.success(`成功领取救济金！当前筹码: ${response.chips}`)
      await userStore.refreshProfile()
    } else {
      ElMessage.error(response.message || '领取失败')
    }
  } catch (error) {
    ElMessage.error(error.response?.data?.error || '领取救济金失败')
  }
}

onMounted(async () => {
  // Refresh user profile to get latest stats
  await userStore.refreshProfile()
  await userStore.fetchStats()
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  padding: 20px 0;
}

.header {
  margin-bottom: 60px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
}

.header-text {
  flex: 1;
}

.header-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.user-info-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.2), rgba(118, 75, 162, 0.2));
  padding: 16px 24px;
  border-radius: 16px;
  border: 2px solid rgba(102, 126, 234, 0.3);
}

.user-name {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.name-label {
  font-size: 0.75rem;
  color: rgba(203, 213, 225, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.name-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: #e2e8f0;
}

.current-chips {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  padding-top: 8px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.chips-label {
  font-size: 0.75rem;
  color: rgba(203, 213, 225, 0.7);
}

.chips-value {
  font-size: 1.75rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.title {
  font-size: 4rem;
  font-weight: 700;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 10px;
}

.subtitle {
  font-size: 1.2rem;
  color: #ccc;
}

.btn-logout {
  padding: 10px 20px;
  background: transparent;
  border: 2px solid rgba(255, 255, 255, 0.3);
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  font-weight: 600;
  white-space: nowrap;
}

.btn-logout:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
  transform: translateY(-2px);
}

.game-modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 30px;
  margin-bottom: 60px;
}

.mode-card {
  text-align: center;
  padding: 40px 30px;
  transition: transform 0.3s ease;
}

.mode-card:hover {
  transform: translateY(-5px);
}

.mode-card h3 {
  font-size: 1.5rem;
  margin-bottom: 15px;
  color: #fff;
}

.mode-card p {
  color: #ccc;
  margin-bottom: 25px;
}

.stats-section {
  max-width: 600px;
  margin: 0 auto;
}

.stats-card {
  text-align: center;
  padding: 30px;
}

.stats-card h3 {
  font-size: 1.5rem;
  margin-bottom: 25px;
  color: #fff;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
}

.stat-item {
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #667eea;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 0.9rem;
  color: #ccc;
}

.btn-relief {
  width: 100%;
  margin-top: 20px;
  padding: 15px;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);
}

.btn-relief:hover {
  background: linear-gradient(135deg, #059669 0%, #047857 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(16, 185, 129, 0.5);
}

@media (max-width: 768px) {
  .title {
    font-size: 2.5rem;
  }
  
  .game-modes {
    grid-template-columns: 1fr;
  }
  
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>