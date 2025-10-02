import database from './database.js'

export class GameRoom {
  static async create({ id, name, creatorId, maxPlayers = 10, smallBlind = 10, bigBlind = 20 }) {
    const sql = `
      INSERT INTO game_rooms (id, name, creator_id, max_players, small_blind, big_blind)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    await database.run(sql, [id, name, creatorId, maxPlayers, smallBlind, bigBlind])
    return await this.findById(id)
  }

  static async findById(id) {
    const sql = 'SELECT * FROM game_rooms WHERE id = ?'
    return await database.get(sql, [id])
  }

  static async findAll() {
    const sql = `
      SELECT gr.*, u.username as creator_name
      FROM game_rooms gr
      LEFT JOIN users u ON gr.creator_id = u.id
      ORDER BY gr.created_at DESC
    `
    return await database.all(sql)
  }

  static async findByStatus(status) {
    const sql = `
      SELECT gr.*, u.username as creator_name
      FROM game_rooms gr
      LEFT JOIN users u ON gr.creator_id = u.id
      WHERE gr.status = ?
      ORDER BY gr.created_at DESC
    `
    return await database.all(sql, [status])
  }

  static async updateStatus(id, status) {
    const sql = `
      UPDATE game_rooms 
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [status, id])
    return await this.findById(id)
  }

  static async updatePlayers(id, players) {
    const playersJson = JSON.stringify(players)
    const sql = `
      UPDATE game_rooms 
      SET players = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [playersJson, id])
    return await this.findById(id)
  }

  static async updateGameState(id, gameState) {
    const gameStateJson = JSON.stringify(gameState)
    const sql = `
      UPDATE game_rooms 
      SET game_state = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [gameStateJson, id])
    return await this.findById(id)
  }

  static async updateCreator(id, creatorId) {
    const sql = `
      UPDATE game_rooms 
      SET creator_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    await database.run(sql, [creatorId, id])
    return await this.findById(id)
  }

  static async deleteById(id) {
    const sql = 'DELETE FROM game_rooms WHERE id = ?'
    return await database.run(sql, [id])
  }

  static async findByCreator(creatorId) {
    const sql = `
      SELECT * FROM game_rooms 
      WHERE creator_id = ?
      ORDER BY created_at DESC
    `
    return await database.all(sql, [creatorId])
  }

  // 娓呯悊杩囨湡鎴块棿
  static async cleanupExpiredRooms() {
    const sql = `
      DELETE FROM game_rooms 
      WHERE status = 'waiting' 
      AND created_at < datetime('now', '-1 hour')
    `
    return await database.run(sql)
  }

  // 鑾峰彇鎴块棿缁熻淇℃伅
  static async getRoomStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_rooms,
        COUNT(CASE WHEN status = 'waiting' THEN 1 END) as waiting_rooms,
        COUNT(CASE WHEN status = 'playing' THEN 1 END) as playing_rooms,
        COUNT(CASE WHEN status = 'finished' THEN 1 END) as finished_rooms
      FROM game_rooms
    `
    return await database.get(sql)
  }
}

