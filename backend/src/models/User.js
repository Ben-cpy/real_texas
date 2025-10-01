import database from './database.js'

export class User {
  static async create({ id, username, password, chips = 1000 }) {
    const sql = `
      INSERT INTO users (id, username, password, chips)
      VALUES (?, ?, ?, ?)
    `
    await database.run(sql, [id, username, password, chips])
    return await this.findById(id)
  }

  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = ?'
    return await database.get(sql, [id])
  }

  static async findByUsername(username) {
    const sql = 'SELECT * FROM users WHERE username = ?'
    return await database.get(sql, [username])
  }

  static async updateLastLogin(id) {
    const sql = `
      UPDATE users 
      SET last_login_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    return await database.run(sql, [id])
  }

  static async updateProfile(id, { username }) {
    const sql = `
      UPDATE users 
      SET username = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [username, id])
    return await this.findById(id)
  }

  static async updateChips(id, chips) {
    const sql = `
      UPDATE users 
      SET chips = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [chips, id])
    return await this.findById(id)
  }

  static async updateGameStats(id, { gamesPlayed, gamesWon, chipsWon = 0, chipsLost = 0 }) {
    const sql = `
      UPDATE users 
      SET 
        games_played = games_played + ?,
        games_won = games_won + ?,
        total_chips_won = total_chips_won + ?,
        total_chips_lost = total_chips_lost + ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [gamesPlayed, gamesWon, chipsWon, chipsLost, id])
    return await this.findById(id)
  }

  static async getLeaderboard(orderBy = 'chips', limit = 10) {
    const validOrderBy = ['chips', 'games_won', 'games_played']
    if (!validOrderBy.includes(orderBy)) {
      orderBy = 'chips'
    }

    const sql = `
      SELECT id, username, chips, games_played, games_won
      FROM users
      ORDER BY ${orderBy} DESC
      LIMIT ?
    `
    return await database.all(sql, [limit])
  }

  static async findAll() {
    const sql = 'SELECT id, username, chips, games_played, games_won, created_at FROM users'
    return await database.all(sql)
  }

  static async deleteById(id) {
    const sql = 'DELETE FROM users WHERE id = ?'
    return await database.run(sql, [id])
  }

  // 搜索用户
  static async search(query, limit = 10) {
    const sql = `
      SELECT id, username, chips, games_played, games_won
      FROM users
      WHERE username LIKE ?
      ORDER BY username
      LIMIT ?
    `
    return await database.all(sql, [`%${query}%`, limit])
  }

  // 获取用户统计信息
  static async getStats(id) {
    const user = await this.findById(id)
    if (!user) return null

    return {
      gamesPlayed: user.games_played,
      gamesWon: user.games_won,
      gamesLost: user.games_played - user.games_won,
      winRate: user.games_played > 0 ? Math.round((user.games_won / user.games_played) * 100) : 0,
      chips: user.chips,
      totalChipsWon: user.total_chips_won || 0,
      totalChipsLost: user.total_chips_lost || 0,
      chipsWon: user.total_chips_won || 0,
      chipsLost: user.total_chips_lost || 0
    }
  }

  // 获取用户成就
  static async getAchievements(id) {
    const user = await this.findById(id)
    if (!user) return []

    try {
      return user.achievements ? JSON.parse(user.achievements) : []
    } catch (error) {
      console.error('Error parsing achievements:', error)
      return []
    }
  }

  // 添加成就
  static async addAchievement(id, achievementId) {
    const achievements = await this.getAchievements(id)

    if (achievements.includes(achievementId)) {
      return achievements
    }

    achievements.push(achievementId)

    const sql = `
      UPDATE users
      SET achievements = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [JSON.stringify(achievements), id])
    return achievements
  }

  // 批量添加成就
  static async addAchievements(id, achievementIds) {
    const currentAchievements = await this.getAchievements(id)
    const newAchievements = [...new Set([...currentAchievements, ...achievementIds])]

    const sql = `
      UPDATE users
      SET achievements = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [JSON.stringify(newAchievements), id])
    return newAchievements
  }
}