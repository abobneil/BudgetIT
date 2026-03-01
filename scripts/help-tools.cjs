const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = process.cwd();
const HELP_DIR = path.join(ROOT_DIR, "docs", "help");
const MANIFEST_PATH = path.join(HELP_DIR, "help-topics.json");
const HELP_DOC_OUTPUT_PATH = path.join(ROOT_DIR, "docs", "help-system.md");
const HELP_TOPICS_TS_OUTPUT_PATH = path.join(
  ROOT_DIR,
  "apps",
  "renderer",
  "src",
  "features",
  "help",
  "help-topics.ts"
);

const ALLOWED_AUDIENCES = new Set(["new-user", "experienced-user", "both"]);
const ALLOWED_JOURNEY_STEPS = new Set([
  "orientation",
  "setup",
  "import",
  "analysis",
  "reporting",
  "operations",
  "reference"
]);

function fail(message) {
  throw new Error(message);
}

function normalizeToPosix(value) {
  return value.split(path.sep).join("/");
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeTextFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf8");
}

function normalizeLineEndings(value) {
  return value.replace(/\r\n/g, "\n");
}

function parseManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    fail(`Manifest not found: ${MANIFEST_PATH}`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readTextFile(MANIFEST_PATH));
  } catch (error) {
    fail(`Failed to parse ${MANIFEST_PATH}: ${error instanceof Error ? error.message : String(error)}`);
  }

  validateManifest(manifest);
  return manifest;
}

function resolveHelpRelativePath(relativePath) {
  const resolvedPath = path.resolve(HELP_DIR, relativePath);
  const relativeToHelp = path.relative(HELP_DIR, resolvedPath);
  const escapesHelpDir =
    relativeToHelp.startsWith("..") || path.isAbsolute(relativeToHelp);
  if (escapesHelpDir) {
    fail(`Path escapes docs/help: ${relativePath}`);
  }
  return resolvedPath;
}

function assertString(value, label) {
  if (typeof value !== "string" || value.trim().length === 0) {
    fail(`${label} must be a non-empty string.`);
  }
}

