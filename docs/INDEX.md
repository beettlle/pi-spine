# Documentation Index

This is the main navigation page for pi-spine documentation.

---

## 📚 Main Documentation

| Document | Description | Audience | Size |
|----------|-------------|----------|------|
| [**README.md**](./README.md) | Documentation index and navigation guide | All | 10KB |
| [**EXECUTION-FLOW.md**](./EXECUTION-FLOW.md) | Detailed step-by-step execution flow | Users, Operators | 27KB |
| [**EXECUTION-FLOW-DIAGRAMS.md**](./EXECUTION-FLOW-DIAGRAMS.md) | Visual diagrams of execution flows | Visual learners | 10KB |
| [**QUICK-REFERENCE.md**](./QUICK-REFERENCE.md) | Command reference for common operations | Users | 9KB |
| [**DOCUMENTATION-SUMMARY.md**](./DOCUMENTATION-SUMMARY.md) | Summary of all documentation created | Developers | 7KB |

---

## 📖 Product Requirements

| Document | Description | Audience | Size |
|----------|-------------|----------|------|
| [**PRD.md**](./PRD.md) | Full product requirements (v1.2) | Developers, Technical PMs | 56KB |
| [**PRD-v2.0.md**](./PRD-v2.0.md) | v2.0 feature specification | Developers | 9KB |
| [**PRD-v2.1-reliability-handoff.md**](./PRD-v2.1-reliability-handoff.md) | v2.1 reliability features | Developers | 7KB |
| [**PRD-v2.2-ship-readiness-handoff.md**](./PRD-v2.2-ship-readiness-handoff.md) | v2.2 ship readiness | Developers | 21KB |
| [**PRD-v1.3-upstream-execution-bridge.md**](./PRD-v1.3-upstream-execution-bridge.md) | v1.3 upstream execution | Developers | 38KB |
| [**PRD-v2.0-implementation-handoff.md**](./PRD-v2.0-implementation-handoff.md) | v2.0 implementation details | Developers | 46KB |
| [**PRD-v1.8.1-reconciliation-handoff.md**](./PRD-v1.8.1-reconciliation-handoff.md) | v1.8.1 reconciliation epic | Developers | — |
| [**PRD-v1.9.0-contract-guardrails-handoff.md**](./PRD-v1.9.0-contract-guardrails-handoff.md) | v1.9.0 contract guardrails | Developers | — |
| [**PRD-v1.10.0-release-harness-handoff.md**](./PRD-v1.10.0-release-harness-handoff.md) | v1.10.0 release harness | Developers | — |
| [**PRD-v2.0.0-automation-proof-handoff.md**](./PRD-v2.0.0-automation-proof-handoff.md) | v2.0.0 automation proof (semver) | Developers | — |

---

## 👥 User Guides

| Document | Description | Audience |
|----------|-------------|----------|
| [**../README.md**](../README.md) | Project overview (includes quick start) | Everyone |
| [**adoption/why-pi-spine.md**](adoption/why-pi-spine.md) | Positioning vs Taskplane, Babysitter, pi-conductor | Everyone |
| [**adoption/bootstrap-checklist.md**](adoption/bootstrap-checklist.md) | First-time setup checklist | New Users |
| [**adoption/local-install.md**](adoption/local-install.md) | Git/path installation guide | Developers |
| [**adoption/operator-runbook.md**](adoption/operator-runbook.md) | Daily operational procedures | Operators |
| [**adoption/real-project-readiness.md**](adoption/real-project-readiness.md) | Phase 9 adoption plan | Teams |
| [**adoption/upstream-execution-workflow.md**](adoption/upstream-execution-workflow.md) | Authoring → validation → batch | Users |

---

## 🏗️ Technical Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [**design/cursor-rules-discovery.md**](design/cursor-rules-discovery.md) | Cursor rules discovery design | Developers |

---

## 📊 Release Documentation

