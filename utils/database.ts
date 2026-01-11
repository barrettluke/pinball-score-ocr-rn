import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async () => {
  if (db) {
    return db;
  }
  db = await SQLite.openDatabaseAsync('pinball.db');
  await initDatabase(db);
  return db;
};

const initDatabase = async (database: SQLite.SQLiteDatabase) => {
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS machines (
      opdb_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      manufacturer TEXT,
      year TEXT,
      image_url TEXT
    );
    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      value INTEGER NOT NULL,
      machine_id TEXT,
      image_uri TEXT,
      date TEXT NOT NULL,
      FOREIGN KEY(machine_id) REFERENCES machines(opdb_id)
    );
    CREATE TABLE IF NOT EXISTS machine_rules (
      opdb_id TEXT PRIMARY KEY,
      summary TEXT NOT NULL,
      key_shots TEXT,
      modes TEXT,
      scoring_tips TEXT,
      updated_at TEXT
    );
  `);

  // Migration for existing tables
  try {
    await database.execAsync('ALTER TABLE machines ADD COLUMN image_url TEXT;');
  } catch (e) {
    // Column likely already exists
  }
};
