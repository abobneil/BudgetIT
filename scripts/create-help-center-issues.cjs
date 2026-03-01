const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const ROOT_DIR = process.cwd();
const DEFAULT_CONFIG_PATH = path.join(ROOT_DIR, "docs", "help", "help-center-issues.json");

function fail(message) {
  throw new Error(message);
}

function runGh(args, options = {}) {
  return execFileSync("gh", args, {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options
  }).trim();
}

function parseArgs(argv) {
  let repo = null;
  let configPath = DEFAULT_CONFIG_PATH;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--repo=")) {
      repo = argument.slice("--repo=".length).trim();
      continue;
    }
    if (argument === "--repo") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        fail("Missing value for --repo");
      }
      repo = next.trim();
      index += 1;
      continue;
    }

    if (argument.startsWith("--config=")) {
      configPath = path.resolve(ROOT_DIR, argument.slice("--config=".length));
      continue;
    }
    if (argument === "--config") {
      const next = argv[index + 1];
      if (!next || next.startsWith("--")) {
        fail("Missing value for --config");
      }
      configPath = path.resolve(ROOT_DIR, next);
      index += 1;
    }
  }

  return { repo, configPath };
}

function inferRepoFromGitRemote() {
  const remoteUrl = execFileSync("git", ["remote", "get-url", "origin"], {
    cwd: ROOT_DIR,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();

  const httpsMatch = remoteUrl.match(/^https:\/\/github\.com\/([^/]+\/[^/.]+)(?:\.git)?$/i);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  const sshMatch = remoteUrl.match(/^git@github\.com:([^/]+\/[^/.]+)(?:\.git)?$/i);
  if (sshMatch) {
    return sshMatch[1];
  }

  fail(`Could not infer owner/repo from origin URL: ${remoteUrl}`);
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    fail(`Config not found: ${configPath}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (error) {
    fail(`Failed to parse config: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!parsed || typeof parsed !== "object") {
    fail("Config root must be an object.");
  }
  if (!Array.isArray(parsed.labels) || parsed.labels.length === 0) {
    fail("Config must define a non-empty labels array.");
  }
  if (!Array.isArray(parsed.milestones) || parsed.milestones.length === 0) {
    fail("Config must define a non-empty milestones array.");
  }

  for (const milestone of parsed.milestones) {
    if (!milestone || typeof milestone !== "object") {
      fail("Each milestone must be an object.");
    }
    if (typeof milestone.name !== "string" || milestone.name.trim().length === 0) {
      fail("Each milestone must have a non-empty name.");
    }
    if (typeof milestone.title !== "string" || milestone.title.trim().length === 0) {
      fail(`Milestone "${milestone.name}" must have a non-empty title.`);
    }
    if (!Array.isArray(milestone.issues) || milestone.issues.length === 0) {
      fail(`Milestone "${milestone.name}" must define issues.`);
    }
    if (!String(milestone.issues[0]).startsWith("EPIC:")) {
      fail(`Milestone "${milestone.name}" must have an EPIC issue as the first entry.`);
    }
  }

  return parsed;
}

function getLabelMetadata(labelName) {
  if (labelName === "area:help-center") {
    return {
      color: "1D76DB",
      description: "Help Center roadmap and implementation work"
    };
  }

  if (labelName.startsWith("phase:")) {
    return {
      color: "5319E7",
      description: "Help Center roadmap phase label"
    };
  }

  if (labelName === "type:epic") {
    return { color: "B60205", description: "Epic issue" };
  }
  if (labelName === "type:feature") {
    return { color: "0E8A16", description: "Feature implementation issue" };
  }
  if (labelName === "type:qa") {
    return { color: "FBCA04", description: "QA and validation issue" };
  }
  if (labelName === "type:chore") {
    return { color: "C2E0C6", description: "Maintenance/chore issue" };
  }
  if (labelName === "priority:p1") {
    return { color: "D93F0B", description: "High priority" };
  }
  if (labelName === "priority:p2") {
    return { color: "FBCA04", description: "Medium priority" };
  }
  if (labelName === "north-star") {
    return { color: "0052CC", description: "North-star acceptance path" };
  }

  return { color: "D4C5F9", description: "Help Center label" };
}

function ensureLabels(repo, labels) {
  const existingLabels = JSON.parse(
    runGh(["label", "list", "--repo", repo, "--limit", "500", "--json", "name"])
  );
  const existingSet = new Set(existingLabels.map((label) => label.name));

  for (const label of labels) {
    if (existingSet.has(label)) {
      continue;
    }

    const metadata = getLabelMetadata(label);
    runGh([
      "label",
      "create",
      label,
      "--repo",
      repo,
      "--color",
      metadata.color,
      "--description",
      metadata.description
    ]);
    console.log(`Created label: ${label}`);
  }
}

function listMilestones(repo) {
  return JSON.parse(
    runGh(["api", `repos/${repo}/milestones?state=all&per_page=100`])
  );
}

function ensureMilestones(repo, milestoneConfigs) {
  const milestones = listMilestones(repo);
  const milestoneByTitle = new Map(milestones.map((milestone) => [milestone.title, milestone]));

  for (const milestoneConfig of milestoneConfigs) {
    if (milestoneByTitle.has(milestoneConfig.name)) {
      continue;
    }

    const description = `Phase ${milestoneConfig.name}: ${milestoneConfig.title}`;
    const created = JSON.parse(
      runGh([
        "api",
        `repos/${repo}/milestones`,
        "-f",
        `title=${milestoneConfig.name}`,
        "-f",
        `description=${description}`,
        "-f",
        "state=open"
      ])
    );
    milestoneByTitle.set(created.title, created);
    console.log(`Created milestone: ${created.title}`);
  }

  return milestoneByTitle;
}

function listIssues(repo) {
  return JSON.parse(
    runGh([
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "all",
      "--limit",
      "500",
      "--json",
      "number,title,url,labels,milestone"
    ])
  );
}

function issueTypeFromTitle(title) {
  if (title.startsWith("EPIC:")) {
    return "type:epic";
  }
  if (title.startsWith("QA gate:")) {
    return "type:qa";
  }
  if (title.startsWith("Document ")) {
    return "type:chore";
  }
  return "type:feature";
}

function priorityFromTitle(title) {
  if (title.startsWith("EPIC:") || title.startsWith("QA gate:")) {
    return "priority:p1";
  }
  return "priority:p1";
}

function isNorthStarIssue(title) {
  if (title.startsWith("EPIC:") || title.startsWith("QA gate:")) {
    return true;
  }
  return false;
}

function buildTaskBody({ milestoneName, milestoneTitle, parentEpicReference, title }) {
  const lines = [
    `Generated from \`docs/help/help-center-issues.json\`.`,
    "",
    "## Milestone",
    `\`${milestoneName}\` - ${milestoneTitle}`,
    "",
    "## Parent Epic",
    parentEpicReference,
    "",
    "## Goal",
    "Deliver this scope as defined in the Help Center phased roadmap.",
    "",
    "## Acceptance Criteria",
    "- [ ] Implementation is complete and validated.",
    "- [ ] Help content and/or code is updated as needed.",
    "- [ ] Any related tests or checks pass."
  ];

  if (title.startsWith("QA gate:")) {
    lines.push("- [ ] North-star acceptance path criteria are satisfied for this phase.");
  }

  return `${lines.join("\n")}\n`;
}

function buildEpicBody({ milestoneName, milestoneTitle, childIssues }) {
  const lines = [
    `Generated from \`docs/help/help-center-issues.json\`.`,
    "",
    "## Milestone",
    `\`${milestoneName}\` - ${milestoneTitle}`,
    "",
    "## Goal",
    "Complete this phase to progress the Help Center roadmap and north-star outcomes.",
    "",
    "## Child Issues"
  ];

  for (const childIssue of childIssues) {
    lines.push(`- [ ] #${childIssue.number} ${childIssue.title}`);
  }

  lines.push("");
  lines.push("## Exit Criteria");
  lines.push("- [ ] All child issues are completed.");
  lines.push("- [ ] Phase-specific QA gate passes.");
  lines.push("- [ ] Deliverables are merged to main.");

  return `${lines.join("\n")}\n`;
}

function ensureIssue({
  repo,
  title,
  milestoneName,
  milestoneTitle,
  phaseLabel,
  existingIssueByTitle,
  parentEpicReference
}) {
  const typeLabel = issueTypeFromTitle(title);
  const labels = ["area:help-center", phaseLabel, typeLabel, priorityFromTitle(title)];
  if (isNorthStarIssue(title)) {
    labels.push("north-star");
  }

  const body = buildTaskBody({
    milestoneName,
    milestoneTitle,
    parentEpicReference,
    title
  });

  const existing = existingIssueByTitle.get(title);
  if (existing) {
    runGh([
      "issue",
      "edit",
      String(existing.number),
      "--repo",
      repo,
      "--milestone",
      milestoneName,
      "--body",
      body
    ]);

    for (const label of labels) {
      runGh([
        "issue",
        "edit",
        String(existing.number),
        "--repo",
        repo,
        "--add-label",
        label
      ]);
    }

    return existing;
  }

  const createArgs = [
    "issue",
    "create",
    "--repo",
    repo,
    "--title",
    title,
    "--body",
    body,
    "--milestone",
    milestoneName
  ];

  for (const label of labels) {
    createArgs.push("--label", label);
  }

  const createdUrl = runGh(createArgs);
  const created = JSON.parse(
    runGh([
      "issue",
      "view",
      createdUrl,
      "--repo",
      repo,
      "--json",
      "number,title,url"
    ])
  );
  console.log(`Created issue: #${created.number} ${created.title}`);
  existingIssueByTitle.set(created.title, created);
  return created;
}

function updateEpicBody(repo, epicIssueNumber, milestoneName, milestoneTitle, childIssues) {
  const body = buildEpicBody({
    milestoneName,
    milestoneTitle,
    childIssues
  });

  runGh([
    "issue",
    "edit",
    String(epicIssueNumber),
    "--repo",
    repo,
    "--body",
    body
  ]);
}

function ensureRoadmapIssues(repo, config) {
  const existingIssues = listIssues(repo);
  const existingIssueByTitle = new Map(
    existingIssues.map((issue) => [issue.title, issue])
  );

  for (let phaseIndex = 0; phaseIndex < config.milestones.length; phaseIndex += 1) {
    const milestone = config.milestones[phaseIndex];
    const phaseLabel = `phase:${phaseIndex + 1}`;
    const epicTitle = milestone.issues[0];

    let epicIssue = existingIssueByTitle.get(epicTitle);
    if (!epicIssue) {
      epicIssue = ensureIssue({
        repo,
        title: epicTitle,
        milestoneName: milestone.name,
        milestoneTitle: milestone.title,
        phaseLabel,
        existingIssueByTitle,
        parentEpicReference: "_N/A (epic issue)_"
      });
    } else {
      ensureIssue({
        repo,
        title: epicTitle,
        milestoneName: milestone.name,
        milestoneTitle: milestone.title,
        phaseLabel,
        existingIssueByTitle,
        parentEpicReference: "_N/A (epic issue)_"
      });
    }

    const childIssues = [];
    for (const childTitle of milestone.issues.slice(1)) {
      const childIssue = ensureIssue({
        repo,
        title: childTitle,
        milestoneName: milestone.name,
        milestoneTitle: milestone.title,
        phaseLabel,
        existingIssueByTitle,
        parentEpicReference: `#${epicIssue.number}`
      });
      childIssues.push(childIssue);
    }

    updateEpicBody(
      repo,
      epicIssue.number,
      milestone.name,
      milestone.title,
      childIssues
    );
    console.log(
      `Linked epic #${epicIssue.number} with ${childIssues.length} child issue(s) for ${milestone.name}.`
    );
  }
}

function main() {
  const { repo: repoArg, configPath } = parseArgs(process.argv.slice(2));
  const repo = repoArg || inferRepoFromGitRemote();
  const config = readConfig(configPath);

  console.log(`Using repo: ${repo}`);
  console.log(`Using config: ${configPath}`);

  ensureLabels(repo, config.labels);
  ensureMilestones(repo, config.milestones);
  ensureRoadmapIssues(repo, config);

  console.log("Help Center labels, milestones, and issues are up to date.");
}

try {
  main();
} catch (error) {
  console.error(
    `[create-help-center-issues] ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
}