function validateManifest(manifest) {
  if (!manifest || typeof manifest !== "object") {
    fail("Manifest root must be an object.");
  }

  const document = manifest.document;
  if (!document || typeof document !== "object") {
    fail("Manifest.document must be an object.");
  }

  assertString(document.title, "document.title");
  assertString(document.introFile, "document.introFile");
  assertString(document.featureHeading, "document.featureHeading");
  if (!Array.isArray(document.appendixFiles)) {
    fail("document.appendixFiles must be an array.");
  }

  for (const appendixFile of document.appendixFiles) {
    assertString(appendixFile, "document.appendixFiles[]");
    const appendixPath = resolveHelpRelativePath(appendixFile);
    if (!fs.existsSync(appendixPath)) {
      fail(`Appendix file not found: ${appendixFile}`);
    }
  }

  const introPath = resolveHelpRelativePath(document.introFile);
  if (!fs.existsSync(introPath)) {
    fail(`Intro file not found: ${document.introFile}`);
  }

  if (!Array.isArray(manifest.topics) || manifest.topics.length === 0) {
    fail("Manifest.topics must be a non-empty array.");
  }

  const idSet = new Set();
  const orderSet = new Set();
  const sectionFileMap = new Map();

  for (const topic of manifest.topics) {
    if (!topic || typeof topic !== "object") {
      fail("Each topic entry must be an object.");
    }

    assertString(topic.id, "topic.id");
    assertString(topic.title, "topic.title");
    assertString(topic.inAppSnippet, "topic.inAppSnippet");
    assertString(topic.docSection, "topic.docSection");
    assertString(topic.topicFile, "topic.topicFile");

    if (!/^[a-z0-9-]+$/.test(topic.id)) {
      fail(`Invalid topic.id "${topic.id}". Use lowercase kebab-case.`);
    }

    if (!Number.isInteger(topic.order)) {
      fail(`topic.order must be an integer for topic "${topic.id}".`);
    }

    if (!Array.isArray(topic.keywords)) {
      fail(`topic.keywords must be an array for topic "${topic.id}".`);
    }
    if (topic.keywords.length === 0) {
      fail(`topic.keywords must include at least one keyword for topic "${topic.id}".`);
    }
    for (const keyword of topic.keywords) {
      assertString(keyword, `topic.keywords[] for topic "${topic.id}"`);
    }

    assertString(topic.audience, `topic.audience for topic "${topic.id}"`);
    if (!ALLOWED_AUDIENCES.has(topic.audience)) {
      fail(
        `Unsupported audience "${topic.audience}" for topic "${topic.id}". Allowed: ${Array.from(
          ALLOWED_AUDIENCES
        ).join(", ")}`
      );
    }

    assertString(topic.journeyStep, `topic.journeyStep for topic "${topic.id}"`);
    if (!ALLOWED_JOURNEY_STEPS.has(topic.journeyStep)) {
      fail(
        `Unsupported journeyStep "${topic.journeyStep}" for topic "${topic.id}". Allowed: ${Array.from(
          ALLOWED_JOURNEY_STEPS
        ).join(", ")}`
      );
    }

    if (idSet.has(topic.id)) {
      fail(`Duplicate topic id: ${topic.id}`);
    }
    idSet.add(topic.id);

    if (orderSet.has(topic.order)) {
      fail(`Duplicate topic order: ${topic.order}`);
    }
    orderSet.add(topic.order);

    const topicFilePath = resolveHelpRelativePath(topic.topicFile);
    if (!fs.existsSync(topicFilePath)) {
      fail(`Topic file not found for "${topic.id}": ${topic.topicFile}`);
    }

    const existingFileForSection = sectionFileMap.get(topic.docSection);
    if (existingFileForSection && existingFileForSection !== topic.topicFile) {
      fail(
        `docSection "${topic.docSection}" is mapped to multiple topic files: ` +
          `"${existingFileForSection}" and "${topic.topicFile}".`
      );
    }
    sectionFileMap.set(topic.docSection, topic.topicFile);
  }
}

function sortTopics(topics) {
  return [...topics].sort((left, right) => left.order - right.order);
}

function buildTopicSections(sortedTopics) {
  const sectionsByHeading = new Map();

  for (const topic of sortedTopics) {
    if (!sectionsByHeading.has(topic.docSection)) {
      sectionsByHeading.set(topic.docSection, {
        heading: topic.docSection,
        topicFile: topic.topicFile,
        order: topic.order
      });
      continue;
    }

    const existing = sectionsByHeading.get(topic.docSection);
    if (existing.topicFile !== topic.topicFile) {
      fail(
        `docSection "${topic.docSection}" has conflicting topic files: ` +
          `"${existing.topicFile}" and "${topic.topicFile}".`
      );
    }
  }

  return [...sectionsByHeading.values()].sort((left, right) => left.order - right.order);
}

function generateHelpDocument(manifest) {
  const sortedTopics = sortTopics(manifest.topics);
  const topicSections = buildTopicSections(sortedTopics);
  const introText = readTextFile(resolveHelpRelativePath(manifest.document.introFile)).trim();

  const parts = [
    "<!-- AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY. -->",
    "<!-- Edit docs/help/help-topics.json and docs/help/topics/*.md, then run npm run help:generate. -->",
    "",
    `# ${manifest.document.title}`,
    "",
    introText,
    "",
    `## ${manifest.document.featureHeading}`,
    ""
  ];

  for (const section of topicSections) {
    const sectionBody = readTextFile(resolveHelpRelativePath(section.topicFile)).trim();
    parts.push(`## ${section.heading}`);
    if (sectionBody.length > 0) {
      parts.push(sectionBody);
    }
    parts.push("");
  }

  for (const appendixFile of manifest.document.appendixFiles) {
    const appendixText = readTextFile(resolveHelpRelativePath(appendixFile)).trim();
    if (appendixText.length === 0) {
      continue;
    }
    parts.push(appendixText);
    parts.push("");
  }

  return `${parts.join("\n").trim()}\n`;
}

