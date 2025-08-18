import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 确保数据目录存在
const dataDir = path.join(__dirname, '../../data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const dbPath = process.env.DB_PATH || path.join(dataDir, 'database.sqlite')

class Database {
  constructor() {
    this.db = null
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          console.error('数据库连接失败:', err.message)
          reject(err)
        } else {
          console.log('数据库连接成功')
          this.initTables().then(resolve).catch(reject)
        }
      })
    })
  }

  async initTables() {
    const tables = [
      // 用户表
      `CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        chips INTEGER DEFAULT 1000,
        games_played INTEGER DEFAULT 0,
        games_won INTEGER DEFAULT 0,
        total_chips_won INTEGER DEFAULT 0,
        total_chips_lost INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login_at DATETIME,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
      
      // 游戏房间表
      `CREATE TABLE IF NOT EXISTS game_rooms (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        creator_id TEXT NOT NULL,
        max_players INTEGER DEFAULT 6,
        small_blind INTEGER DEFAULT 10,
        big_blind INTEGER DEFAULT 20,
        status TEXT DEFAULT 'waiting',
        players TEXT DEFAULT '[]',
        game_state TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (creator_id) REFERENCES users (id)
      )`,
      
      // 游戏记录表
      `CREATE TABLE IF NOT EXISTS game_records (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        players TEXT NOT NULL,
        winner_id TEXT,
        pot_amount INTEGER NOT NULL,
        duration INTEGER,
        game_data TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES game_rooms (id),
        FOREIGN KEY (winner_id) REFERENCES users (id)
      )`,
      
      // 用户游戏记录表
      `CREATE TABLE IF NOT EXISTS user_game_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        game_record_id TEXT NOT NULL,
        chips_start INTEGER NOT NULL,
        chips_end INTEGER NOT NULL,
        chips_change INTEGER NOT NULL,
        position INTEGER,
        cards_dealt TEXT,
        actions TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (game_record_id) REFERENCES game_records (id)
      )`
    ]

    for (const tableSQL of tables) {
      await this.run(tableSQL)
    }

    // 创建索引
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)',
      'CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status)',
      'CREATE INDEX IF NOT EXISTS idx_game_records_room_id ON game_records(room_id)',
      'CREATE INDEX IF NOT EXISTS idx_user_game_records_user_id ON user_game_records(user_id)'
    ]

    for (const indexSQL of indexes) {
      await this.run(indexSQL)
    }

    console.log('数据库表初始化完成')
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          console.error('SQL执行错误:', err.message)
          console.error('SQL语句:', sql)
          reject(err)
        } else {
          resolve({ id: this.lastID, changes: this.changes })
        }
      })
    })
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          console.error('SQL查询错误:', err.message)
          console.error('SQL语句:', sql)
          reject(err)
        } else {
          resolve(row)
        }
      })
    })
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          console.error('SQL查询错误:', err.message)
          console.error('SQL语句:', sql)
          reject(err)
        } else {
          resolve(rows)
        }
      })
    })
  }

  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err)
          } else {
            console.log('数据库连接已关闭')
            resolve()
          }
        })
      } else {
        resolve()
      }
    })
  }
}

// 创建全局数据库实例
const database = new Database()

// 在应用启动时连接数据库
database.connect().catch(err => {
  console.error('数据库初始化失败:', err)
  process.exit(1)
})

export default database