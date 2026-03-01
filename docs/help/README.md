# Help Authoring System

BudgetIT help content is maintained through source files and generated outputs.

## Source Of Truth

- `docs/help/help-topics.json`
- `docs/help/help-topics.schema.json`
- `docs/help/intro.md`
- `docs/help/topics/*.md`
- `docs/help/appendices/*.md`

## Generated Files

- `docs/help-system.md`
- `apps/renderer/src/features/help/help-topics.ts`

## Commands

```bash
# Regenerate help outputs after source edits
npm run help:generate

# Validate mapping + generated drift + orphan topic files
npm run help:check

# Scaffold a new help topic and regenerate outputs
npm run help:new-topic -- --id your-topic-id --title "Your Topic Title"

# Create/update labels, milestones, and roadmap issues in GitHub
npm run help:issues:create
```

## Update Workflow

1. Edit the source-of-truth files.
2. Run `npm run help:generate`.
3. Run `npm run help:check`.
4. Commit source + generated files together.

## Acceptance Scenarios

See `docs/help/north-star-acceptance.md` for manual validation of new-user and experienced-user flows.
