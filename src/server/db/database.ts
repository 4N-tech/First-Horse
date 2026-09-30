import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import { getSeedSql } from './seed.ts';

let dbInstance: SqlJsDatabase | null = null;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'factory.db');

export async function getDb(): Promise<SqlJsDatabase> {
  if (dbInstance) {
    return dbInstance;
  }

  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const fileBuffer = fs.readFileSync(DB_FILE);
      dbInstance = new SQL.Database(fileBuffer);
      dbInstance.run('PRAGMA foreign_keys = ON;');
      return dbInstance;
    } catch (err) {
      console.error('Failed to load existing database file, creating a fresh one:', err);
    }
  }

  // Create new database
  dbInstance = new SQL.Database();
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Run schema
  const schemaPath = path.resolve(process.cwd(), 'src/server/db/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  dbInstance.exec(schemaSql);

  // Seed default data
  const seedSql = await getSeedSql();
  dbInstance.exec(seedSql);

  // Persist initial DB to disk
  saveDb(dbInstance);

  return dbInstance;
}

export function saveDb(db: SqlJsDatabase) {
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_FILE, buffer);
  } catch (err) {
    console.error('Failed to persist SQLite database to disk:', err);
  }
}

export type SqlParam = string | number | Uint8Array | boolean | null;

function normalizeParams(params: SqlParam[]): (string | number | Uint8Array | null)[] {
  return params.map((p) => {
    if (typeof p === 'boolean') {
      return p ? 1 : 0;
    }
    return p;
  });
}

export async function query<T = any>(sqlStr: string, params: SqlParam[] = []): Promise<T[]> {
  const db = await getDb();
  const stmt = db.prepare(sqlStr);
  const normalized = normalizeParams(params);
  if (normalized.length > 0) {
    stmt.bind(normalized);
  }

  const results: T[] = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject() as unknown as T);
  }
  stmt.free();
  return results;
}

export async function queryOne<T = any>(sqlStr: string, params: SqlParam[] = []): Promise<T | null> {
  const rows = await query<T>(sqlStr, params);
  return rows.length > 0 ? rows[0] : null;
}

export async function execute(
  sqlStr: string,
  params: SqlParam[] = []
): Promise<{ changes: number; lastInsertRowid: number }> {
  const db = await getDb();
  const normalized = normalizeParams(params);
  db.run(sqlStr, normalized);

  const changesResult = db.exec('SELECT changes() as changes, last_insert_rowid() as last_id;');
  let changes = 0;
  let lastInsertRowid = 0;

  if (changesResult.length > 0 && changesResult[0].values.length > 0) {
    changes = Number(changesResult[0].values[0][0]);
    lastInsertRowid = Number(changesResult[0].values[0][1]);
  }

  saveDb(db);

  return { changes, lastInsertRowid };
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDb();
  db.exec('BEGIN TRANSACTION;');
  try {
    const result = await fn();
    db.exec('COMMIT;');
    saveDb(db);
    return result;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