| Document | Description | Audience |
|----------|-------------|----------|
| [**release/stabilization-roadmap-v1.8-v2.0.md**](release/stabilization-roadmap-v1.8-v2.0.md) | Stabilization roadmap v1.8.1 → v2.0.0 | Operators, Developers |
| [**release/npm-publish.md**](release/npm-publish.md) | npm publish mechanics | Operators |
| [**release/v1.0-checklist.md**](release/v1.0-checklist.md) | Pre-release checklist | Operators |
| [**release/**](release/) | Release notes and version history | Everyone |

---

## 🔍 Documentation by Use Case

### I want to understand what pi-spine does
- Start with **[../README.md](../README.md)** (project overview and quick start)
- Read **[adoption/why-pi-spine.md](adoption/why-pi-spine.md)** (how pi-spine compares to related tools)
- Then read **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)** (detailed flow)
- Reference **[EXECUTION-FLOW-DIAGRAMS.md](./EXECUTION-FLOW-DIAGRAMS.md)** (visual diagrams)

### I want to run a batch
- Follow **[../README.md#quick-start](../README.md#quick-start)** (overview path), then **[adoption/bootstrap-checklist.md](adoption/bootstrap-checklist.md)** (setup detail)
- Use **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** (commands)
- Check **[adoption/operator-runbook.md](adoption/operator-runbook.md)** (procedures)

### I want to contribute code
- Read **[PRD.md](./PRD.md)** (full spec)
- Understand flow with **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)**
- Review **[PRD-v2.0-implementation-handoff.md](./PRD-v2.0-implementation-handoff.md)** (implementation)

### I want to find documentation quickly
- Use **[docs/README.md](./README.md)** (navigation guide)
- Check **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** (command lookup)
- Browse by category in **[docs/README.md](./README.md)**

---

## 🔄 Document Relationships

```
docs/
├── EXECUTION-FLOW.md              ← Detailed execution explanation
│   └── EXECUTION-FLOW-DIAGRAMS.md ← Visual companion
├── QUICK-REFERENCE.md             ← Command reference
├── docs/README.md                 ← Navigation guide
├── PRD.md                         ← Full specification
│   ├── PRD-v2.0.md
│   ├── PRD-v2.1-reliability-handoff.md
│   ├── PRD-v2.2-ship-readiness-handoff.md
│   ├── PRD-v1.3-upstream-execution-bridge.md
│   ├── PRD-v2.0-implementation-handoff.md
│   ├── PRD-v1.8.1-reconciliation-handoff.md
│   ├── PRD-v1.9.0-contract-guardrails-handoff.md
│   ├── PRD-v1.10.0-release-harness-handoff.md
│   └── PRD-v2.0.0-automation-proof-handoff.md
├── release/
│   └── stabilization-roadmap-v1.8-v2.0.md
├── adoption/                      ← User guides
│   ├── bootstrap-checklist.md
│   ├── operator-runbook.md
│   └── ...
└── design/                        ← Technical docs
    └── cursor-rules-discovery.md
```

---

## 📝 Contributing Documentation

When adding new documentation:

1. **Use this index** - Add your document to the appropriate section
2. **Follow naming** - Use kebab-case with `.md` extension
3. **Include size** - Add file size in KB for quick reference
4. **Link from other docs** - Cross-reference related documentation
5. **Update index** - Add new documents to this index

---

## 📚 Related Projects

| Project | Documentation |
|---------|---------------|
| [pi](https://pi.dev) | [pi.dev/docs](https://pi.dev/docs) |
| [Taskplane](https://pi.dev/packages/taskplane) | [taskplane docs](https://github.com/HenryLach/taskplane/blob/main/docs/) |
| [Babysitter](https://github.com/a5c-ai/babysitter) | [babysitter docs](https://github.com/a5c-ai/babysitter) |
| [pi-conductor](https://www.npmjs.com/package/@feniix/pi-conductor) | [pi-conductor docs](https://github.com/feniix/pi-conductor) |

---

## 🆘 Getting Help

- **Quick commands?** → **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)**
- **Understanding execution?** → **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)**
- **Visual diagrams?** → **[EXECUTION-FLOW-DIAGRAMS.md](./EXECUTION-FLOW-DIAGRAMS.md)**
- **Full spec?** → **[PRD.md](./PRD.md)**
- **Project overview?** → **[../README.md](../README.md)**

---

*Last updated: 2026-07-07*
