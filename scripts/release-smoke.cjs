const fs = require("node:fs");
const path = require("node:path");

const rootDir = process.cwd();

function parseArguments(argv) {
  let platform = "all";
  let arch = "all";

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument.startsWith("--platform=")) {
      platform = argument.slice("--platform=".length);
      continue;
    }

    if (argument === "--platform") {
      const nextArgument = argv[index + 1];
      if (!nextArgument || nextArgument.startsWith("-")) {
        throw new Error("Missing value for --platform. Use win, linux, or all.");
      }
      platform = nextArgument;
      index += 1;
      continue;
    }

    if (argument.startsWith("--arch=")) {
      arch = argument.slice("--arch=".length);
      continue;
    }

    if (argument === "--arch") {
      const nextArgument = argv[index + 1];
      if (!nextArgument || nextArgument.startsWith("-")) {
        throw new Error("Missing value for --arch. Use x64, arm64, or all.");
      }
      arch = nextArgument;
      index += 1;
    }
  }

  const validPlatforms = new Set(["win", "linux", "all"]);
  if (!validPlatforms.has(platform)) {
    throw new Error(`Unsupported --platform value "${platform}". Use win, linux, or all.`);
  }

  const validArchitectures = new Set(["x64", "arm64", "all"]);
  if (!validArchitectures.has(arch)) {
    throw new Error(`Unsupported --arch value "${arch}". Use x64, arm64, or all.`);
  }

  return { platform, arch };
}

function getPackageVersion() {
  const packageJsonPath = path.join(rootDir, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  if (typeof packageJson.version !== "string" || packageJson.version.trim().length === 0) {
    throw new Error("package.json version is missing or invalid.");
  }
  return packageJson.version.trim();
}

function buildArchitectureList(selected) {
  return selected === "all" ? ["x64", "arm64"] : [selected];
}

function assertArtifactsExist(version, platform, arch) {
  const requiredArtifacts = [];
  const selectedArchitectures = buildArchitectureList(arch);

  if (platform === "win" || platform === "all") {
    for (const architecture of selectedArchitectures) {
      requiredArtifacts.push(
        path.join(rootDir, "dist", "release", `BudgetIT-Setup-${version}-${architecture}.exe`)
      );
    }
  }

  if (platform === "linux" || platform === "all") {
    for (const architecture of selectedArchitectures) {
      requiredArtifacts.push(
        path.join(rootDir, "dist", "release", `BudgetIT-${version}-linux-${architecture}.AppImage`)
      );
      requiredArtifacts.push(
        path.join(rootDir, "dist", "release", `BudgetIT-${version}-linux-${architecture}.deb`)
      );
    }
  }

  for (const artifactPath of requiredArtifacts) {
    if (!fs.existsSync(artifactPath)) {
      throw new Error(`Expected installer artifact missing: ${artifactPath}`);
    }
  }
}

function assertDocumentationSections(platform) {
  const requiredDocs = [
    path.join(rootDir, "docs", "release-hardening.md"),
    path.join(rootDir, "docs", "operations-runbook.md")
  ];

  for (const docPath of requiredDocs) {
    if (!fs.existsSync(docPath)) {
      throw new Error(`Required release doc missing: ${docPath}`);
    }
  }

  const releaseDoc = fs.readFileSync(requiredDocs[0], "utf8");
  const runbookDoc = fs.readFileSync(requiredDocs[1], "utf8");

  const releaseSections = ["## Packaging QA", "## Startup Defaults and Overrides", "## Rollback Notes"];
  const runbookSections = ["## Backup", "## Recovery Key", "## Restore", "## Rollback Dry-Run"];

  if (platform === "win" || platform === "all") {
    releaseSections.push("## Windows ARM64 Runtime QA (Manual)");
    runbookSections.push("## Windows ARM64 Release Validation (Manual)");
  }

  if (platform === "linux" || platform === "all") {
    releaseSections.push("## Linux Runtime QA (Manual)");
    runbookSections.push("## Linux Runtime Validation (Manual)");
  }

  for (const section of releaseSections) {
    if (!releaseDoc.includes(section)) {
      throw new Error(`Missing section in docs/release-hardening.md: ${section}`);
    }
  }

  for (const section of runbookSections) {
    if (!runbookDoc.includes(section)) {
      throw new Error(`Missing section in docs/operations-runbook.md: ${section}`);
    }
  }
}

function run() {
  const { platform, arch } = parseArguments(process.argv.slice(2));
  const version = getPackageVersion();
  console.log(
    `[release-smoke] validating packaged artifacts for platform=${platform}, arch=${arch}, version=${version}`
  );

  assertArtifactsExist(version, platform, arch);
  assertDocumentationSections(platform);
  console.log("[release-smoke] packaged smoke checks passed.");
}

try {
  run();
} catch (error) {
  console.error("[release-smoke] failed", error);
  process.exitCode = 1;
}
