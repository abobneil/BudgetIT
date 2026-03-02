const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT_DIR = process.cwd();
const VERIFICATION_DIR = path.join(ROOT_DIR, "docs", "help", "verification");
const REQUIREMENTS_PATH = path.join(VERIFICATION_DIR, "verification-requirements.json");
const REPORT_PATH = path.join(VERIFICATION_DIR, "verification-report.md");
const RESULTS_PATH = path.join(VERIFICATION_DIR, "verification-results.json");
const REOPEN_CANDIDATES_PATH = path.join(VERIFICATION_DIR, "reopen-candidates.json");
const GITHUB_STATE_PATH = path.join(VERIFICATION_DIR, "github-state.json");

const REQUIRED_EVIDENCE_FILES = [
  "apps/renderer/src/features/help/help-topics.ts",
  "docs/help-system.md",
  "package.json",
  ".github/workflows/ci.yml",
  "docs/ci-cd.md"
];

const REQUIRED_HELP_LABELS = [
  "area:help-center",
  "phase:1",
  "phase:2",
  "phase:3",
  "phase:4",
  "phase:5",
  "phase:6",
  "phase:7",
  "type:epic",
  "type:feature",
  "type:qa",
  "type:chore",
  "priority:p1",
  "priority:p2",
  "north-star"
];

const REQUIRED_MILESTONES = ["HC-P1", "HC-P2", "HC-P3", "HC-P4", "HC-P5", "HC-P6", "HC-P7"];

const PHASE_EVIDENCE_HINTS = {
  "EPIC: HC-P1 Information Architecture and Coverage Map": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Create north-star coverage matrix (user goal -> help topic -> anchor)": [
    "docs/help/north-star-acceptance.md",
    "apps/renderer/src/features/help/help-topics.ts"
  ],
  "Refactor help topic metadata model for audience/journey tagging": [
    "apps/renderer/src/features/help/help-topics.ts",
    "docs/help/help-topics.json",
    "docs/help/help-topics.schema.json"
  ],
  "Add Help Center \"Start Here\" entry IA (new user path + experienced user path)": [
    "apps/renderer/src/features/help/HelpPage.tsx",
    "docs/help/topics/quick-start.md"
  ],
  "QA gate: every primary route has mapped help entry and valid jump target": [
    "apps/renderer/src/features/help/HelpPage.test.tsx",
    "apps/renderer/src/features/dashboard/DashboardPage.test.tsx",
    "apps/renderer/src/features/reports/ReportsPage.test.tsx",
    "apps/renderer/src/features/import/ImportPage.test.tsx"
  ],
  "EPIC: HC-P2 Baseline Setup Journey": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Rewrite Quick Start into setup checklist (vendors/services/contracts/expenses/dimensions)": [
    "apps/renderer/src/features/help/HelpPage.tsx",
    "docs/help/topics/quick-start.md"
  ],
  "Add \"first session\" guided sequence with route-accurate anchor jumps": [
    "apps/renderer/src/features/help/HelpPage.tsx",
    "apps/renderer/src/features/help/HelpPage.test.tsx"
  ],
  "Add baseline-completion checklist state (local persisted progress)": [
    "apps/renderer/src/features/help/HelpPage.tsx",
    "apps/renderer/src/features/help/HelpPage.test.tsx"
  ],
  "QA gate: new user can complete baseline setup without external docs": [
    "docs/help/north-star-acceptance.md",
    "apps/renderer/src/features/help/HelpPage.test.tsx"
  ],
  "EPIC: HC-P3 Import and Reconciliation": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Author import-actuals playbook with failure handling and reconciliation decisions": [
    "docs/help/topics/import-wizard.md",
    "docs/help/topics/reports-workspace.md"
  ],
  "Add glossary entries for import statuses, match states, and error classes": [
    "docs/help/topics/import-wizard.md",
    "docs/help-system.md"
  ],
  "Add contextual help entry points from Import and Reports reconciliation surfaces": [
    "apps/renderer/src/features/import/ImportPage.tsx",
    "apps/renderer/src/features/reports/ReportsPage.tsx"
  ],
  "QA gate: import and reconcile flow completion test": [
    "apps/renderer/src/features/import/ImportPage.test.tsx",
    "apps/renderer/src/features/reports/ReportsPage.test.tsx"
  ],
  "EPIC: HC-P4 Dashboard Interpretation": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Document KPI definitions and variance math in operator language": [
    "docs/help/topics/dashboard.md",
    "docs/help-system.md"
  ],
  "Add variance triage runbook (what changed, where to inspect, what to do next)": [
    "docs/help/topics/dashboard.md"
  ],
  "Add contextual links from dashboard cards to relevant help anchors": [
    "apps/renderer/src/features/dashboard/DashboardPage.tsx"
  ],
  "QA gate: first-time user can interpret dashboard and variance correctly": [
    "apps/renderer/src/features/dashboard/DashboardPage.test.tsx"
  ],
  "EPIC: HC-P5 Reporting and Operating Rhythm": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Create executive export playbook (format choice, quality checks, delivery steps)": [
    "docs/help/topics/reports-workspace.md",
    "docs/help-system.md"
  ],
  "Add monthly/weekly operating checklist content and cadence guidance": [
    "docs/help/topics/reports-workspace.md",
    "docs/help/appendices/workflows.md"
  ],
  "Add report-page help shortcuts for export and narrative generation": [
    "apps/renderer/src/features/reports/ReportsPage.tsx"
  ],
  "QA gate: user can produce executive export and follow weekly/monthly tasks": [
    "apps/renderer/src/features/reports/ReportsPage.test.tsx",
    "docs/help/north-star-acceptance.md"
  ],
  "EPIC: HC-P6 Findability and Contextual Delivery": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Implement Help search/jump index (topic + heading + glossary terms)": [
    "apps/renderer/src/features/help/HelpPage.tsx",
    "apps/renderer/src/features/help/HelpPage.test.tsx"
  ],
  "Add command/F1 entry points with pre-seeded query/context": [
    "apps/renderer/src/app/AppShell.tsx",
    "apps/renderer/src/app/command-palette-model.ts"
  ],
  "Ship contextual (?) definitions for high-friction fields/status chips": [
    "apps/renderer/src/features/import/ImportPage.tsx",
    "apps/renderer/src/features/reports/ReportsPage.tsx"
  ],
  "QA gate: experienced user can find meaning/definition in <30 seconds": [
    "docs/help/north-star-acceptance.md",
    "apps/renderer/src/features/help/HelpPage.test.tsx"
  ],
  "EPIC: HC-P7 Help Integrity Guardrails": [
    "docs/help/help-center-roadmap.md",
    "docs/help/help-center-issues.json"
  ],
  "Build integrity checker script for topic->heading validation": [
    "scripts/help-tools.cjs",
    "docs/help-system.md",
    "apps/renderer/src/features/help/help-topics.ts"
  ],
  "Add checker tests/fixtures (pass + fail + duplicate heading edge cases)": [
    "scripts/help-tools.cjs"
  ],
  "Wire checker into CI quality pipeline": [
    ".github/workflows/ci.yml",
    "package.json"
  ],
  "Document maintenance and enforce required status check": [
    "docs/help-system.md",
    "docs/ci-cd.md"
  ]
};

