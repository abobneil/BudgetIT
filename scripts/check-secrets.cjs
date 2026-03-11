#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");
const { execFileSync, spawn } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");
const args = new Set(process.argv.slice(2));
const scanStaged = args.has("--staged");
const scanWorkingTree = args.has("--working-tree") || (!scanStaged && !args.has("--outgoing") && !args.has("--all-history"));
const scanOutgoing = args.has("--outgoing");
const scanAllHistory = args.has("--all-history");

const maxFindings = 25;
const findings = [];

const blockedFileNamePatterns = [
  { label: "dotenv file", regex: /(^|\/)\.env(\..+)?$/i },
  { label: "private key file", regex: /(^|\/)(id_rsa|id_dsa|id_ecdsa|id_ed25519)$/i },
  { label: "key material file", regex: /\.(pem|key|p12|pfx|jks|keystore)$/i }
];

const secretPatterns = [
  { label: "private key header", regex: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/ },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { label: "GitHub token", regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/ },
  { label: "GitHub fine-grained token", regex: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/ },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { label: "Stripe key", regex: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { label: "Bearer token", regex: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i },
  {
    label: "credential-bearing URL",
    regex: /\b(?:https?|mongodb(?:\+srv)?|postgres(?:ql)?|mysql|amqps?|redis):\/\/[^/\s:@]+:[^@\s]+@/i
  },
  { label: "Slack webhook URL", regex: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]+/ },
  {
    label: "Discord webhook URL",
    regex: /https:\/\/(?:discord(?:app)?\.com)\/api\/webhooks\/[0-9]+\/[A-Za-z0-9._-]+/
  },
  {
    label: "hardcoded credential assignment",
    regex: /\b(?:password|passwd|pwd|secret|token|api[_-]?key|client[_-]?secret|access[_-]?key)\b\s*[:=]\s*["'`][^"'`\s]{8,}["'`]/
  },
  {
    label: "hardcoded webhook URL",
    regex: /\b(?:webhookUrl|teamsWebhookUrl)\b\s*[:=]\s*["'`]https?:\/\/[^"'`\s]+["'`]/
  }
];

const allowedLinePatterns = [
  /example\.(?:invalid|test|com)/i,
  /contoso\.example/i,
  /\$\{\{\s*secrets\.[A-Z0-9_]+\s*\}\}/i,
  /\$\{\{\s*github\.token\s*\}\}/i,
  /BEGIN CERTIFICATE/,
  /YOUR_[A-Z0-9_]+/,
  /<[^>]+>/
];

function runGit(argsToRun, options = {}) {
  const result = execFileSync("git", argsToRun, {
    cwd: repoRoot,
    encoding: options.encoding ?? "utf8",
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return result;
}

function runGitStream(argsToRun, onLine) {
  return new Promise((resolve, reject) => {
    const child = spawn("git", argsToRun, {
      cwd: repoRoot,
      stdio: ["ignore", "pipe", "pipe"]
    });
    let stderr = "";

    const lineReader = readline.createInterface({
      input: child.stdout,
      crlfDelay: Infinity
    });

    lineReader.on("line", onLine);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", (error) => {
      lineReader.close();
      reject(error);
    });

    child.on("close", (code) => {
      lineReader.close();
      if (code === 0) {
        resolve();
        return;
      }

      const detail = stderr.trim();
      reject(new Error(`git ${argsToRun.join(" ")} failed${detail ? `: ${detail}` : ""}`));
    });
  });
}

function isBinary(buffer) {
  return buffer.includes(0);
}

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function shouldIgnorePath(filePath) {
  return (
    filePath.startsWith("node_modules/") ||
    filePath.startsWith(".git/") ||
    filePath.startsWith("dist/") ||
    filePath.startsWith("build/") ||
    filePath.startsWith("coverage/")
  );
}

function isAllowedLine(line) {
  return allowedLinePatterns.some((pattern) => pattern.test(line));
}

function recordFinding(location, label, lineNumber, excerpt) {
  if (findings.length >= maxFindings) {
    return;
  }

  findings.push({
    location,
    label,
    lineNumber,
    excerpt: excerpt.trim().slice(0, 200)
  });
}

function scanPath(filePath, location) {
  for (const pattern of blockedFileNamePatterns) {
    if (pattern.regex.test(filePath)) {
      recordFinding(location, pattern.label, null, filePath);
    }
  }
}

function scanText(text, location) {
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || isAllowedLine(line)) {
      continue;
    }

    for (const pattern of secretPatterns) {
      if (pattern.regex.test(line)) {
        recordFinding(location, pattern.label, index + 1, line);
      }
    }
  }
}

