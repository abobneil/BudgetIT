import fs from "node:fs";
import path from "node:path";

import { DEFAULT_RUNTIME_SETTINGS, mergeRuntimeSettings, type RuntimeSettings } from "./lifecycle";

export function readRuntimeSettings(filePath: string): RuntimeSettings {
  if (!fs.existsSync(filePath)) {
    return DEFAULT_RUNTIME_SETTINGS;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<RuntimeSettings>;
  return mergeRuntimeSettings(DEFAULT_RUNTIME_SETTINGS, parsed);
}

export function writeRuntimeSettings(filePath: string, settings: RuntimeSettings): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), "utf8");
}

