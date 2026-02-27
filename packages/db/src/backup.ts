import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { openEncryptedDatabase } from "./encrypted-db";

export type BackupDestinationKind = "local_or_external" | "network";

export type BackupManifest = {
  manifestVersion: 1;
  createdAt: string;
  sourceDbFile: string;
  backupFile: string;
  sourceLastMutationAt: string;
  schemaVersion: number;
  checksumSha256: string;
  checksumAlgorithm: "sha256";
  destinationKind: BackupDestinationKind;
};

export type CreateEncryptedBackupInput = {
  sourceDbPath: string;
  dbKeyHex: string;
  destinationDir: string;
  filePrefix?: string;
  now?: Date;
};

export type CreateEncryptedBackupResult = {
  backupPath: string;
  manifestPath: string;
  manifest: BackupManifest;
};

export type BackupIntegrityResult = {
  schemaVersion: number;
  sourceLastMutationAt: string;
};

export type RestoreEncryptedBackupInput = {
  backupPath: string;
  manifestPath: string;
  targetDbPath: string;
  dbKeyHex: string;
  currentSchemaVersion?: number;
  restoredAt?: Date;
};

export type RestoreEncryptedBackupResult = {
  backupPath: string;
  manifestPath: string;
  targetDbPath: string;
  restoredAt: string;
  sourceLastMutationAt: string;
  schemaVersion: number;
};

function toTimestampToken(now: Date): string {
  const iso = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  return iso.replace(/[:-]/g, "").replace("T", "-").replace("Z", "");
}

function assertNonEmptyPath(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new Error(`${label} is required.`);
  }
}

function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

export function classifyBackupDestination(destinationDir: string): BackupDestinationKind {
  const normalized = destinationDir.trim();
  if (normalized.startsWith("\\\\")) {
    return "network";
  }
  return "local_or_external";
}

export function computeFileSha256(filePath: string): string {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

export function preflightBackupDestination(destinationDir: string): BackupDestinationKind {
  assertNonEmptyPath(destinationDir, "Backup destination");

  const resolved = path.resolve(destinationDir);
  const destinationKind = classifyBackupDestination(resolved);

  try {
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      if (!stat.isDirectory()) {
        throw new Error("Target path exists but is not a directory.");
      }
    } else {
      fs.mkdirSync(resolved, { recursive: true });
    }

    const probePath = path.join(resolved, `.budgetit-backup-probe-${crypto.randomUUID()}.tmp`);
    fs.writeFileSync(probePath, "ok", "utf8");
    fs.rmSync(probePath, { force: true });
    return destinationKind;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Backup destination preflight failed for ${resolved}. Ensure local/network/external target is mounted and writable. ${detail}`
    );
  }
}

export function readBackupManifest(manifestPath: string): BackupManifest {
  assertNonEmptyPath(manifestPath, "Manifest path");
  const parsed = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Partial<BackupManifest>;
  if (
    parsed.manifestVersion !== 1 ||
    typeof parsed.backupFile !== "string" ||
    typeof parsed.sourceLastMutationAt !== "string" ||
    typeof parsed.schemaVersion !== "number" ||
    typeof parsed.checksumSha256 !== "string"
  ) {
    throw new Error(`Invalid backup manifest: ${manifestPath}`);
  }

  return parsed as BackupManifest;
}

export function verifyEncryptedBackup(
  backupPath: string,
  dbKeyHex: string,
  expectedChecksumSha256?: string
): BackupIntegrityResult {
  assertNonEmptyPath(backupPath, "Backup path");
  assertNonEmptyPath(dbKeyHex, "Database key");

  if (expectedChecksumSha256) {
    const actual = computeFileSha256(backupPath);
    if (actual !== expectedChecksumSha256) {
      throw new Error("Backup checksum mismatch; restore is blocked.");
    }
  }

  let backupDb;
  try {
    backupDb = openEncryptedDatabase(backupPath, dbKeyHex);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Backup open failed during verification. ${detail}`);
  }

  try {
    const integrity = backupDb.pragma("integrity_check", { simple: true }) as string;
    if (integrity.toLowerCase() !== "ok") {
      throw new Error(`Backup integrity check failed: ${integrity}`);
    }

    const meta = backupDb
      .prepare("SELECT schema_version, last_mutation_at FROM meta WHERE id = 1")
      .get() as { schema_version: number; last_mutation_at: string } | undefined;
    if (!meta) {
      throw new Error("Backup meta row missing.");
    }

    return {
      schemaVersion: meta.schema_version,
      sourceLastMutationAt: meta.last_mutation_at
    };
  } finally {
    backupDb.close();
  }
}