function escapeTsString(value) {
  return JSON.stringify(value);
}

function buildUnionType(values) {
  return values.map((value) => escapeTsString(value)).join(" | ");
}

function renderTopicForTs(topic) {
  const renderedKeywords = topic.keywords.map((keyword) => escapeTsString(keyword)).join(", ");
  return [
    "  {",
    `    id: ${escapeTsString(topic.id)},`,
    `    title: ${escapeTsString(topic.title)},`,
    `    inAppSnippet: ${escapeTsString(topic.inAppSnippet)},`,
    `    docSection: ${escapeTsString(topic.docSection)},`,
    `    order: ${topic.order},`,
    `    topicFile: ${escapeTsString(topic.topicFile)},`,
    `    keywords: [${renderedKeywords}],`,
    `    audience: ${escapeTsString(topic.audience)},`,
    `    journeyStep: ${escapeTsString(topic.journeyStep)}`,
    "  }"
  ].join("\n");
}

function generateHelpTopicsTs(manifest) {
  const sortedTopics = sortTopics(manifest.topics);
  const audiences = [...new Set(sortedTopics.map((topic) => topic.audience))].sort();
  const journeySteps = [...new Set(sortedTopics.map((topic) => topic.journeyStep))].sort();
  const renderedTopics = sortedTopics.map((topic) => renderTopicForTs(topic)).join(",\n");

  return [
    "/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.",
    " * Edit docs/help/help-topics.json and run npm run help:generate.",
    " */",
    "",
    `export type HelpAudience = ${buildUnionType(audiences)};`,
    `export type HelpJourneyStep = ${buildUnionType(journeySteps)};`,
    "",
    "export type HelpTopic = {",
    "  id: string;",
    "  title: string;",
    "  inAppSnippet: string;",
    "  docSection: string;",
    "  order: number;",
    "  topicFile: string;",
    "  keywords: string[];",
    "  audience: HelpAudience;",
    "  journeyStep: HelpJourneyStep;",
    "};",
    "",
    "export const HELP_TOPICS: HelpTopic[] = [",
    renderedTopics,
    "];",
    "",
    'export const DEFAULT_HELP_TOPIC_ID = "quick-start";',
    "",
    "const HELP_TOPIC_MAP = new Map<string, HelpTopic>(",
    "  HELP_TOPICS.map((topic) => [topic.id, topic])",
    ");",
    "",
    "export function resolveHelpTopic(topicId: string | null | undefined): HelpTopic {",
    "  if (topicId && HELP_TOPIC_MAP.has(topicId)) {",
    "    return HELP_TOPIC_MAP.get(topicId)!;",
    "  }",
    "  return HELP_TOPIC_MAP.get(DEFAULT_HELP_TOPIC_ID)!;",
    "}",
    "",
    "export function buildHelpHashPath(payload?: {",
    "  topic?: string;",
    "  anchor?: string;",
    "}): string {",
    "  const params = new URLSearchParams();",
    "  const topic = payload?.topic?.trim();",
    "  const anchor = payload?.anchor?.trim();",
    "  if (topic) {",
    '    params.set("topic", topic);',
    "  }",
    "  if (anchor) {",
    '    params.set("anchor", anchor);',
    "  }",
    "  const query = params.toString();",
    '  return query ? `/help?${query}` : "/help";',
    "}",
    ""
  ].join("\n");
}

function buildGeneratedArtifacts(manifest) {
  return {
    helpDocument: generateHelpDocument(manifest),
    helpTopicsTs: generateHelpTopicsTs(manifest)
  };
}

