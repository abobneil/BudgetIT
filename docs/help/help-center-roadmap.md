# Help Center Roadmap Backlog

This file is the implementation-ready issue backlog for the Help Center deep dive.

## Tracking Model

- Milestones: `HC-P1` through `HC-P7` (sequential).
- Labels:
  - `area:help-center`
  - `phase:1` through `phase:7`
  - `type:epic`, `type:feature`, `type:qa`, `type:chore`
  - `priority:p1`, `priority:p2`
  - `north-star`
- Each milestone contains 5 issues:
  - 1 epic
  - 4 execution issues

## HC-P1: IA + Repeatable Authoring Pipeline

1. `EPIC: HC-P1 Help IA and Authoring System`
2. `Define manifest schema and topic-file conventions (source of truth)`
3. `Implement help generator to produce help-system.md and help-topics.ts`
4. `Implement new-topic scaffolder command for repeatable updates`
5. `QA gate: generated outputs stable and no manual-only edit path remains`

## HC-P2: New User Baseline Setup Journey

1. `EPIC: HC-P2 Baseline Setup Journey`
2. `Author setup checklist content for vendors/services/contracts/expenses/dimensions`
3. `Add in-app journey links for first-session progression`
4. `Add checklist completion state (local persistence)`
5. `QA gate: new user completes baseline setup without external docs`

## HC-P3: Import Actuals + Reconcile Journey

1. `EPIC: HC-P3 Import and Reconciliation`
2. `Author import and reconciliation playbook content`
3. `Add glossary definitions for statuses and match outcomes`
4. `Add contextual help links from Import and Reports reconciliation surfaces`
5. `QA gate: import/reconcile walkthrough passes end-to-end`

## HC-P4: Dashboard + Variance Interpretation

1. `EPIC: HC-P4 Dashboard Interpretation`
2. `Document KPI and variance definitions aligned to app behavior`
3. `Author variance triage workflow (diagnose and next action)`
4. `Add card-level help deep links for dashboard surfaces`
5. `QA gate: first-time user interprets dashboard and variance correctly`

## HC-P5: Executive Export + Operating Rhythm

1. `EPIC: HC-P5 Reporting and Operating Cadence`
2. `Author executive export playbook`
3. `Author weekly/monthly operating checklist content`
4. `Add report page shortcuts to export and narrative sections`
5. `QA gate: user produces executive export and follows recurring cadence`

## HC-P6: Experienced User Speed Layer

1. `EPIC: HC-P6 Findability and Contextual Delivery`
2. `Implement help search/jump index from generated help assets`
3. `Add F1/command-palette seeded navigation to topic+anchor`
4. `Add contextual field/status definitions for high-friction screens`
5. `QA gate: experienced user finds definition/status/field meaning in <30s`

## HC-P7: Help Integrity + CI Governance

1. `EPIC: HC-P7 Help Integrity and Enforcement`
2. `Implement help integrity checker (topic->heading, unique IDs, orphan checks)`
3. `Implement drift checker (fail if generated files differ from committed state)`
4. `Wire help:check into CI quality workflow`
5. `Document maintenance workflow and enforce required status check`