function fail(message) {
  throw new Error(message);
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function writeText(filePath, value) {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, value, "utf8");
}

function fileSha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function truncate(text, maxLength = 5000) {
  if (!text) {
    return "";
  }
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n...[truncated]`;
}

function runCommand(command, options = {}) {
  const cwd = options.cwd || ROOT_DIR;
  const timeoutMs = options.timeoutMs || 300000;
  const isWindows = process.platform === "win32";
  const binary = isWindows ? "cmd" : "sh";
  const args = isWindows ? ["/d", "/s", "/c", command] : ["-lc", command];

  const result = spawnSync(binary, args, {
    cwd,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 20 * 1024 * 1024
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";
  const output = `${stdout}${stderr}`.trim();

  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout,
    stderr,
    output
  };
}

function runGhJson(args) {
  const result = spawnSync("gh", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    timeout: 120000,
    maxBuffer: 20 * 1024 * 1024
  });
  if (result.status !== 0) {
    const errorOutput = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    fail(`gh ${args.join(" ")} failed: ${errorOutput}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    fail(
      `Failed to parse gh output for "${args.join(" ")}": ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function getRepoNameWithOwner() {
  const result = spawnSync(
    "gh",
    ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"],
    {
      cwd: ROOT_DIR,
      encoding: "utf8",
      timeout: 120000
    }
  );
  if (result.status !== 0) {
    const errorOutput = `${result.stdout || ""}\n${result.stderr || ""}`.trim();
    fail(`Failed to resolve repository from gh: ${errorOutput}`);
  }
  const repo = (result.stdout || "").trim();
  if (!repo) {
    fail("gh repo view returned an empty repository name.");
  }
  return repo;
}

function getChecklistStatus(markdownBody) {
  const body = markdownBody || "";
  const matches = [...body.matchAll(/-\s+\[( |x|X)\]/g)];
  if (matches.length === 0) {
    return {
      hasChecklist: false,
      allChecked: false,
      total: 0,
      checked: 0
    };
  }
  const checked = matches.filter((entry) => entry[1].toLowerCase() === "x").length;
  return {
    hasChecklist: true,
    allChecked: checked === matches.length,
    total: matches.length,
    checked
  };
}

function recursiveListFiles(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...recursiveListFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function copyFileWithDirs(fromPath, toPath) {
  ensureDirectory(path.dirname(toPath));
  fs.copyFileSync(fromPath, toPath);
}

function copyDirectoryRecursive(fromDir, toDir) {
  ensureDirectory(toDir);
  const entries = fs.readdirSync(fromDir, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(fromDir, entry.name);
    const target = path.join(toDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryRecursive(source, target);
    } else if (entry.isFile()) {
      copyFileWithDirs(source, target);
    }
  }
}

function removeDirectoryRecursive(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return;
  }
  fs.rmSync(directoryPath, { recursive: true, force: true });
}

function setupTempHelpWorkspace() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "budgetit-help-verify-"));
  copyDirectoryRecursive(path.join(ROOT_DIR, "docs", "help"), path.join(tempRoot, "docs", "help"));
  copyFileWithDirs(path.join(ROOT_DIR, "docs", "help-system.md"), path.join(tempRoot, "docs", "help-system.md"));
  copyFileWithDirs(
    path.join(ROOT_DIR, "apps", "renderer", "src", "features", "help", "help-topics.ts"),
    path.join(tempRoot, "apps", "renderer", "src", "features", "help", "help-topics.ts")
  );
  copyFileWithDirs(path.join(ROOT_DIR, "scripts", "help-tools.cjs"), path.join(tempRoot, "scripts", "help-tools.cjs"));
  return tempRoot;
}

function evaluateNegativeScenario(mutator) {
  const tempRoot = setupTempHelpWorkspace();
  try {
    mutator(tempRoot);
    return runCommand("node scripts/help-tools.cjs check", {
      cwd: tempRoot,
      timeoutMs: 120000
    });
  } finally {
    removeDirectoryRecursive(tempRoot);
  }
}

function requirementById(requirements) {
  return new Map(requirements.map((entry) => [entry.id, entry]));
}

function createResultStore(requirements) {
  const map = new Map();
  const requirementMap = requirementById(requirements);

  function setResult(id, payload) {
    const requirement = requirementMap.get(id);
    if (!requirement) {
      fail(`Attempted to write result for unknown requirement id: ${id}`);
    }
    map.set(id, {
      id,
      status: payload.status,
      evidence: payload.evidence || [],
      command: payload.command || "",
      output: payload.output || "",
      gapType: payload.gapType || (payload.status === "pass" ? "None" : "Evidence Gap"),
      remediationIssueTitle:
        payload.remediationIssueTitle ||
        (payload.status === "pass"
          ? "None"
          : `[Verification] ${requirement.phase}: ${requirement.requirement}`)
    });
  }

  function finalize() {
    for (const requirement of requirements) {
      if (map.has(requirement.id)) {
        continue;
      }
      setResult(requirement.id, {
        status: "fail",
        evidence: ["Requirement was not evaluated by the verifier implementation."],
        gapType: "Evidence Gap",
        remediationIssueTitle: `[Verification] ${requirement.phase}: Evaluate ${requirement.requirement}`
      });
    }
    return requirements.map((requirement) => map.get(requirement.id));
  }

  return { setResult, finalize };
}

function buildReopenCandidates(requirements, results) {
  const requirementMap = requirementById(requirements);
  const candidatesByTitle = new Map();

  for (const result of results) {
    if (result.status !== "fail") {
      continue;
    }
    const requirement = requirementMap.get(result.id);
    const title = result.remediationIssueTitle || `[Verification] ${requirement.requirement}`;
    if (candidatesByTitle.has(title)) {
      continue;
    }
    candidatesByTitle.set(title, {
      id: "",
      title,
      phase: requirement.phase,
      gapType: result.gapType === "None" ? "Evidence Gap" : result.gapType,
      priority: requirement.failSeverity,
      target: requirement.source,
      expectedEndState: requirement.passRule,
      blockedByRequirement: requirement.id
    });
  }

  const candidates = [...candidatesByTitle.values()];
  candidates.sort((left, right) => {
    const leftPriority = left.priority === "p1" ? 0 : 1;
    const rightPriority = right.priority === "p1" ? 0 : 1;
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return left.title.localeCompare(right.title);
  });
  candidates.forEach((candidate, index) => {
    candidate.id = `RC-${String(index + 1).padStart(3, "0")}`;
  });
  return candidates;
}

function markdownEscape(value) {
  return String(value).replace(/\|/g, "\\|");
}

function buildReport({
  repoName,
  baseline,
  requirements,
  results,
  phaseMatrix,
  reopenCandidates
}) {
  const requirementMap = requirementById(requirements);
  const totalRequirements = results.length;
  const passed = results.filter((entry) => entry.status === "pass").length;
  const failed = totalRequirements - passed;
  const passRatePercent =
    totalRequirements === 0
      ? 100
      : Math.round((passed / totalRequirements) * 10000) / 100;
  const overallStatus = failed === 0 ? "pass" : "fail";

  const gapCounts = {
    "Contract Gap": results.filter((entry) => entry.gapType === "Contract Gap").length,
    "Governance Gap": results.filter((entry) => entry.gapType === "Governance Gap").length,
    "Evidence Gap": results.filter((entry) => entry.gapType === "Evidence Gap").length
  };

  const lines = [
    "# Help Center Verification Report (Exact Contract)",
    "",
    `Generated: ${baseline.timestampUtc}`,
    `Repository: ${repoName}`,
    `Revision: ${baseline.repoSha}`,
    "",
    "## Overall Score",
    "",
    `- Total requirements: ${totalRequirements}`,
    `- Passed: ${passed}`,
    `- Failed: ${failed}`,
    `- Pass rate: ${passRatePercent}%`,
    `- Overall status: ${overallStatus.toUpperCase()}`,
    "",
    "## Fail Summary",
    "",
    `- Contract Gap: ${gapCounts["Contract Gap"]}`,
    `- Governance Gap: ${gapCounts["Governance Gap"]}`,
    `- Evidence Gap: ${gapCounts["Evidence Gap"]}`,
    "",
    "## Baseline Evidence",
    "",
    "| File | Exists | Size (bytes) | SHA-256 |",
    "| --- | --- | ---: | --- |"
  ];

  for (const file of baseline.evidenceFiles) {
    lines.push(
      `| ${markdownEscape(file.path)} | ${file.exists ? "yes" : "no"} | ${file.sizeBytes} | ${markdownEscape(file.sha256)} |`
    );
  }

  function appendRequirementSection(title, filterFn) {
    const sectionResults = results.filter((entry) => filterFn(requirementMap.get(entry.id)));
    lines.push("");
    lines.push(`## ${title}`);
    lines.push("");
    lines.push("| ID | Requirement | Status | Gap Type | Evidence |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const result of sectionResults) {
      const requirement = requirementMap.get(result.id);
      const evidence = result.evidence.length > 0 ? result.evidence[0] : "";
      lines.push(
        `| ${markdownEscape(result.id)} | ${markdownEscape(requirement.requirement)} | ${result.status.toUpperCase()} | ${markdownEscape(result.gapType)} | ${markdownEscape(evidence)} |`
      );
    }
  }

  appendRequirementSection("Governance Checklist", (req) => req.type === "governance");
  appendRequirementSection("Contract Checklist", (req) => req.type === "contract");
  appendRequirementSection("Behavioral Validation", (req) => req.type === "behavior");
  appendRequirementSection("North-Star Verification", (req) => req.type === "north-star");

  lines.push("");
  lines.push("## Phase-by-Phase Evidence Matrix");
  lines.push("");
  lines.push("| Phase | Planned Item | Status | Evidence |");
  lines.push("| --- | --- | --- | --- |");
  for (const row of phaseMatrix) {
    const evidence = row.evidence.length > 0 ? row.evidence[0] : "";
    lines.push(
      `| ${markdownEscape(row.phase)} | ${markdownEscape(row.item)} | ${row.status.toUpperCase()} | ${markdownEscape(evidence)} |`
    );
  }

  lines.push("");
  lines.push("## Remediation Backlog");
  lines.push("");
  if (reopenCandidates.length === 0) {
    lines.push("- No reopen candidates. All requirements passed.");
  } else {
    lines.push("| ID | Priority | Gap Type | Phase | Remediation Issue Title | Target |");
    lines.push("| --- | --- | --- | --- | --- | --- |");
    for (const candidate of reopenCandidates) {
      lines.push(
        `| ${candidate.id} | ${candidate.priority.toUpperCase()} | ${markdownEscape(
          candidate.gapType
        )} | ${markdownEscape(candidate.phase)} | ${markdownEscape(candidate.title)} | ${markdownEscape(
          candidate.target
        )} |`
      );
    }
  }

  lines.push("");
  lines.push("## Execution Notes");
  lines.push("");
  lines.push("- Strictness mode: exact-contract.");
  lines.push(
    "- Branch protection failures include the GitHub API response when protection is absent or required checks are missing."
  );
  lines.push("- Behavioral checks were executed via command-line invocation and captured in verification-results.json.");

  return lines.join("\n");
}

