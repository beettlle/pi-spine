# CONTEXT.md Template (spine)

`spine init` scaffolds `{tasksRoot}/CONTEXT.md` (see SP-053). Use this shape when creating or refreshing project context manually.

Keep it slim — workers load it when referenced from PROMPT.md.

---

See also: `skills/create-spine-tasks/references/prompt-template.md` for PROMPT/STATUS shapes.

## Next Task ID counter

When creating a new task:

1. Read `Next Task ID` from `{tasksRoot}/CONTEXT.md` (e.g., `SP-016`)
2. Use that ID for the new folder name and PROMPT heading
3. Increment the counter (e.g., `SP-017`) in the same edit

## Scaffold sections (spine init / SP-053)

- **Current State** — 2–3 paragraphs on what exists today
- **Phase plan** — table of staged/done tasks with deps
- **Execution policy** — pointer to operator runbook + preflight/land loop
- **Key Files** — tasks root, spine config, PRD path
- **Technical Debt / Future Work** — living backlog
