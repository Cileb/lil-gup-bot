const Database = require("better-sqlite3")

const db = new Database("bot.db")


db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        role_id TEXT,
        message TEXT NOT NULL,
        cron_expression TEXT NOT NULL,
        timezone TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    
    )
`)

module.exports = db;