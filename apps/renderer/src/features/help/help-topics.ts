export type HelpTopic = {
  id: string;
  title: string;
  inAppSnippet: string;
  docSection: string;
};

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "quick-start",
    title: "Quick Start",
    inAppSnippet:
      "Use this first-run guide to learn the dual-window workflow and set up BudgetIT safely.",
    docSection: "Quick Start (First Launch)"
  },
  {
    id: "global-keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    inAppSnippet:
      "Use Ctrl+K for Command Palette, Ctrl+Shift+F for Global Search, and Escape to close dialogs.",
    docSection: "1) App Shell (Global Controls)"
  },
  {
    id: "dashboard-overview",
    title: "Dashboard",
    inAppSnippet:
      "Dashboard summarizes forecast, actuals, variance, renewals, and replacement posture by scenario.",
    docSection: "2) Dashboard"
  },
  {
    id: "expenses-workspace",
    title: "Expenses Workspace",
    inAppSnippet:
      "Track expense lines, apply bulk status/tag updates, and maintain recurrence for forecasting.",
    docSection: "3) Expenses Workspace"
  },
  {
    id: "expenses-form",
    title: "Expense Form",
    inAppSnippet:
      "Use this form to create or edit core expense details, links, tags, and recurrence settings.",
    docSection: "3) Expenses Workspace"
  },
  {
    id: "services-workspace",
    title: "Services Workspace",
    inAppSnippet:
      "Manage service lifecycle, risk, renewals, and replacement state in one view.",
    docSection: "4) Services Workspace"
  },
  {
    id: "services-form",
    title: "Service Form",
    inAppSnippet:
      "Define service ownership, spend, status, risk, and replacement status.",
    docSection: "4) Services Workspace"
  },
  {
    id: "contracts-workspace",
    title: "Contracts Workspace",
    inAppSnippet:
      "Track contract terms, renewal windows, notice periods, and linked services.",
    docSection: "5) Contracts Workspace"
  },
  {
    id: "contracts-form",
    title: "Contract Form",
    inAppSnippet:
      "Capture contract identity, dates, renewal strategy, lifecycle status, and owner.",
    docSection: "5) Contracts Workspace"
  },
  {
    id: "vendors-workspace",
    title: "Vendors Workspace",
    inAppSnippet:
      "Manage vendor risk and lifecycle with archive/delete guardrails for linked records.",
    docSection: "6) Vendors Workspace"
  },
  {
    id: "vendors-form",
    title: "Vendor Form",
    inAppSnippet:
      "Create or edit vendor ownership, spend, status, risk, and optional linked IDs.",
    docSection: "6) Vendors Workspace"
  },
  {
    id: "tags-workspace",
    title: "Tags & Dimensions",
    inAppSnippet:
      "Define dimensions, create/retire/merge tags, and clear required-tag queue items.",
    docSection: "7) Tags & Dimensions"
  },
  {
    id: "scenarios-workspace",
    title: "Scenarios Workspace",
    inAppSnippet:
      "Select, clone, promote, lock, and compare scenarios to baseline before approval.",
    docSection: "8) Scenarios Workspace"
  },
  {
    id: "alerts-inbox",
    title: "Alerts Inbox",
    inAppSnippet:
      "Triage due-soon, snoozed, and acknowledged alerts, then jump to related entities.",
    docSection: "9) Alerts Inbox"
  },
  {
    id: "import-wizard",
    title: "Import Wizard",
    inAppSnippet:
      "Follow mode, file, mapping, preview, and commit steps for controlled data imports.",
    docSection: "10) Import Wizard"
  },
  {
    id: "reports-workspace",
    title: "Reports Workspace",
    inAppSnippet:
      "Use report presets, filters, preview, export queue, unmatched actuals review, and showback.",
    docSection: "11) Reports Workspace"
  },
  {
    id: "nlq-workspace",
    title: "NLQ Workspace",
    inAppSnippet:
      "Ask plain-language budgeting questions, inspect parsed filters, then export or save presets.",
    docSection: "12) NLQ Workspace"
  },
  {
    id: "settings-center",
    title: "Settings Center",
    inAppSnippet:
      "Configure runtime behavior, notifications, backup/restore, security, maintenance, and evidence.",
    docSection: "13) Settings Center"
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
}): string {
  const params = new URLSearchParams();
  const topic = payload?.topic?.trim();
  const anchor = payload?.anchor?.trim();
  if (topic) {
    params.set("topic", topic);
  }
  if (anchor) {
    params.set("anchor", anchor);
  }
  const query = params.toString();
  return query ? `/help?${query}` : "/help";
}

