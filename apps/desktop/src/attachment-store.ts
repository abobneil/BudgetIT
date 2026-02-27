import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const FILE_MAGIC = Buffer.from("BATT1");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export type AttachmentStore = {
  writeAttachment: (input: {
    entityType: string;
    entityId: string;
    fileName: string;
    content: Buffer;
  }) => {
    filePath: string;
    contentSha256: string;
  };
  readAttachment: (filePath: string) => Buffer;
};

function resolveCipherKey(keyHex: string | null): Buffer {
  if (!keyHex) {
    throw new Error("Attachment access denied without active DB key context.");
  }
  const key = Buffer.from(keyHex, "hex");
  if (key.length < 32) {
    throw new Error("Attachment access denied without active DB key context.");
  }
  return key.subarray(0, 32);
}

function encryptWithKey(content: Buffer, key: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(content), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([FILE_MAGIC, iv, tag, encrypted]);
}

function decryptWithKey(payload: Buffer, key: Buffer): Buffer {
  if (payload.length < FILE_MAGIC.length + IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("Attachment payload is invalid.");
  }
  if (!payload.subarray(0, FILE_MAGIC.length).equals(FILE_MAGIC)) {
    throw new Error("Attachment payload is invalid.");
  }

  const ivStart = FILE_MAGIC.length;
  const tagStart = ivStart + IV_LENGTH;
  const contentStart = tagStart + AUTH_TAG_LENGTH;
  const iv = payload.subarray(ivStart, tagStart);
  const tag = payload.subarray(tagStart, contentStart);
  const encrypted = payload.subarray(contentStart);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^\w.-]/g, "_");
}

export function createAttachmentStore(
  baseDir: string,
  getActiveDbKeyHex: () => string | null
): AttachmentStore {
  return {
    writeAttachment: (input) => {
      const key = resolveCipherKey(getActiveDbKeyHex());
      const encrypted = encryptWithKey(input.content, key);
      const contentSha256 = crypto.createHash("sha256").update(input.content).digest("hex");

      const entityDir = path.join(baseDir, input.entityType, input.entityId);
      fs.mkdirSync(entityDir, { recursive: true });
      const safeName = sanitizeFileName(input.fileName);
      const filePath = path.join(entityDir, `${crypto.randomUUID()}-${safeName}.enc`);
      fs.writeFileSync(filePath, encrypted);

      return {
        filePath,
        contentSha256
      };
    },
    readAttachment: (filePath) => {
      const key = resolveCipherKey(getActiveDbKeyHex());
      const payload = fs.readFileSync(filePath);
      return decryptWithKey(payload, key);
    }
  };
}
