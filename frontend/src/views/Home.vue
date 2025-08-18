<template>
  <div class="home">
    <div class="container">
      <header class="header">
        <h1 class="title">德州扑克</h1>
        <p class="subtitle">专业的在线德州扑克游戏平台</p>
      </header>
      
      <main class="main-content">
        <div class="game-modes">
          <div class="card mode-card">
            <h3>快速游戏</h3>
            <p>立即开始一局德州扑克游戏</p>
            <router-link to="/game" class="btn btn-primary">开始游戏</router-link>
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
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'

const router = useRouter()

const userStats = ref({
  gamesPlayed: 0,
  winRate: 0,
  chips: 1000
})

const createRoom = async () => {
  try {
    const { value: roomName } = await ElMessageBox.prompt('请输入房间名称', '创建房间', {
      confirmButtonText: '创建',
      cancelButtonText: '取消',
      inputPlaceholder: '输入房间名称'
    })
    
    if (roomName) {
      ElMessage.success(`房间 "${roomName}" 创建成功！`)
      // TODO: 实际创建房间的API调用
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
      ElMessage.success(`正在加入房间 ${roomId}...`)
      // TODO: 实际加入房间的API调用
    }
  } catch {
    // 用户取消
  }
}

onMounted(() => {
  // TODO: 从API获取用户统计数据
  const savedStats = localStorage.getItem('userStats')
  if (savedStats) {
    userStats.value = JSON.parse(savedStats)
  }
})
</script>

<style scoped>
.home {
  min-height: 100vh;
  padding: 20px 0;
}

.header {
  text-align: center;
  margin-bottom: 60px;
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