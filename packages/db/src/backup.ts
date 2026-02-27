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
