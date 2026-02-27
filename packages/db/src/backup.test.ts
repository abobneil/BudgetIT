import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  computeFileSha256,
  createEncryptedBackup,
  preflightBackupDestination,
  restoreEncryptedBackup
} from "./backup";
import { bootstrapEncryptedDatabase, openEncryptedDatabase } from "./encrypted-db";
import { runMigrations } from "./migrations";

const tempRoots: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempRoots.push(dir);
  return dir;
}

describe("encrypted backup creation", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("creates encrypted backup that reopens with app key and expected schema", async () => {
    const dataDir = createTempDir("budgetit-backup-source-");
    const backupDir = createTempDir("budgetit-backup-target-");
    const boot = bootstrapEncryptedDatabase(dataDir);
    runMigrations(boot.db);
    boot.db
      .prepare(
        `
          INSERT INTO vendor (id, name, website, notes, created_at, updated_at, deleted_at)
          VALUES ('vendor-1', 'Backup Fixture Vendor', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run();
    boot.db.close();

    const result = await createEncryptedBackup({
      sourceDbPath: boot.dbPath,
      dbKeyHex: boot.keyHex,
      destinationDir: backupDir,
      now: new Date("2026-03-20T08:00:00.000Z")
    });

    const reopened = openEncryptedDatabase(result.backupPath, boot.keyHex);
    try {
      const meta = reopened
        .prepare("SELECT schema_version, last_mutation_at FROM meta WHERE id = 1")
        .get() as { schema_version: number; last_mutation_at: string };
      expect(meta.schema_version).toBeGreaterThanOrEqual(1);
      expect(meta.last_mutation_at.length).toBeGreaterThan(0);

      const vendorCount = reopened
        .prepare("SELECT COUNT(*) AS total FROM vendor")
        .get() as { total: number };
      expect(vendorCount.total).toBe(1);
    } finally {
      reopened.close();
    }
  });

  it("writes manifest checksum that matches computed backup file hash", async () => {
    const dataDir = createTempDir("budgetit-backup-source-");
    const backupDir = createTempDir("budgetit-backup-target-");
    const boot = bootstrapEncryptedDatabase(dataDir);
    runMigrations(boot.db);
    boot.db.close();

    const result = await createEncryptedBackup({
      sourceDbPath: boot.dbPath,
      dbKeyHex: boot.keyHex,
      destinationDir: backupDir,
      now: new Date("2026-03-20T09:00:00.000Z")
    });

    const manifestFromDisk = JSON.parse(fs.readFileSync(result.manifestPath, "utf8")) as {
      checksumSha256: string;
    };
    expect(manifestFromDisk.checksumSha256).toBe(computeFileSha256(result.backupPath));
    expect(result.manifest.checksumSha256).toBe(manifestFromDisk.checksumSha256);
  });

  it("returns actionable preflight error for unreachable target path", async () => {
    const dataDir = createTempDir("budgetit-backup-source-");
    const blockedRoot = createTempDir("budgetit-backup-blocked-");
    const blockedPath = path.join(blockedRoot, "not-a-directory.txt");
    fs.writeFileSync(blockedPath, "blocked", "utf8");

    const boot = bootstrapEncryptedDatabase(dataDir);
    runMigrations(boot.db);
    boot.db.close();

    expect(() => preflightBackupDestination(blockedPath)).toThrow(
      "Ensure local/network/external target is mounted and writable."
    );

    await expect(
      createEncryptedBackup({
        sourceDbPath: boot.dbPath,
        dbKeyHex: boot.keyHex,
        destinationDir: blockedPath
      })
    ).rejects.toThrow("Backup destination preflight failed");
  });

  it("restores valid backup and reproduces fixture dataset", async () => {
    const sourceDataDir = createTempDir("budgetit-restore-source-");
    const targetDataDir = createTempDir("budgetit-restore-target-");
    const backupDir = createTempDir("budgetit-restore-backups-");

    const source = bootstrapEncryptedDatabase(sourceDataDir);
    runMigrations(source.db);
    source.db
      .prepare(
        `
          INSERT INTO vendor (id, name, website, notes, created_at, updated_at, deleted_at)
          VALUES ('vendor-source', 'Restored Vendor', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run();
    source.db.close();

    const backupResult = await createEncryptedBackup({
      sourceDbPath: source.dbPath,
      dbKeyHex: source.keyHex,
      destinationDir: backupDir,
      now: new Date("2026-03-20T10:00:00.000Z")
    });

    const target = bootstrapEncryptedDatabase(targetDataDir, source.keyHex);
    runMigrations(target.db);
    target.db
      .prepare(
        `
          INSERT INTO vendor (id, name, website, notes, created_at, updated_at, deleted_at)
          VALUES ('vendor-target', 'Target Vendor', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, NULL)
        `
      )
      .run();
    target.db.close();

    const restoreResult = await restoreEncryptedBackup({
      backupPath: backupResult.backupPath,
      manifestPath: backupResult.manifestPath,
      targetDbPath: target.dbPath,
      dbKeyHex: source.keyHex
    });

    expect(restoreResult.sourceLastMutationAt).toBe(backupResult.manifest.sourceLastMutationAt);
    expect(restoreResult.schemaVersion).toBe(backupResult.manifest.schemaVersion);

    const reopened = openEncryptedDatabase(target.dbPath, source.keyHex);
    try {
      const vendors = reopened
        .prepare("SELECT id, name FROM vendor ORDER BY id")
        .all() as Array<{ id: string; name: string }>;
      expect(vendors).toEqual([{ id: "vendor-source", name: "Restored Vendor" }]);
    } finally {
      reopened.close();
    }
  });

  it("blocks restore when backup checksum/integrity validation fails", async () => {
    const dataDir = createTempDir("budgetit-restore-source-");
    const targetDataDir = createTempDir("budgetit-restore-target-");
    const backupDir = createTempDir("budgetit-restore-backups-");

    const source = bootstrapEncryptedDatabase(dataDir);
    runMigrations(source.db);
    source.db.close();

    const backupResult = await createEncryptedBackup({
      sourceDbPath: source.dbPath,
      dbKeyHex: source.keyHex,
      destinationDir: backupDir,
      now: new Date("2026-03-20T11:00:00.000Z")
    });

    const target = bootstrapEncryptedDatabase(targetDataDir, source.keyHex);
    runMigrations(target.db);
    target.db.close();

    const fileHandle = fs.openSync(backupResult.backupPath, "r+");
    try {
      fs.writeSync(fileHandle, Buffer.from("CORRUPTED"), 0, 8, 0);
    } finally {
      fs.closeSync(fileHandle);
    }

    await expect(
      restoreEncryptedBackup({
        backupPath: backupResult.backupPath,
        manifestPath: backupResult.manifestPath,
        targetDbPath: target.dbPath,
        dbKeyHex: source.keyHex
      })
    ).rejects.toThrow("Backup checksum mismatch");
  });
});
