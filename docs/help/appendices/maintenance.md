## Help Document Maintenance Notes
- Do not edit generated files directly:
  - `docs/help-system.md`
  - `apps/renderer/src/features/help/help-topics.ts`
- Update help source files instead:
  - `docs/help/help-topics.json`
  - `docs/help/topics/*.md`
  - `docs/help/intro.md`
  - `docs/help/appendices/*.md`
- After edits, regenerate and validate:
  - `npm run help:generate`
  - `npm run help:check`
- Keep shortcut and menu wording aligned with implemented behavior in:
  - `apps/renderer/src/app/AppShell.tsx`
  - `apps/desktop/src/main.ts`

## PR Maintenance Checklist
1. Update source help files only (`docs/help/**` source-of-truth files).
2. Run `npm run help:generate`.
3. Run `npm run help:check`.
4. Commit source + generated outputs together.
5. Ensure CI status checks are green before merge.

## Required Status Check Enforcement
For `main` branch protection, require at minimum:
- `Help Integrity`
- `Lint, Typecheck, Test, Build`

If repository rules are managed via GitHub UI:
1. Open **Settings > Branches > Branch protection rules**.
2. Edit rule for `main`.
3. Enable **Require status checks to pass before merging**.
4. Select both checks above and save.
