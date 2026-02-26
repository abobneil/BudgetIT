import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3-multiple-ciphers";

const DB_FILE_NAME = "budgetit.db";
const BOOTSTRAP_MARKER_KEY = "bootstrap_marker";
const BOOTSTRAP_MARKER_VALUE = "ok";

export interface BootstrapEncryptedDatabaseResult {
  db: Database.Database;
  keyHex: string;
  dbPath: string;
  created: boolean;
}

export function generateDatabaseKeyHex(): string {
  return crypto.randomBytes(32).toString("hex");
}

function setEncryptionKey(db: Database.Database, keyHex: string): void {
  db.pragma("cipher = 'sqlcipher'");
  db.pragma(`key = \"x'${keyHex}'\"`);
}

function applyOperationalPragmas(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
}

function ensureBootstrapMarker(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS budgetit_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  db.prepare(
    `
      INSERT INTO budgetit_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `
  ).run(BOOTSTRAP_MARKER_KEY, BOOTSTRAP_MARKER_VALUE);
}

function verifyBootstrapMarker(db: Database.Database): void {
  const row = db
    .prepare("SELECT value FROM budgetit_meta WHERE key = ?")
    .get(BOOTSTRAP_MARKER_KEY) as { value?: string } | undefined;

  if (!row || row.value !== BOOTSTRAP_MARKER_VALUE) {
    throw new Error("Encrypted database validation failed: marker is missing.");
  }
}

export function openEncryptedDatabase(dbPath: string, keyHex: string): Database.Database {
  const db = new Database(dbPath);
  try {
    setEncryptionKey(db, keyHex);
    applyOperationalPragmas(db);
    return db;
  } catch (error) {
    try {
      db.close();
    } catch {
      // Ignore close errors while surfacing the original open failure.
    }
    throw error;
  }
}

export function rekeyEncryptedDatabase(
  dbPath: string,
  currentKeyHex: string,
  newKeyHex: string
): void {
  const db = openEncryptedDatabase(dbPath, currentKeyHex);
  try {
    db.pragma("journal_mode = DELETE");
    db.pragma(`rekey = \"x'${newKeyHex}'\"`);
    applyOperationalPragmas(db);
    verifyBootstrapMarker(db);
  } finally {
    db.close();
  }
}

export function bootstrapEncryptedDatabase(
  dataDir: string,
  keyHex: string = generateDatabaseKeyHex()
): BootstrapEncryptedDatabaseResult {
  fs.mkdirSync(dataDir, { recursive: true });

  const dbPath = path.join(dataDir, DB_FILE_NAME);
  const dbAlreadyExists = fs.existsSync(dbPath);

  const db = openEncryptedDatabase(dbPath, keyHex);

  if (dbAlreadyExists) {
    verifyBootstrapMarker(db);
  } else {
    ensureBootstrapMarker(db);
  }

  return {
    db,
    keyHex,
    dbPath,
    created: !dbAlreadyExists
  };
}
