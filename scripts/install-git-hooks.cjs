#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const gitDir = path.join(repoRoot, ".git");
const hooksPath = ".githooks";
const hookFiles = ["pre-commit", "pre-push"];

if (!fs.existsSync(gitDir)) {
  process.exit(0);
}

try {
  execFileSync("git", ["config", "core.hooksPath", hooksPath], {
    cwd: repoRoot,
    stdio: "ignore"
  });

  for (const hookFile of hookFiles) {
    const hookPath = path.join(repoRoot, hooksPath, hookFile);
    if (fs.existsSync(hookPath)) {
      fs.chmodSync(hookPath, 0o755);
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`Failed to install git hooks: ${message}`);
  process.exitCode = 1;
}
