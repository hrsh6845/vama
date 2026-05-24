import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'invoices.db');

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Compatibility wrapper: makes sql.js look like better-sqlite3
// so all route files work unchanged
class DatabaseWrapper {
  constructor(sqlDb, dbPath) {
    this._db = sqlDb;
    this._dbPath = dbPath;
    this._inTransaction = false;
  }

  _save() {
    // Don't save to disk mid-transaction — wait for commit
    if (this._inTransaction) return;
    const data = this._db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this._dbPath, buffer);
  }

  _rowsToObjects(stmt) {
    const cols = stmt.getColumnNames();
    const results = [];
    while (stmt.step()) {
      const row = stmt.get();
      const obj = {};
      cols.forEach((col, i) => { obj[col] = row[i]; });
      results.push(obj);
    }
    stmt.free();
    return results;
  }

  // sql.js exec() handles multi-statement SQL strings
  exec(sql) {
    this._db.exec(sql);
    this._save();
  }

  pragma(str) {
    try { this._db.exec(`PRAGMA ${str}`); } catch (e) { /* ignore unsupported pragmas */ }
  }

  prepare(sql) {
    const self = this;
    return {
      all(...params) {
        const stmt = self._db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const results = self._rowsToObjects(stmt);
        return results;
      },
      get(...params) {
        const stmt = self._db.prepare(sql);
        if (params.length > 0) stmt.bind(params);
        const cols = stmt.getColumnNames();
        if (stmt.step()) {
          const row = stmt.get();
          const obj = {};
          cols.forEach((col, i) => { obj[col] = row[i]; });
          stmt.free();
          return obj;
        }
        stmt.free();
        return undefined;
      },
      run(...params) {
        self._db.run(sql, params);
        self._save();
        return { changes: self._db.getRowsModified() };
      },
    };
  }

  transaction(fn) {
    const self = this;
    return function (...args) {
      self._inTransaction = true;
      self._db.exec('BEGIN TRANSACTION');
      try {
        const result = fn(...args);
        self._db.exec('COMMIT');
        self._inTransaction = false;
        self._save();
        return result;
      } catch (e) {
        try { self._db.exec('ROLLBACK'); } catch (_) {}
        self._inTransaction = false;
        throw e;
      }
    };
  }
}

// Initialize sql.js and load/create database
const SQL = await initSqlJs();

let sqlDb;
if (fs.existsSync(DB_PATH)) {
  const fileBuffer = fs.readFileSync(DB_PATH);
  sqlDb = new SQL.Database(fileBuffer);
} else {
  sqlDb = new SQL.Database();
}

const db = new DatabaseWrapper(sqlDb, DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    whatsapp TEXT,
    company TEXT,
    address TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT UNIQUE NOT NULL,
    client_id TEXT NOT NULL,
    status TEXT DEFAULT 'draft' CHECK(status IN ('draft','sent','viewed','partial','paid','overdue','cancelled')),
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    subtotal REAL DEFAULT 0,
    tax_rate REAL DEFAULT 0,
    tax_amount REAL DEFAULT 0,
    total REAL DEFAULT 0,
    amount_paid REAL DEFAULT 0,
    balance_due REAL DEFAULT 0,
    notes TEXT,
    share_token TEXT UNIQUE,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    description TEXT NOT NULL,
    quantity REAL DEFAULT 1,
    unit_price REAL NOT NULL,
    amount REAL NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL,
    amount REAL NOT NULL,
    payment_date TEXT NOT NULL,
    method TEXT CHECK(method IN ('bank_transfer','cash','check','paypal','stripe','other')),
    reference TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (invoice_id) REFERENCES invoices(id)
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
  CREATE INDEX IF NOT EXISTS idx_invoices_share_token ON invoices(share_token);
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
`);

export default db;
