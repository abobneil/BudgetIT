import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type StoredSecretPayload = {
  version: 1;
  encryptedBase64: string;
};

export interface SecretCipher {
  isAvailable: () => boolean;
  encrypt: (value: string) => Buffer;
  decrypt: (value: Buffer) => string;
}

export class FileSecretVault {
  constructor(
    private readonly secretPath: string,
    private readonly cipher: SecretCipher
  ) {}

  hasSecret(): boolean {
    return fs.existsSync(this.secretPath);
  }

  readSecret(): string | null {
    if (!this.hasSecret()) {
      return null;
    }

    const payload = JSON.parse(fs.readFileSync(this.secretPath, "utf8")) as StoredSecretPayload;
    const encrypted = Buffer.from(payload.encryptedBase64, "base64");
    return this.cipher.decrypt(encrypted);
  }

  writeSecret(secret: string): void {
    if (!this.cipher.isAvailable()) {
      throw new Error("Secure storage is unavailable.");
    }

    fs.mkdirSync(path.dirname(this.secretPath), { recursive: true });
    const encrypted = this.cipher.encrypt(secret);
    const payload: StoredSecretPayload = {
      version: 1,
      encryptedBase64: encrypted.toString("base64")
    };
    fs.writeFileSync(this.secretPath, JSON.stringify(payload, null, 2), "utf8");
  }
}

export function resolveDatabaseKey(vault: FileSecretVault): string {
  const existing = vault.readSecret();
  if (existing) {
    return existing;
  }

  const generated = crypto.randomBytes(32).toString("hex");
  vault.writeSecret(generated);
  return generated;
}

export function exportRecoveryKey(filePath: string, keyHex: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${keyHex}\n`, { encoding: "utf8", mode: 0o600 });
}

export function importRecoveryKey(filePath: string): string {
  const keyHex = fs.readFileSync(filePath, "utf8").trim();
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error("Invalid recovery key format.");
  }
  return keyHex.toLowerCase();
}