function writeGeneratedArtifacts(artifacts) {
  writeTextFile(HELP_DOC_OUTPUT_PATH, artifacts.helpDocument);
  writeTextFile(HELP_TOPICS_TS_OUTPUT_PATH, artifacts.helpTopicsTs);
}

function extractTopLevelHeadings(markdown) {
  const headingMatches = markdown.match(/^##\s+(.+)$/gm) ?? [];
  return headingMatches.map((line) => line.replace(/^##\s+/, "").trim());
}

function listMarkdownFilesRecursively(directoryPath) {
  if (!fs.existsSync(directoryPath)) {
    return [];
  }

  const results = [];
  const entries = fs.readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMarkdownFilesRecursively(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      results.push(fullPath);
    }
  }
  return results;
}

function checkForOrphanTopicFiles(manifest) {
  const topicsDirectoryPath = path.join(HELP_DIR, "topics");
  const actualTopicFiles = listMarkdownFilesRecursively(topicsDirectoryPath).map((filePath) =>
    normalizeToPosix(path.relative(HELP_DIR, filePath))
  );
  const referencedTopicFiles = new Set(
    manifest.topics.map((topic) => normalizeToPosix(topic.topicFile))
  );

  const orphanFiles = actualTopicFiles.filter((filePath) => !referencedTopicFiles.has(filePath));
  if (orphanFiles.length > 0) {
    fail(
      "Orphan topic markdown files found (not referenced in docs/help/help-topics.json):\n" +
        orphanFiles.map((filePath) => `- ${filePath}`).join("\n")
    );
  }
}

function checkGeneratedArtifacts(manifest, artifacts) {
  checkForOrphanTopicFiles(manifest);

  const generatedHeadings = extractTopLevelHeadings(artifacts.helpDocument);
  for (const topic of manifest.topics) {
    if (!generatedHeadings.includes(topic.docSection)) {
      fail(`Topic "${topic.id}" points to missing heading: ## ${topic.docSection}`);
    }
  }

  if (!fs.existsSync(HELP_DOC_OUTPUT_PATH)) {
    fail(`Missing generated file: ${HELP_DOC_OUTPUT_PATH}`);
  }
  if (!fs.existsSync(HELP_TOPICS_TS_OUTPUT_PATH)) {
    fail(`Missing generated file: ${HELP_TOPICS_TS_OUTPUT_PATH}`);
  }

  const currentHelpDoc = readTextFile(HELP_DOC_OUTPUT_PATH);
  const currentHelpTopicsTs = readTextFile(HELP_TOPICS_TS_OUTPUT_PATH);

  if (normalizeLineEndings(currentHelpDoc) !== normalizeLineEndings(artifacts.helpDocument)) {
    fail(
      "Generated docs/help-system.md is out of date. Run: npm run help:generate"
    );
  }
  if (
    normalizeLineEndings(currentHelpTopicsTs) !==
    normalizeLineEndings(artifacts.helpTopicsTs)
  ) {
    fail(
      "Generated apps/renderer/src/features/help/help-topics.ts is out of date. Run: npm run help:generate"
    );
  }
}

function parseFlagValue(argv, flagName) {
  const inlinePrefix = `--${flagName}=`;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument.startsWith(inlinePrefix)) {
      return argument.slice(inlinePrefix.length);
    }
    if (argument === `--${flagName}`) {
      const nextValue = argv[index + 1];
      if (!nextValue || nextValue.startsWith("--")) {
        fail(`Missing value for --${flagName}`);
      }
      return nextValue;
    }
  }
  return null;
}

function handleGenerate() {
  const manifest = parseManifest();
  const artifacts = buildGeneratedArtifacts(manifest);
  writeGeneratedArtifacts(artifacts);
  console.log("[help-tools] Generated docs/help-system.md and help-topics.ts");
}

function handleCheck() {
  const manifest = parseManifest();
  const artifacts = buildGeneratedArtifacts(manifest);
  checkGeneratedArtifacts(manifest, artifacts);
  console.log("[help-tools] Help integrity checks passed.");
}

