import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  exportRecoveryKey,
  FileSecretVault,
  importRecoveryKey,
  resolveDatabaseKey,
  type SecretCipher
} from "./key-vault";

const tempRoots: string[] = [];

function createTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-vault-"));
  tempRoots.push(root);
  return root;
}

function createFakeCipher(): SecretCipher {
  return {
    isAvailable: () => true,
    encrypt: (value) => Buffer.from(`enc:${value}`, "utf8"),
    decrypt: (value) => {
      const decoded = value.toString("utf8");
      return decoded.replace(/^enc:/, "");
    }
  };
}

describe("secure key vault", () => {
  afterEach(() => {
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("reopens with the same key without re-prompting", () => {
    const root = createTempRoot();
    const secretPath = path.join(root, "db-key.json");
    const cipher = createFakeCipher();

    const firstVault = new FileSecretVault(secretPath, cipher);
    const firstKey = resolveDatabaseKey(firstVault);

    const secondVault = new FileSecretVault(secretPath, cipher);
    const secondKey = resolveDatabaseKey(secondVault);
    expect(secondKey).toBe(firstKey);
  });

  it("imports recovery key and stores it for future unlocks", () => {
    const root = createTempRoot();
    const recoveryPath = path.join(root, "recovery.key");
    const secretPath = path.join(root, "db-key.json");
    const cipher = createFakeCipher();
    const sourceKey = "b".repeat(64);

    exportRecoveryKey(recoveryPath, sourceKey);
    const imported = importRecoveryKey(recoveryPath);
    expect(imported).toBe(sourceKey);

    const vault = new FileSecretVault(secretPath, cipher);
    vault.writeSecret(imported);
    expect(vault.readSecret()).toBe(sourceKey);
  });
});

