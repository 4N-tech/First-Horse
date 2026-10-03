import fs from 'node:fs';
import path from 'node:path';
import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import { getSeedSql } from './seed.ts';

let dbInstance: SqlJsDatabase | null = null;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'factory.db');

function runMigrations(db: SqlJsDatabase) {
  try {
    db.run("ALTER TABLE products ADD COLUMN additional_images TEXT DEFAULT '[]';");
  } catch (e) {
    // Column already exists
  }
  try {
    db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_product_size_color ON product_variants(product_id, size, color);");
  } catch (e) {
    // Index already exists
  }
  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        old_status TEXT,
        new_status TEXT NOT NULL,
        changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        note TEXT,
        is_override INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_status_hist_order ON order_status_history(order_id);

      CREATE TABLE IF NOT EXISTS order_assignment_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        previous_employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        new_employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_assign_hist_order ON order_assignment_history(order_id);

      CREATE TABLE IF NOT EXISTS activity_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id INTEGER,
        metadata TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_activity_logs_actor ON activity_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at);

      CREATE TABLE IF NOT EXISTS internal_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'INFO',
        entity_type TEXT,
        entity_id INTEGER,
        is_read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON internal_notifications(user_id);
    `);
  } catch (e) {
    console.error('Error running Phase 4 migrations:', e);
  }

  // Phase 5 Migrations: Inventory Ledger & Threshold
  try {
    db.run("ALTER TABLE product_variants ADD COLUMN low_stock_threshold INTEGER NOT NULL DEFAULT 10;");
  } catch (e) {
    // Column already exists
  }

  try {
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory_movements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        variant_id INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
        movement_type TEXT NOT NULL,
        quantity_delta INTEGER NOT NULL,
        stock_before INTEGER NOT NULL,
        stock_after INTEGER NOT NULL,
        reference_type TEXT,
        reference_id INTEGER,
        note TEXT,
        created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_variants_low_stock ON product_variants(low_stock_threshold);
      CREATE INDEX IF NOT EXISTS idx_inv_movements_variant ON inventory_movements(variant_id);
      CREATE INDEX IF NOT EXISTS idx_inv_movements_created ON inventory_movements(created_at);
      CREATE INDEX IF NOT EXISTS idx_inv_movements_type ON inventory_movements(movement_type);
      CREATE INDEX IF NOT EXISTS idx_inv_movements_ref ON inventory_movements(reference_type, reference_id);
    `);
  } catch (e) {
    console.error('Error running Phase 5 migrations:', e);
  }
}

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
      runMigrations(dbInstance);
      saveDb(dbInstance);
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

  runMigrations(dbInstance);

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

let transactionDepth = 0;

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

  if (transactionDepth === 0) {
    saveDb(db);
  }

  return { changes, lastInsertRowid };
}

export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const db = await getDb();
  transactionDepth++;
  if (transactionDepth === 1) {
    db.exec('BEGIN TRANSACTION;');
  }
  try {
    const result = await fn();
    if (transactionDepth === 1) {
      db.exec('COMMIT;');
      saveDb(db);
    }
    return result;
  } catch (err: any) {
    if (transactionDepth === 1) {
      try {
        db.exec('ROLLBACK;');
      } catch (e) {
        // SQLite may have already rolled back
      }
    }
    console.error('Transaction error:', err);
    throw err;
  } finally {
    transactionDepth--;
  }
}
