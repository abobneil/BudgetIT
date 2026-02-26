import fs from "node:fs";
import path from "node:path";

import type Database from "better-sqlite3-multiple-ciphers";

const MIGRATIONS_TABLE = "schema_migrations";

export function resolveDefaultMigrationsDir(): string {
  return path.resolve(__dirname, "../migrations");
}

function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function listMigrationFiles(migrationsDir: string): string[] {
  return fs
    .readdirSync(migrationsDir)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function getAppliedMigrationSet(db: Database.Database): Set<string> {
  const rows = db
    .prepare(`SELECT file_name FROM ${MIGRATIONS_TABLE} ORDER BY file_name`)
    .all() as Array<{ file_name: string }>;
  return new Set(rows.map((row) => row.file_name));
}

export function runMigrations(
  db: Database.Database,
  migrationsDir: string = resolveDefaultMigrationsDir()
): string[] {
  ensureMigrationsTable(db);
  const applied = getAppliedMigrationSet(db);
  const migrationFiles = listMigrationFiles(migrationsDir);
  const newlyApplied: string[] = [];

  for (const fileName of migrationFiles) {
    if (applied.has(fileName)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), "utf8");
    const apply = db.transaction(() => {
      db.exec(sql);
      db.prepare(`INSERT INTO ${MIGRATIONS_TABLE} (file_name) VALUES (?)`).run(fileName);
    });

    apply();
    newlyApplied.push(fileName);
  }

  return newlyApplied;
}

