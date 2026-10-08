// Base SQLite intégrée à Node (node:sqlite) : aucune dépendance native à compiler.
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  logo TEXT,
  brand_color TEXT,
  currency TEXT NOT NULL DEFAULT 'FCFA',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS licences (
  id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  max_users INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  customer TEXT,
  licence_key TEXT NOT NULL,
  tenant_id TEXT UNIQUE REFERENCES tenants(id),
  created_at TEXT NOT NULL,
  activated_at TEXT
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  tenant_id TEXT REFERENCES tenants(id),
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  title TEXT,
  color TEXT,
  pass_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS users_tenant ON users(tenant_id);
CREATE TABLE IF NOT EXISTS records (
  tenant_id TEXT NOT NULL,
  col TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (tenant_id, col, id)
);
CREATE INDEX IF NOT EXISTS records_seq ON records(tenant_id, seq);
CREATE TABLE IF NOT EXISTS counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL);
`;

export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

export function nextSeq(db) {
  db.prepare("INSERT INTO counters(name, value) VALUES ('seq', 0) ON CONFLICT(name) DO NOTHING").run();
  db.prepare("UPDATE counters SET value = value + 1 WHERE name = 'seq'").run();
  return db.prepare("SELECT value FROM counters WHERE name = 'seq'").get().value;
}

export function tx(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