function main() {
  ensureDirectory(VERIFICATION_DIR);
  if (!fs.existsSync(REQUIREMENTS_PATH)) {
    fail(`Requirement catalog missing: ${REQUIREMENTS_PATH}`);
  }

  const requirements = readJson(REQUIREMENTS_PATH);
  const resultStore = createResultStore(requirements);

  const repoName = getRepoNameWithOwner();
  const repoShaResult = runCommand("git rev-parse HEAD");
  const repoSha = repoShaResult.status === 0 ? repoShaResult.stdout.trim() : "unknown";
  const timestampUtc = new Date().toISOString();

  const baseline = {
    repoRoot: ROOT_DIR,
    repoSha,
    timestampUtc,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown",
    evidenceFiles: REQUIRED_EVIDENCE_FILES.map((relativePath) => {
      const absolutePath = path.join(ROOT_DIR, relativePath);
      const exists = fs.existsSync(absolutePath);
      return {
        path: relativePath,
        exists,
        sizeBytes: exists ? fs.statSync(absolutePath).size : 0,
        sha256: exists ? fileSha256(absolutePath) : "missing"
      };
    })
  };

  resultStore.setResult("BASE-001", {
    status: repoSha !== "unknown" ? "pass" : "fail",
    evidence: [`repoSha=${repoSha}`, `timestampUtc=${timestampUtc}`, `node=${process.version}`],
    command: "git rev-parse HEAD",
    output: truncate(repoShaResult.output),
    gapType: repoSha !== "unknown" ? "None" : "Evidence Gap",
    remediationIssueTitle:
      repoSha !== "unknown"
        ? "None"
        : "[Verification] Capture repository SHA in baseline metadata"
  });

  const missingBaselineFiles = baseline.evidenceFiles.filter((entry) => !entry.exists);
  resultStore.setResult("BASE-002", {
    status: missingBaselineFiles.length === 0 ? "pass" : "fail",
    evidence:
      missingBaselineFiles.length === 0
        ? baseline.evidenceFiles.map((entry) => `${entry.path} (${entry.sha256.slice(0, 12)})`)
        : missingBaselineFiles.map((entry) => `Missing evidence file: ${entry.path}`),
    gapType: missingBaselineFiles.length === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      missingBaselineFiles.length === 0
        ? "None"
        : "[Verification] Restore missing baseline evidence files for help-center audit"
  });

  const labels = runGhJson(["label", "list", "--repo", repoName, "--limit", "500", "--json", "name"]);
  const milestones = runGhJson(["api", `repos/${repoName}/milestones?state=all&per_page=100`]);
  const issues = runGhJson([
    "issue",
    "list",
    "--repo",
    repoName,
    "--state",
    "all",
    "--limit",
    "500",
    "--json",
    "number,title,state,milestone,labels,url,body,closedByPullRequestsReferences"
  ]);

  let branchProtection = null;
  let branchProtectionError = "";
  try {
    branchProtection = runGhJson(["api", `repos/${repoName}/branches/main/protection`]);
  } catch (error) {
    branchProtectionError = error instanceof Error ? error.message : String(error);
  }

  writeJson(GITHUB_STATE_PATH, {
    repository: repoName,
    capturedAt: timestampUtc,
    labels,
    milestones,
    issues,
    branchProtection: branchProtection || null,
    branchProtectionError
  });

  const labelSet = new Set(labels.map((label) => label.name));
  const missingLabels = REQUIRED_HELP_LABELS.filter((label) => !labelSet.has(label));
  resultStore.setResult("GOV-001", {
    status: missingLabels.length === 0 ? "pass" : "fail",
    evidence:
      missingLabels.length === 0
        ? [`All required labels found (${REQUIRED_HELP_LABELS.length}).`]
        : missingLabels.map((label) => `Missing label: ${label}`),
    gapType: missingLabels.length === 0 ? "None" : "Governance Gap",
    remediationIssueTitle:
      missingLabels.length === 0
        ? "None"
        : "[Verification] Restore required Help Center labels"
  });

  const milestoneByTitle = new Map(milestones.map((milestone) => [milestone.title, milestone]));
  const missingMilestones = REQUIRED_MILESTONES.filter((title) => !milestoneByTitle.has(title));
  resultStore.setResult("GOV-002", {
    status: missingMilestones.length === 0 ? "pass" : "fail",
    evidence:
      missingMilestones.length === 0
        ? REQUIRED_MILESTONES.map((title) => `Found milestone: ${title}`)
        : missingMilestones.map((title) => `Missing milestone: ${title}`),
    gapType: missingMilestones.length === 0 ? "None" : "Governance Gap",
    remediationIssueTitle:
      missingMilestones.length === 0
        ? "None"
        : "[Verification] Recreate missing HC-P milestones"
  });

  const hcIssues = issues.filter((issue) => REQUIRED_MILESTONES.includes(issue.milestone?.title));
  const milestoneShapeErrors = [];
  for (const milestoneTitle of REQUIRED_MILESTONES) {
    const items = hcIssues.filter((issue) => issue.milestone?.title === milestoneTitle);
    const epicCount = items.filter((issue) => issue.title.startsWith("EPIC:")).length;
    if (items.length !== 5 || epicCount !== 1) {
      milestoneShapeErrors.push(
        `${milestoneTitle}: total=${items.length}, epic=${epicCount}, nonEpic=${items.length - epicCount}`
      );
    }
  }
  resultStore.setResult("GOV-003", {
    status: milestoneShapeErrors.length === 0 ? "pass" : "fail",
    evidence:
      milestoneShapeErrors.length === 0
        ? REQUIRED_MILESTONES.map((title) => `${title}: 5 issues with 1 epic`)
        : milestoneShapeErrors,
    gapType: milestoneShapeErrors.length === 0 ? "None" : "Governance Gap",
    remediationIssueTitle:
      milestoneShapeErrors.length === 0
        ? "None"
        : "[Verification] Normalize HC milestone issue shape to 5 issues (1 epic + 4 non-epic)"
  });

  const openMilestones = REQUIRED_MILESTONES.filter((title) => {
    const milestone = milestoneByTitle.get(title);
    return milestone && milestone.state !== "closed";
  });
  resultStore.setResult("GOV-004", {
    status: openMilestones.length === 0 ? "pass" : "fail",
    evidence:
      openMilestones.length === 0
        ? ["All HC milestones are closed."]
        : openMilestones.map((title) => `${title} is not closed.`),
    gapType: openMilestones.length === 0 ? "None" : "Governance Gap",
    remediationIssueTitle:
      openMilestones.length === 0
        ? "None"
        : "[Verification] Close all HC milestones after phase completion"
  });

  resultStore.setResult("GOV-005", {
    status: openMilestones.length <= 1 ? "pass" : "fail",
    evidence: [`Open HC milestones: ${openMilestones.length}`, ...openMilestones],
    gapType: openMilestones.length <= 1 ? "None" : "Governance Gap",
    remediationIssueTitle:
      openMilestones.length <= 1
        ? "None"
        : "[Verification] Enforce sequential phase gating with one active HC milestone"
  });

  const closedIssues = hcIssues.filter((issue) => issue.state === "CLOSED");
  const checklistFailures = [];
  for (const issue of closedIssues) {
    const checklist = getChecklistStatus(issue.body || "");
    if (!checklist.hasChecklist) {
      checklistFailures.push(`#${issue.number} ${issue.title}: no checklist entries found.`);
      continue;
    }
    if (!checklist.allChecked) {
      checklistFailures.push(
        `#${issue.number} ${issue.title}: checklist ${checklist.checked}/${checklist.total} checked.`
      );
    }
  }
  resultStore.setResult("GOV-006", {
    status: checklistFailures.length === 0 ? "pass" : "fail",
    evidence: checklistFailures.length === 0 ? ["All closed HC issues have checked checklists."] : checklistFailures,
    gapType: checklistFailures.length === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      checklistFailures.length === 0
        ? "None"
        : "[Verification] Backfill checked acceptance checklists on closed HC issues"
  });

  const linkedPrFailures = closedIssues
    .filter((issue) => (issue.closedByPullRequestsReferences || []).length === 0)
    .map((issue) => `#${issue.number} ${issue.title}: no closing PR reference.`);
  resultStore.setResult("GOV-007", {
    status: linkedPrFailures.length === 0 ? "pass" : "fail",
    evidence:
      linkedPrFailures.length === 0
        ? ["All closed HC issues have linked closing PR references."]
        : linkedPrFailures,
    gapType: linkedPrFailures.length === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      linkedPrFailures.length === 0
        ? "None"
        : "[Verification] Link closing PR evidence to all closed HC issues"
  });

  const helpTopicsPath = path.join(
    ROOT_DIR,
    "apps",
    "renderer",
    "src",
    "features",
    "help",
    "help-topics.ts"
  );
  const helpTopicsContent = fs.readFileSync(helpTopicsPath, "utf8");
  const helpTopicTypeMatch = helpTopicsContent.match(/export type HelpTopic = \{([\s\S]*?)\n\};/);
  const helpTopicFieldBlock = helpTopicTypeMatch ? helpTopicTypeMatch[1] : "";
  const requiredHelpTopicFields = ["audience", "journeyStep", "keywords", "outcomes"];
  const missingHelpTopicFields = requiredHelpTopicFields.filter(
    (field) => !new RegExp(`\\b${field}\\s*:`).test(helpTopicFieldBlock)
  );
  resultStore.setResult("CON-001", {
    status: missingHelpTopicFields.length === 0 ? "pass" : "fail",
    evidence:
      missingHelpTopicFields.length === 0
        ? requiredHelpTopicFields.map((field) => `HelpTopic field found: ${field}`)
        : missingHelpTopicFields.map((field) => `Missing HelpTopic field: ${field}`),
    gapType: missingHelpTopicFields.length === 0 ? "None" : "Contract Gap",
    remediationIssueTitle:
      missingHelpTopicFields.length === 0
        ? "None"
        : "[Verification] Add missing HelpTopic contract fields (including outcomes)"
  });

  const buildHashSignatureMatch = helpTopicsContent.match(
    /export function buildHelpHashPath\(payload\?: \{([\s\S]*?)\}\): string \{/
  );
  const buildHashSignature = buildHashSignatureMatch ? buildHashSignatureMatch[1] : "";
  const signatureFields = ["topic", "anchor", "q", "context"];
  const missingSignatureFields = signatureFields.filter(
    (field) => !new RegExp(`\\b${field}\\?:`).test(buildHashSignature)
  );
  resultStore.setResult("CON-002", {
    status: missingSignatureFields.length === 0 ? "pass" : "fail",
    evidence:
      missingSignatureFields.length === 0
        ? signatureFields.map((field) => `buildHelpHashPath payload field found: ${field}`)
        : missingSignatureFields.map((field) => `Missing buildHelpHashPath payload field: ${field}`),
    gapType: missingSignatureFields.length === 0 ? "None" : "Contract Gap",
    remediationIssueTitle:
      missingSignatureFields.length === 0
        ? "None"
        : "[Verification] Extend buildHelpHashPath payload contract to include q/context"
  });

  const buildHashBodyMatch = helpTopicsContent.match(
    /export function buildHelpHashPath\(payload\?: \{[\s\S]*?\}\): string \{([\s\S]*?)\n\}/
  );
  const buildHashBody = buildHashBodyMatch ? buildHashBodyMatch[1] : "";
  const hasQEncoding = /params\.set\("q",/.test(buildHashBody);
  const hasContextEncoding = /params\.set\("context",/.test(buildHashBody);
  const encodingErrors = [];
  if (!hasQEncoding) {
    encodingErrors.push('Missing params.set("q", ...) in buildHelpHashPath.');
  }
  if (!hasContextEncoding) {
    encodingErrors.push('Missing params.set("context", ...) in buildHelpHashPath.');
  }
  resultStore.setResult("CON-003", {
    status: encodingErrors.length === 0 ? "pass" : "fail",
    evidence: encodingErrors.length === 0 ? ["q and context are encoded in help URL query params."] : encodingErrors,
    gapType: encodingErrors.length === 0 ? "None" : "Contract Gap",
    remediationIssueTitle:
      encodingErrors.length === 0
        ? "None"
        : "[Verification] Encode q/context query params in buildHelpHashPath"
  });

  const helpDomainFiles = recursiveListFiles(path.join(ROOT_DIR, "apps", "renderer", "src", "features", "help"));
  let helpDefinitionBlock = "";
  for (const filePath of helpDomainFiles) {
    const content = fs.readFileSync(filePath, "utf8");
    const typeMatch = content.match(
      /(?:export\s+)?type\s+HelpDefinition\s*=\s*\{([\s\S]*?)\};/
    );
    if (typeMatch) {
      helpDefinitionBlock = typeMatch[1];
      break;
    }
    const interfaceMatch = content.match(
      /(?:export\s+)?interface\s+HelpDefinition\s*\{([\s\S]*?)\}/
    );
    if (interfaceMatch) {
      helpDefinitionBlock = interfaceMatch[1];
      break;
    }
  }
  const definitionRequiredFields = ["id", "term", "meaning", "appliesTo", "relatedTopicId"];
  const missingDefinitionFields = definitionRequiredFields.filter(
    (field) => !new RegExp(`\\b${field}\\s*:`).test(helpDefinitionBlock)
  );
  const hasDefinitionType = helpDefinitionBlock.length > 0;
  resultStore.setResult("CON-004", {
    status: hasDefinitionType && missingDefinitionFields.length === 0 ? "pass" : "fail",
    evidence:
      hasDefinitionType && missingDefinitionFields.length === 0
        ? ["HelpDefinition type exists with required fields."]
        : hasDefinitionType
          ? missingDefinitionFields.map((field) => `HelpDefinition missing field: ${field}`)
          : ["HelpDefinition type/interface not found in renderer help domain."],
    gapType: hasDefinitionType && missingDefinitionFields.length === 0 ? "None" : "Contract Gap",
    remediationIssueTitle:
      hasDefinitionType && missingDefinitionFields.length === 0
        ? "None"
        : "[Verification] Add HelpDefinition contract to renderer help domain"
  });

  const packageJson = readJson(path.join(ROOT_DIR, "package.json"));
  const checkIntegrityScript = packageJson.scripts ? packageJson.scripts["check:help-integrity"] : undefined;
  resultStore.setResult("CON-005", {
    status: typeof checkIntegrityScript === "string" ? "pass" : "fail",
    evidence:
      typeof checkIntegrityScript === "string"
        ? [`check:help-integrity=${checkIntegrityScript}`]
        : ["scripts.check:help-integrity is missing from package.json."],
    gapType: typeof checkIntegrityScript === "string" ? "None" : "Contract Gap",
    remediationIssueTitle:
      typeof checkIntegrityScript === "string"
        ? "None"
        : "[Verification] Add check:help-integrity script to package.json"
  });

  const expectedScriptTarget = "node scripts/check-help-integrity.cjs";
  resultStore.setResult("CON-006", {
    status: checkIntegrityScript === expectedScriptTarget ? "pass" : "fail",
    evidence:
      checkIntegrityScript === expectedScriptTarget
        ? [`check:help-integrity points to ${expectedScriptTarget}`]
        : [
            `Expected "${expectedScriptTarget}" but found "${
              typeof checkIntegrityScript === "string" ? checkIntegrityScript : "missing"
            }".`
          ],
    gapType: checkIntegrityScript === expectedScriptTarget ? "None" : "Contract Gap",
    remediationIssueTitle:
      checkIntegrityScript === expectedScriptTarget
        ? "None"
        : "[Verification] Point check:help-integrity to scripts/check-help-integrity.cjs"
  });

  const checkIntegrityScriptPath = path.join(ROOT_DIR, "scripts", "check-help-integrity.cjs");
  const scriptExists = fs.existsSync(checkIntegrityScriptPath);
  resultStore.setResult("CON-007", {
    status: scriptExists ? "pass" : "fail",
    evidence: scriptExists ? ["scripts/check-help-integrity.cjs exists."] : ["scripts/check-help-integrity.cjs is missing."],
    gapType: scriptExists ? "None" : "Contract Gap",
    remediationIssueTitle:
      scriptExists ? "None" : "[Verification] Add scripts/check-help-integrity.cjs"
  });

  const ciFilePath = path.join(ROOT_DIR, ".github", "workflows", "ci.yml");
  const ciFileContent = fs.readFileSync(ciFilePath, "utf8");
  const ciUsesLockedScript = /npm run check:help-integrity/.test(ciFileContent);
  resultStore.setResult("CON-008", {
    status: ciUsesLockedScript ? "pass" : "fail",
    evidence:
      ciUsesLockedScript
        ? ["ci.yml runs npm run check:help-integrity."]
        : ["ci.yml does not run npm run check:help-integrity."],
    gapType: ciUsesLockedScript ? "None" : "Contract Gap",
    remediationIssueTitle:
      ciUsesLockedScript ? "None" : "[Verification] Update CI to run check:help-integrity"
  });

  let requiredContexts = [];
  if (branchProtection && branchProtection.required_status_checks) {
    if (Array.isArray(branchProtection.required_status_checks.contexts)) {
      requiredContexts = branchProtection.required_status_checks.contexts;
    } else if (Array.isArray(branchProtection.required_status_checks.checks)) {
      requiredContexts = branchProtection.required_status_checks.checks
        .map((entry) => entry.context || entry.name || "")
        .filter((entry) => entry.length > 0);
    }
  }
  const hasHelpIntegrityRequired = requiredContexts.includes("Help Integrity");
  resultStore.setResult("CON-009", {
    status: hasHelpIntegrityRequired ? "pass" : "fail",
    evidence: hasHelpIntegrityRequired
      ? ["Branch protection requires Help Integrity status check."]
      : branchProtectionError
        ? [branchProtectionError]
        : [`Required status checks: ${requiredContexts.join(", ") || "(none)"}`],
    command: `gh api repos/${repoName}/branches/main/protection`,
    output: truncate(branchProtectionError || JSON.stringify(branchProtection || {}, null, 2)),
    gapType: hasHelpIntegrityRequired ? "None" : "Governance Gap",
    remediationIssueTitle:
      hasHelpIntegrityRequired
        ? "None"
        : "[Verification] Enforce Help Integrity status check in main branch protection"
  });

  const helpCheckResult = runCommand("npm run help:check", { timeoutMs: 180000 });
  resultStore.setResult("BEH-001", {
    status: helpCheckResult.status === 0 ? "pass" : "fail",
    evidence: [`Exit code: ${helpCheckResult.status}`],
    command: "npm run help:check",
    output: truncate(helpCheckResult.output),
    gapType: helpCheckResult.status === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      helpCheckResult.status === 0
        ? "None"
        : "[Verification] Repair help:check command health before verification"
  });

  const helpTestsCommand =
    "npm run test --workspace @budgetit/renderer -- src/features/help/HelpPage.test.tsx src/features/import/ImportPage.test.tsx src/features/reports/ReportsPage.test.tsx src/features/dashboard/DashboardPage.test.tsx";
  const helpTestsResult = runCommand(helpTestsCommand, { timeoutMs: 300000 });
  resultStore.setResult("BEH-002", {
    status: helpTestsResult.status === 0 ? "pass" : "fail",
    evidence: [`Exit code: ${helpTestsResult.status}`],
    command: helpTestsCommand,
    output: truncate(helpTestsResult.output),
    gapType: helpTestsResult.status === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      helpTestsResult.status === 0
        ? "None"
        : "[Verification] Restore help flow test stability"
  });

  const missingHeadingScenario = evaluateNegativeScenario((tempRoot) => {
    const filePath = path.join(tempRoot, "docs", "help-system.md");
    const content = fs.readFileSync(filePath, "utf8");
    const mutated = content.replace(
      /^## Quick Start \(First Launch\)$/m,
      "## Quick Start (First Launch Renamed)"
    );
    fs.writeFileSync(filePath, mutated, "utf8");
  });
  const missingHeadingPass =
    missingHeadingScenario.status !== 0 &&
    /(out of date|missing heading|Run:\s*npm run help:generate)/i.test(missingHeadingScenario.output);
  resultStore.setResult("BEH-003", {
    status: missingHeadingPass ? "pass" : "fail",
    evidence: [`Exit code: ${missingHeadingScenario.status}`],
    command: "node scripts/help-tools.cjs check (mutated missing-heading scenario)",
    output: truncate(missingHeadingScenario.output),
    gapType: missingHeadingPass ? "None" : "Evidence Gap",
    remediationIssueTitle:
      missingHeadingPass
        ? "None"
        : "[Verification] Add explicit missing-heading failure coverage to integrity checks"
  });

  const duplicateHeadingScenario = evaluateNegativeScenario((tempRoot) => {
    const manifestPath = path.join(tempRoot, "docs", "help", "help-topics.json");
    const manifest = readJson(manifestPath);
    if (!Array.isArray(manifest.topics) || manifest.topics.length < 2) {
      fail("Insufficient topics to run duplicate heading scenario.");
    }
    manifest.topics[1].docSection = manifest.topics[0].docSection;
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });
  const duplicateHeadingPass =
    duplicateHeadingScenario.status !== 0 &&
    /(mapped to multiple topic files|conflicting topic files)/i.test(duplicateHeadingScenario.output);
  resultStore.setResult("BEH-004", {
    status: duplicateHeadingPass ? "pass" : "fail",
    evidence: [`Exit code: ${duplicateHeadingScenario.status}`],
    command: "node scripts/help-tools.cjs check (mutated duplicate-heading scenario)",
    output: truncate(duplicateHeadingScenario.output),
    gapType: duplicateHeadingPass ? "None" : "Evidence Gap",
    remediationIssueTitle:
      duplicateHeadingPass
        ? "None"
        : "[Verification] Add duplicate-heading edge-case protection to integrity checks"
  });

  const driftScenario = evaluateNegativeScenario((tempRoot) => {
    const filePath = path.join(
      tempRoot,
      "apps",
      "renderer",
      "src",
      "features",
      "help",
      "help-topics.ts"
    );
    const content = fs.readFileSync(filePath, "utf8");
    fs.writeFileSync(filePath, `${content}\n// drift-injected-for-verification\n`, "utf8");
  });
  const driftPass =
    driftScenario.status !== 0 &&
    /(out of date|Run:\s*npm run help:generate)/i.test(driftScenario.output);
  resultStore.setResult("BEH-005", {
    status: driftPass ? "pass" : "fail",
    evidence: [`Exit code: ${driftScenario.status}`],
    command: "node scripts/help-tools.cjs check (mutated drift scenario)",
    output: truncate(driftScenario.output),
    gapType: driftPass ? "None" : "Evidence Gap",
    remediationIssueTitle:
      driftPass
        ? "None"
        : "[Verification] Enforce generated-artifact drift failure behavior"
  });

  const northStarPath = path.join(ROOT_DIR, "docs", "help", "north-star-acceptance.md");
  const northStarContent = fs.existsSync(northStarPath) ? fs.readFileSync(northStarPath, "utf8") : "";
  const newUserPhrases = [
    "Understand what BudgetIT is for",
    "Complete baseline setup",
    "Import actuals and reconcile unmatched rows",
    "Interpret dashboard KPIs and variance",
    "Produce an executive export",
    "Follow weekly and monthly operating guidance"
  ];
  const missingNewUserPhrases = newUserPhrases.filter(
    (phrase) => !northStarContent.includes(phrase)
  );
  resultStore.setResult("NS-001", {
    status: missingNewUserPhrases.length === 0 ? "pass" : "fail",
    evidence:
      missingNewUserPhrases.length === 0
        ? ["All six new-user outcomes are documented."]
        : missingNewUserPhrases.map((phrase) => `Missing phrase: ${phrase}`),
    gapType: missingNewUserPhrases.length === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      missingNewUserPhrases.length === 0
        ? "None"
        : "[Verification] Complete north-star documentation for new-user outcomes"
  });

  const experiencedUserPhrases = ["Press `F1`", "Search or jump", "under 30 seconds"];
  const missingExperiencedPhrases = experiencedUserPhrases.filter(
    (phrase) => !northStarContent.includes(phrase)
  );
  resultStore.setResult("NS-002", {
    status: missingExperiencedPhrases.length === 0 ? "pass" : "fail",
    evidence:
      missingExperiencedPhrases.length === 0
        ? ["Experienced-user F1/search/<30s scenario is documented."]
        : missingExperiencedPhrases.map((phrase) => `Missing phrase: ${phrase}`),
    gapType: missingExperiencedPhrases.length === 0 ? "None" : "Evidence Gap",
    remediationIssueTitle:
      missingExperiencedPhrases.length === 0
        ? "None"
        : "[Verification] Complete north-star documentation for experienced-user SLA"
  });

  const phaseRequirements = requirements.filter((entry) => entry.type === "phase-item");
  const phaseMatrix = [];
  for (const requirement of phaseRequirements) {
    const matchingIssue = hcIssues.find(
      (issue) =>
        issue.milestone?.title === requirement.phase && issue.title === requirement.requirement
    );

    if (!matchingIssue) {
      resultStore.setResult(requirement.id, {
        status: "fail",
        evidence: [
          `No exact issue title match in ${requirement.phase}: "${requirement.requirement}".`
        ],
        gapType: "Governance Gap",
        remediationIssueTitle: `[Verification] ${requirement.phase}: Create exact-plan issue "${requirement.requirement}"`
      });
      phaseMatrix.push({
        phase: requirement.phase,
        item: requirement.requirement,
        status: "fail",
        evidence: [`Missing exact issue title in milestone ${requirement.phase}.`]
      });
      continue;
    }

    const artifactHints = PHASE_EVIDENCE_HINTS[requirement.requirement] || [];
    const missingArtifacts = artifactHints.filter(
      (relativePath) => !fs.existsSync(path.join(ROOT_DIR, relativePath))
    );

    const checklist = getChecklistStatus(matchingIssue.body || "");
    const hasLinkedPr = (matchingIssue.closedByPullRequestsReferences || []).length > 0;

    const evidence = [
      `Issue: #${matchingIssue.number} (${matchingIssue.state})`,
      `URL: ${matchingIssue.url}`
    ];
    if (artifactHints.length > 0) {
      evidence.push(`Artifact hints found: ${artifactHints.length - missingArtifacts.length}/${artifactHints.length}`);
    }
    if (!checklist.hasChecklist || !checklist.allChecked) {
      evidence.push(
        checklist.hasChecklist
          ? `Checklist not fully checked (${checklist.checked}/${checklist.total}).`
          : "Checklist entries not found."
      );
    }
    if (!hasLinkedPr) {
      evidence.push("No linked closing PR reference.");
    }
    if (missingArtifacts.length > 0) {
      evidence.push(...missingArtifacts.map((entry) => `Missing artifact hint: ${entry}`));
    }

    const passes =
      matchingIssue.state === "CLOSED" &&
      missingArtifacts.length === 0 &&
      checklist.hasChecklist &&
      checklist.allChecked &&
      hasLinkedPr;

    resultStore.setResult(requirement.id, {
      status: passes ? "pass" : "fail",
      evidence,
      gapType: passes ? "None" : !hasLinkedPr || !checklist.allChecked ? "Evidence Gap" : "Governance Gap",
      remediationIssueTitle:
        passes
          ? "None"
          : `[Verification] ${requirement.phase}: Backfill exact-plan evidence for "${requirement.requirement}"`
    });

    phaseMatrix.push({
      phase: requirement.phase,
      item: requirement.requirement,
      status: passes ? "pass" : "fail",
      evidence
    });
  }

  const results = resultStore.finalize();
  const failedCount = results.filter((entry) => entry.status === "fail").length;
  const passedCount = results.length - failedCount;
  const passRatePercent = results.length === 0 ? 100 : Math.round((passedCount / results.length) * 10000) / 100;
  const overallStatus = failedCount === 0 ? "pass" : "fail";

  const reopenCandidates = buildReopenCandidates(requirements, results);
  writeJson(REOPEN_CANDIDATES_PATH, reopenCandidates);

  const reportData = {
    generatedAt: timestampUtc,
    strictness: "exact-contract",
    baseline,
    summary: {
      totalRequirements: results.length,
      passed: passedCount,
      failed: failedCount,
      passRatePercent,
      overallStatus
    },
    requirements,
    results,
    phaseMatrix,
    reopenCandidates
  };

  writeJson(RESULTS_PATH, reportData);
  writeText(
    REPORT_PATH,
    `${buildReport({
      repoName,
      baseline,
      requirements,
      results,
      phaseMatrix,
      reopenCandidates
    })}\n`
  );

  console.log("[verify-help-center] Verification artifacts written:");
  console.log(`- ${path.relative(ROOT_DIR, REPORT_PATH)}`);
  console.log(`- ${path.relative(ROOT_DIR, RESULTS_PATH)}`);
  console.log(`- ${path.relative(ROOT_DIR, REOPEN_CANDIDATES_PATH)}`);
  console.log(`- ${path.relative(ROOT_DIR, GITHUB_STATE_PATH)}`);
  console.log(
    `[verify-help-center] Requirements=${results.length} Passed=${passedCount} Failed=${failedCount} PassRate=${passRatePercent}%`
  );

  if (overallStatus === "fail") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(
    `[verify-help-center] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
