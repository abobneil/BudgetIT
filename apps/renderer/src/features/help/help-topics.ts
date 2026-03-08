/* AUTO-GENERATED FILE. DO NOT EDIT DIRECTLY.
 * Edit docs/help/help-topics.json and run npm run help:generate.
 */

export type HelpAudience = "both" | "experienced-user" | "new-user";
export type HelpJourneyStep = "analysis" | "import" | "operations" | "orientation" | "reporting" | "setup";

export type HelpTopic = {
  id: string;
  title: string;
  inAppSnippet: string;
  docSection: string;
  defaultAnchor?: string;
  order: number;
  topicFile: string;
  keywords: string[];
  outcomes: string[];
  audience: HelpAudience;
  journeyStep: HelpJourneyStep;
};

export type HelpDefinition = {
  id: string;
  term: string;
  meaning: string;
  appliesTo: string[];
  relatedTopicId: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "quick-start",
    title: "Quick Start",
    inAppSnippet: "Use this first-run guide to learn the dual-window workflow and set up BudgetIT safely.",
    docSection: "Quick Start (First Launch)",
    defaultAnchor: "first-10-minutes",
    order: 10,
    topicFile: "topics/quick-start.md",
    keywords: ["setup", "first launch", "getting started"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Quick Start guidance without leaving the app."],
    audience: "new-user",
    journeyStep: "setup"
  },
  {
    id: "global-keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    inAppSnippet: "Use Ctrl+K for Command Palette, Ctrl+Shift+F for Global Search, and Escape to close dialogs.",
    docSection: "1) App Shell (Global Controls)",
    defaultAnchor: "overview",
    order: 20,
    topicFile: "topics/app-shell.md",
    keywords: ["keyboard", "shortcuts", "navigation", "f1"],
    outcomes: ["Navigate quickly and locate contextual help entry points.", "Apply Keyboard Shortcuts guidance without leaving the app."],
    audience: "experienced-user",
    journeyStep: "orientation"
  },
  {
    id: "dashboard-overview",
    title: "Dashboard",
    inAppSnippet: "Dashboard summarizes forecast, actuals, variance, renewals, and replacement posture by scenario.",
    docSection: "2) Dashboard",
    defaultAnchor: "main-actions",
    order: 30,
    topicFile: "topics/dashboard.md",
    keywords: ["dashboard", "kpi", "variance"],
    outcomes: ["Interpret KPIs, variance, and scenario signals correctly.", "Apply Dashboard guidance without leaving the app."],
    audience: "both",
    journeyStep: "analysis"
  },
  {
    id: "expenses-workspace",
    title: "Expenses Workspace",
    inAppSnippet: "Track expense lines, apply bulk status/tag updates, and maintain recurrence for forecasting.",
    docSection: "3) Expenses Workspace",
    defaultAnchor: "overview",
    order: 40,
    topicFile: "topics/expenses-workspace.md",
    keywords: ["expenses", "workspace", "recurrence", "bulk"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Expenses Workspace guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "expenses-form",
    title: "Expense Form",
    inAppSnippet: "Use this form to create or edit core expense details, links, tags, and recurrence settings.",
    docSection: "3) Expenses Workspace",
    defaultAnchor: "createedit-expense-form",
    order: 41,
    topicFile: "topics/expenses-workspace.md",
    keywords: ["expense form", "create expense", "edit expense"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Expense Form guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "services-workspace",
    title: "Services Workspace",
    inAppSnippet: "Manage service lifecycle, risk, renewals, and replacement state in one view.",
    docSection: "4) Services Workspace",
    defaultAnchor: "overview",
    order: 50,
    topicFile: "topics/services-workspace.md",
    keywords: ["services", "lifecycle", "renewals", "replacement"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Services Workspace guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "services-form",
    title: "Service Form",
    inAppSnippet: "Define service ownership, spend, status, risk, and replacement status.",
    docSection: "4) Services Workspace",
    defaultAnchor: "createedit-service-form",
    order: 51,
    topicFile: "topics/services-workspace.md",
    keywords: ["service form", "owner", "risk"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Service Form guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "contracts-workspace",
    title: "Contracts Workspace",
    inAppSnippet: "Track contract terms, renewal windows, notice periods, and linked services.",
    docSection: "5) Contracts Workspace",
    defaultAnchor: "overview",
    order: 60,
    topicFile: "topics/contracts-workspace.md",
    keywords: ["contracts", "renewal", "notice period"],
    outcomes: ["Run recurring operations with clear status decisions.", "Apply Contracts Workspace guidance without leaving the app."],
    audience: "both",
    journeyStep: "operations"
  },
  {
    id: "contracts-form",
    title: "Contract Form",
    inAppSnippet: "Capture contract identity, dates, renewal strategy, lifecycle status, and owner.",
    docSection: "5) Contracts Workspace",
    defaultAnchor: "createedit-contract-form",
    order: 61,
    topicFile: "topics/contracts-workspace.md",
    keywords: ["contract form", "renewal action", "owner"],
    outcomes: ["Run recurring operations with clear status decisions.", "Apply Contract Form guidance without leaving the app."],
    audience: "both",
    journeyStep: "operations"
  },
  {
    id: "vendors-workspace",
    title: "Vendors Workspace",
    inAppSnippet: "Manage vendor risk and lifecycle with archive/delete guardrails for linked records.",
    docSection: "6) Vendors Workspace",
    defaultAnchor: "overview",
    order: 70,
    topicFile: "topics/vendors-workspace.md",
    keywords: ["vendors", "archive", "delete guardrails"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Vendors Workspace guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "vendors-form",
    title: "Vendor Form",
    inAppSnippet: "Create or edit vendor ownership, spend, status, risk, and optional linked IDs.",
    docSection: "6) Vendors Workspace",
    defaultAnchor: "createedit-vendor-form",
    order: 71,
    topicFile: "topics/vendors-workspace.md",
    keywords: ["vendor form", "risk", "owner"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Vendor Form guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "tags-workspace",
    title: "Tags & Dimensions",
    inAppSnippet: "Define dimensions, create/retire/merge tags, and clear required-tag queue items.",
    docSection: "7) Tags & Dimensions",
    defaultAnchor: "overview",
    order: 80,
    topicFile: "topics/tags-workspace.md",
    keywords: ["tags", "dimensions", "taxonomy"],
    outcomes: ["Complete baseline setup tasks for this workspace.", "Apply Tags & Dimensions guidance without leaving the app."],
    audience: "both",
    journeyStep: "setup"
  },
  {
    id: "scenarios-workspace",
    title: "Scenarios Workspace",
    inAppSnippet: "Select, clone, promote, lock, and compare scenarios to baseline before approval.",
    docSection: "8) Scenarios Workspace",
    defaultAnchor: "overview",
    order: 90,
    topicFile: "topics/scenarios-workspace.md",
    keywords: ["scenarios", "baseline", "compare"],
    outcomes: ["Interpret KPIs, variance, and scenario signals correctly.", "Apply Scenarios Workspace guidance without leaving the app."],
    audience: "both",
    journeyStep: "analysis"
  },
  {
    id: "alerts-inbox",
    title: "Alerts Inbox",
    inAppSnippet: "Triage due-soon, snoozed, and acknowledged alerts, then jump to related entities.",
    docSection: "9) Alerts Inbox",
    defaultAnchor: "overview",
    order: 100,
    topicFile: "topics/alerts-inbox.md",
    keywords: ["alerts", "snooze", "triage"],
    outcomes: ["Run recurring operations with clear status decisions.", "Apply Alerts Inbox guidance without leaving the app."],
    audience: "both",
    journeyStep: "operations"
  },
  {
    id: "import-wizard",
    title: "Import Wizard",
    inAppSnippet: "Follow mode, file, mapping, preview, and commit steps for controlled data imports.",
    docSection: "10) Import Wizard",
    defaultAnchor: "5-steps",
    order: 110,
    topicFile: "topics/import-wizard.md",
    keywords: ["import", "actuals", "mapping", "preview"],
    outcomes: ["Import data safely and resolve validation outcomes.", "Apply Import Wizard guidance without leaving the app."],
    audience: "both",
    journeyStep: "import"
  },
  {
    id: "reports-workspace",
    title: "Reports Workspace",
    inAppSnippet: "Use report presets, filters, preview, export queue, unmatched actuals review, and showback.",
    docSection: "11) Reports Workspace",
    defaultAnchor: "report-gallery",
    order: 120,
    topicFile: "topics/reports-workspace.md",
    keywords: ["reports", "export", "showback", "unmatched actuals"],
    outcomes: ["Produce report outputs with the right audience framing.", "Apply Reports Workspace guidance without leaving the app."],
    audience: "both",
    journeyStep: "reporting"
  },
  {
    id: "nlq-workspace",
    title: "NLQ Workspace",
    inAppSnippet: "Ask plain-language budgeting questions, inspect parsed filters, then export or save presets.",
    docSection: "12) NLQ Workspace",
    defaultAnchor: "overview",
    order: 130,
    topicFile: "topics/nlq-workspace.md",
    keywords: ["nlq", "natural language", "query"],
    outcomes: ["Interpret KPIs, variance, and scenario signals correctly.", "Apply NLQ Workspace guidance without leaving the app."],
    audience: "experienced-user",
    journeyStep: "analysis"
  },
  {
    id: "settings-center",
    title: "Settings Center",
    inAppSnippet: "Configure runtime behavior, notifications, backup/restore, security, maintenance, and evidence.",
    docSection: "13) Settings Center",
    defaultAnchor: "runtime",
    order: 140,
    topicFile: "topics/settings-center.md",
    keywords: ["settings", "backup", "security", "maintenance"],
    outcomes: ["Run recurring operations with clear status decisions.", "Apply Settings Center guidance without leaving the app."],
    audience: "both",
    journeyStep: "operations"
  },
  {
    id: "developer-tools",
    title: "Developer Tools",
    inAppSnippet: "Review what remains in the retired developer workspace and where to go for supported diagnostics.",
    docSection: "14) Developer Tools",
    defaultAnchor: "overview",
    order: 150,
    topicFile: "topics/developer-tools.md",
    keywords: ["developer", "diagnostics", "retired workspace"],
    outcomes: ["Understand the limited scope of the developer workspace.", "Apply Developer Tools guidance without leaving the app."],
    audience: "experienced-user",
    journeyStep: "operations"
  }
];

export const DEFAULT_HELP_TOPIC_ID = "quick-start";

const HELP_TOPIC_MAP = new Map<string, HelpTopic>(
  HELP_TOPICS.map((topic) => [topic.id, topic])
);

export function resolveHelpTopic(topicId: string | null | undefined): HelpTopic {
  if (topicId && HELP_TOPIC_MAP.has(topicId)) {
    return HELP_TOPIC_MAP.get(topicId)!;
  }
  return HELP_TOPIC_MAP.get(DEFAULT_HELP_TOPIC_ID)!;
}

export function buildHelpHashPath(payload?: {
  topic?: string;
  anchor?: string;
  q?: string;
  context?: string;
}): string {
  const params = new URLSearchParams();
  const topic = payload?.topic?.trim();
  const anchor = payload?.anchor?.trim();
  const q = payload?.q?.trim();
  const context = payload?.context?.trim();
  if (topic) {
    params.set("topic", topic);
  }
  if (anchor) {
    params.set("anchor", anchor);
  }
  if (q) {
    params.set("q", q);
  }
  if (context) {
    params.set("context", context);
  }
  const query = params.toString();
  return query ? `/help?${query}` : "/help";
}