function readCurrentSchemaVersion(targetDbPath: string, dbKeyHex: string): number {
  if (!fs.existsSync(targetDbPath)) {
    return 0;
  }

  let currentDb;
  try {
    currentDb = openEncryptedDatabase(targetDbPath, dbKeyHex);
  } catch {
    return 0;
  }

  try {
    const row = currentDb
      .prepare("SELECT schema_version FROM meta WHERE id = 1")
      .get() as { schema_version: number } | undefined;
    return row?.schema_version ?? 0;
  } finally {
    currentDb.close();
  }
}

export async function createEncryptedBackup(
  input: CreateEncryptedBackupInput
): Promise<CreateEncryptedBackupResult> {
  assertNonEmptyPath(input.sourceDbPath, "Source database path");
  assertNonEmptyPath(input.dbKeyHex, "Database key");

  const now = input.now ?? new Date();
  const destinationKind = preflightBackupDestination(input.destinationDir);
  const destinationDir = path.resolve(input.destinationDir);
  const filePrefix = input.filePrefix?.trim() || "budgetit-backup";
  const token = toTimestampToken(now);

  const backupFileName = `${filePrefix}-${token}.db`;
  const manifestFileName = `${filePrefix}-${token}.manifest.json`;
  const backupPath = path.join(destinationDir, backupFileName);
  const manifestPath = path.join(destinationDir, manifestFileName);

  const source = openEncryptedDatabase(input.sourceDbPath, input.dbKeyHex);
  try {
    source.pragma("wal_checkpoint(TRUNCATE)");

    const meta = source
      .prepare("SELECT schema_version, last_mutation_at FROM meta WHERE id = 1")
      .get() as { schema_version: number; last_mutation_at: string } | undefined;

    if (!meta) {
      throw new Error("Meta row was not found; cannot build backup manifest.");
    }

    const escapedBackupPath = escapeSqlString(backupPath);
    source.exec(`VACUUM INTO '${escapedBackupPath}';`);
    const checksumSha256 = computeFileSha256(backupPath);

    const manifest: BackupManifest = {
      manifestVersion: 1,
      createdAt: now.toISOString(),
      sourceDbFile: path.basename(input.sourceDbPath),
      backupFile: backupFileName,
      sourceLastMutationAt: meta.last_mutation_at,
      schemaVersion: meta.schema_version,
      checksumSha256,
      checksumAlgorithm: "sha256",
      destinationKind
    };

    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    return {
      backupPath,
      manifestPath,
      manifest
    };
  } finally {
    source.close();
  }
}

export async function restoreEncryptedBackup(
  input: RestoreEncryptedBackupInput
): Promise<RestoreEncryptedBackupResult> {
  assertNonEmptyPath(input.backupPath, "Backup path");
  assertNonEmptyPath(input.manifestPath, "Manifest path");
  assertNonEmptyPath(input.targetDbPath, "Target database path");
  assertNonEmptyPath(input.dbKeyHex, "Database key");

  const manifest = readBackupManifest(input.manifestPath);
  const integrity = verifyEncryptedBackup(
    input.backupPath,
    input.dbKeyHex,
    manifest.checksumSha256
  );

  if (integrity.schemaVersion !== manifest.schemaVersion) {
    throw new Error(
      `Backup schema mismatch: manifest=${manifest.schemaVersion}, backup=${integrity.schemaVersion}`
    );
  }

  const currentSchemaVersion =
    typeof input.currentSchemaVersion === "number"
      ? input.currentSchemaVersion
      : readCurrentSchemaVersion(input.targetDbPath, input.dbKeyHex);

  if (currentSchemaVersion > 0 && integrity.schemaVersion > currentSchemaVersion) {
    throw new Error(
      `Backup schema ${integrity.schemaVersion} is newer than app schema ${currentSchemaVersion}. Restore blocked.`
    );
  }

  const tempRestorePath = `${input.targetDbPath}.restore-${crypto.randomUUID()}.tmp`;
  fs.copyFileSync(input.backupPath, tempRestorePath);
  fs.rmSync(input.targetDbPath, { force: true });
  fs.renameSync(tempRestorePath, input.targetDbPath);
  fs.rmSync(`${input.targetDbPath}-wal`, { force: true });
  fs.rmSync(`${input.targetDbPath}-shm`, { force: true });

  return {
    backupPath: input.backupPath,
    manifestPath: input.manifestPath,
    targetDbPath: input.targetDbPath,
    restoredAt: (input.restoredAt ?? new Date()).toISOString(),
    sourceLastMutationAt: manifest.sourceLastMutationAt,
    schemaVersion: integrity.schemaVersion
  };
}