function handleNewTopic(argv) {
  const id = parseFlagValue(argv, "id");
  const title = parseFlagValue(argv, "title");
  const inAppSnippet =
    parseFlagValue(argv, "snippet") ??
    "TODO: add an in-app snippet for this topic.";
  const audience = parseFlagValue(argv, "audience") ?? "both";
  const journeyStep = parseFlagValue(argv, "journey-step") ?? "reference";
  const docSection = parseFlagValue(argv, "doc-section") ?? title;
  const keywordsRaw = parseFlagValue(argv, "keywords");

  if (!id) {
    fail("Missing required --id for new-topic.");
  }
  if (!title) {
    fail("Missing required --title for new-topic.");
  }
  if (!/^[a-z0-9-]+$/.test(id)) {
    fail('Topic id must be lowercase kebab-case (example: "forecast-health").');
  }
  if (!ALLOWED_AUDIENCES.has(audience)) {
    fail(
      `Unsupported audience "${audience}". Allowed: ${Array.from(ALLOWED_AUDIENCES).join(", ")}`
    );
  }
  if (!ALLOWED_JOURNEY_STEPS.has(journeyStep)) {
    fail(
      `Unsupported journey-step "${journeyStep}". Allowed: ${Array.from(ALLOWED_JOURNEY_STEPS).join(
        ", "
      )}`
    );
  }
  if (typeof docSection !== "string" || docSection.trim().length === 0) {
    fail("--doc-section must be a non-empty string.");
  }

  const manifest = parseManifest();
  if (manifest.topics.some((topic) => topic.id === id)) {
    fail(`Topic id already exists: ${id}`);
  }

  const topicFile = `topics/${id}.md`;
  const topicFilePath = resolveHelpRelativePath(topicFile);
  if (fs.existsSync(topicFilePath)) {
    fail(`Topic markdown file already exists: ${topicFile}`);
  }

  const keywords =
    keywordsRaw && keywordsRaw.trim().length > 0
      ? keywordsRaw
          .split(",")
          .map((value) => value.trim())
          .filter((value) => value.length > 0)
      : id.split("-").filter((value) => value.length > 0);

  const maxOrder = Math.max(...manifest.topics.map((topic) => topic.order), 0);
  const nextOrder = maxOrder + 1;

  writeTextFile(
    topicFilePath,
    [
      "### Overview",
      "- TODO: Add topic overview.",
      "",
      "### Main actions",
      "- TODO: Add key actions and decisions.",
      "",
      "### Related links",
      "- TODO: Add related route and anchor references.",
      ""
    ].join("\n")
  );

  manifest.topics.push({
    id,
    title,
    inAppSnippet,
    docSection: docSection.trim(),
    order: nextOrder,
    topicFile: normalizeToPosix(topicFile),
    keywords,
    audience,
    journeyStep
  });

  manifest.topics = sortTopics(manifest.topics);
  writeTextFile(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);

  const artifacts = buildGeneratedArtifacts(manifest);
  writeGeneratedArtifacts(artifacts);
  console.log(`[help-tools] Added topic "${id}" and regenerated help outputs.`);
}

function printUsage() {
  console.log(
    [
      "Usage:",
      "  node scripts/help-tools.cjs generate",
      "  node scripts/help-tools.cjs check",
      "  node scripts/help-tools.cjs new-topic --id <id> --title <title> [--doc-section <heading>] [--snippet <text>] [--audience new-user|experienced-user|both] [--journey-step orientation|setup|import|analysis|reporting|operations|reference] [--keywords k1,k2]"
    ].join("\n")
  );
}

function main() {
  const [command, ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case "generate":
        handleGenerate();
        break;
      case "check":
        handleCheck();
        break;
      case "new-topic":
        handleNewTopic(args);
        break;
      default:
        printUsage();
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[help-tools] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