function readTrackedFile(filePath) {
  const absolutePath = path.join(repoRoot, filePath);
  const buffer = fs.readFileSync(absolutePath);
  if (isBinary(buffer)) {
    return null;
  }
  return buffer.toString("utf8");
}

function getNullSeparatedGitOutput(argsToRun) {
  const output = runGit(argsToRun);
  return output
    .split("\0")
    .map((value) => normalizePath(value.trim()))
    .filter(Boolean);
}

function scanTrackedWorkingTree() {
  const files = getNullSeparatedGitOutput(["ls-files", "-z"]);
  for (const filePath of files) {
    if (shouldIgnorePath(filePath)) {
      continue;
    }

    scanPath(filePath, filePath);
    const text = readTrackedFile(filePath);
    if (text !== null) {
      scanText(text, filePath);
    }
  }
}

function scanStagedFiles() {
  const files = getNullSeparatedGitOutput(["diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z"]);
  for (const filePath of files) {
    if (shouldIgnorePath(filePath)) {
      continue;
    }

    scanPath(filePath, `staged:${filePath}`);
    const buffer = execFileSync("git", ["show", `:${filePath}`], {
      cwd: repoRoot,
      encoding: "buffer",
      maxBuffer: 32 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    });
    if (!isBinary(buffer)) {
      scanText(buffer.toString("utf8"), `staged:${filePath}`);
    }
  }
}

function resolveOutgoingRevisionRange() {
  try {
    const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"]).trim();
    return upstream ? `${upstream}..HEAD` : "HEAD";
  } catch {
    return "HEAD";
  }
}

function processHistoryLine(rawLine, state) {
  if (rawLine.startsWith("commit:")) {
    state.currentCommit = rawLine.slice("commit:".length);
    state.currentFile = null;
    return;
  }

  if (rawLine.startsWith("+++ b/")) {
    state.currentFile = normalizePath(rawLine.slice(6));
    scanPath(state.currentFile, `${state.currentCommit}:${state.currentFile}`);
    return;
  }

  if (rawLine.startsWith("+++ /dev/null")) {
    state.currentFile = null;
    return;
  }

  if (!state.currentFile || shouldIgnorePath(state.currentFile)) {
    return;
  }

  if (rawLine.startsWith("+") && !rawLine.startsWith("+++")) {
    scanText(rawLine.slice(1), `${state.currentCommit}:${state.currentFile}`);
  }
}

async function scanHistoryPatches(revisionArg) {
  const gitArgs = ["log", "--format=commit:%H", "--patch", "--unified=0", "--no-color"];
  if (revisionArg === "--all") {
    gitArgs.push("--all");
  } else {
    gitArgs.push(revisionArg);
  }

  const state = {
    currentCommit: "unknown",
    currentFile: null
  };

  await runGitStream(gitArgs, (rawLine) => {
    processHistoryLine(rawLine, state);
  });
}

async function main() {
  if (scanWorkingTree) {
    scanTrackedWorkingTree();
  }

  if (scanStaged) {
    scanStagedFiles();
  }

  if (scanOutgoing) {
    await scanHistoryPatches(resolveOutgoingRevisionRange());
  }

  if (scanAllHistory) {
    await scanHistoryPatches("--all");
  }

  if (findings.length > 0) {
    console.error("Potential secrets detected:");
    for (const finding of findings) {
      const lineText = finding.lineNumber ? `:${finding.lineNumber}` : "";
      console.error(`- ${finding.location}${lineText} [${finding.label}] ${finding.excerpt}`);
    }
    process.exit(1);
  }

  console.log("No secrets detected.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
