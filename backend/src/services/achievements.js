/**
 * Achievements System
 * Defines and manages player achievements
 */

// Achievement definitions
export const ACHIEVEMENTS = {
  // Getting Started Achievements
  FIRST_GAME: {
    id: 'first_game',
    name: '首局游戏',
    description: '完成第一局游戏',
    icon: '🎮',
    condition: (stats) => stats.gamesPlayed >= 1,
    reward: 100
  },

  BEGINNER: {
    id: 'beginner',
    name: '新手玩家',
    description: '完成10局游戏',
    icon: '🌟',
    condition: (stats) => stats.gamesPlayed >= 10,
    reward: 500
  },

  VETERAN: {
    id: 'veteran',
    name: '经验丰富',
    description: '完成50局游戏',
    icon: '⭐',
    condition: (stats) => stats.gamesPlayed >= 50,
    reward: 2000
  },

  MASTER: {
    id: 'master',
    name: '德扑大师',
    description: '完成100局游戏',
    icon: '👑',
    condition: (stats) => stats.gamesPlayed >= 100,
    reward: 5000
  },

  // Winning Achievements
  FIRST_WIN: {
    id: 'first_win',
    name: '首胜',
    description: '赢得第一局游戏',
    icon: '🏆',
    condition: (stats) => stats.gamesWon >= 1,
    reward: 200
  },

  WINNER: {
    id: 'winner',
    name: '常胜将军',
    description: '赢得10局游戏',
    icon: '🎖️',
    condition: (stats) => stats.gamesWon >= 10,
    reward: 1000
  },

  CHAMPION: {
    id: 'champion',
    name: '冠军',
    description: '赢得50局游戏',
    icon: '🥇',
    condition: (stats) => stats.gamesWon >= 50,
    reward: 5000
  },

  // Win Rate Achievements
  LUCKY_STREAK: {
    id: 'lucky_streak',
    name: '幸运连胜',
    description: '胜率达到60%（至少10局）',
    icon: '🍀',
    condition: (stats) => {
      if (stats.gamesPlayed < 10) return false
      const winRate = stats.gamesWon / stats.gamesPlayed
      return winRate >= 0.6
    },
    reward: 1500
  },

  HOT_HAND: {
    id: 'hot_hand',
    name: '火热手气',
    description: '胜率达到75%（至少20局）',
    icon: '🔥',
    condition: (stats) => {
      if (stats.gamesPlayed < 20) return false
      const winRate = stats.gamesWon / stats.gamesPlayed
      return winRate >= 0.75
    },
    reward: 3000
  },

  // Chips Achievements
  CHIP_COLLECTOR: {
    id: 'chip_collector',
    name: '筹码收集者',
    description: '累计赢得10,000筹码',
    icon: '💰',
    condition: (stats) => stats.chipsWon >= 10000,
    reward: 1000
  },

  HIGH_ROLLER: {
    id: 'high_roller',
    name: '豪赌客',
    description: '拥有50,000筹码',
    icon: '💎',
    condition: (stats) => stats.chips >= 50000,
    reward: 5000
  },

  MILLIONAIRE: {
    id: 'millionaire',
    name: '百万富翁',
    description: '拥有100,000筹码',
    icon: '🤑',
    condition: (stats) => stats.chips >= 100000,
    reward: 10000
  },

  // Special Achievements
  ALL_IN_KING: {
    id: 'all_in_king',
    name: 'All-in之王',
    description: '成功All-in 10次',
    icon: '🎰',
    condition: (stats) => (stats.allInWins || 0) >= 10,
    reward: 2000
  },

  BLUFF_MASTER: {
    id: 'bluff_master',
    name: '诈唬大师',
    description: '用弱牌赢得5次',
    icon: '🎭',
    condition: (stats) => (stats.bluffWins || 0) >= 5,
    reward: 2500
  },

  COMEBACK_KING: {
    id: 'comeback_king',
    name: '逆转之王',
    description: '从少于1000筹码逆转赢得游戏5次',
    icon: '🔄',
    condition: (stats) => (stats.comebackWins || 0) >= 5,
    reward: 3000
  }
}

/**
 * Check which achievements a player has unlocked
 * @param {Object} userStats - User statistics
 * @param {Array} unlockedAchievements - Already unlocked achievement IDs
 * @returns {Array} Newly unlocked achievements
 */
export function checkAchievements(userStats, unlockedAchievements = []) {
  const newlyUnlocked = []

  for (const achievement of Object.values(ACHIEVEMENTS)) {
    // Skip if already unlocked
    if (unlockedAchievements.includes(achievement.id)) {
      continue
    }

    // Check if condition is met
    if (achievement.condition(userStats)) {
      newlyUnlocked.push(achievement)
    }
  }

  return newlyUnlocked
}

/**
 * Calculate total reward chips from achievements
 * @param {Array} achievementIds - Array of achievement IDs
 * @returns {number} Total reward chips
 */
export function calculateAchievementRewards(achievementIds) {
  return achievementIds.reduce((total, id) => {
    const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === id)
    return total + (achievement?.reward || 0)
  }, 0)
}

/**
 * Get achievement progress for a specific achievement
 * @param {string} achievementId - Achievement ID
 * @param {Object} userStats - User statistics
 * @returns {Object} Progress information
 */
export function getAchievementProgress(achievementId, userStats) {
  const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId)
  if (!achievement) {
    return null
  }

  // Get current value and target value based on achievement type
  let current = 0
  let target = 0
  let percentage = 0

  if (achievementId.includes('game')) {
    if (achievementId === 'first_game') {
      target = 1
      current = Math.min(userStats.gamesPlayed, 1)
    } else if (achievementId === 'beginner') {
      target = 10
      current = Math.min(userStats.gamesPlayed, 10)
    } else if (achievementId === 'veteran') {
      target = 50
      current = Math.min(userStats.gamesPlayed, 50)
    } else if (achievementId === 'master') {
      target = 100
      current = Math.min(userStats.gamesPlayed, 100)
    }
  } else if (achievementId.includes('win')) {
    if (achievementId === 'first_win') {
      target = 1
      current = Math.min(userStats.gamesWon, 1)
    } else if (achievementId === 'winner') {
      target = 10
      current = Math.min(userStats.gamesWon, 10)
    } else if (achievementId === 'champion') {
      target = 50
      current = Math.min(userStats.gamesWon, 50)
    }
  }

  percentage = target > 0 ? Math.floor((current / target) * 100) : 0

  return {
    achievement,
    current,
    target,
    percentage,
    unlocked: achievement.condition(userStats)
  }
}
