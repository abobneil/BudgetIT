import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createAttachmentStore } from "./attachment-store";

const tempRoots: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-attachment-"));
  tempRoots.push(dir);
  return dir;
}

describe("attachment store", () => {
  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it("denies attachment reads without an active DB key context", () => {
    const baseDir = createTempDir();
    let activeDbKeyHex: string | null = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const store = createAttachmentStore(baseDir, () => activeDbKeyHex);

    const content = Buffer.from("replacement scorecard attachment");
    const written = store.writeAttachment({
      entityType: "service_plan",
      entityId: "plan-1",
      fileName: "scorecard.txt",
      content
    });

    activeDbKeyHex = null;
    expect(() => store.readAttachment(written.filePath)).toThrow(
      /Attachment access denied without active DB key context/
    );

    activeDbKeyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const decrypted = store.readAttachment(written.filePath);
    expect(decrypted.equals(content)).toBe(true);
  });
});
