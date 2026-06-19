# pi-spine Documentation

Welcome to the pi-spine documentation! This folder contains comprehensive guides, specifications, and reference materials for understanding and using pi-spine.

---

## 📚 Quick Navigation

### For New Users
- **[../README.md](../README.md)** - Project overview (includes quick start)
- **[adoption/why-pi-spine.md](adoption/why-pi-spine.md)** - Positioning vs Taskplane, Babysitter, pi-conductor
- **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** - Common commands reference
- **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)** - Understanding execution flow

### For Operators
- **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** - Command lookup
- **[adoption/operator-runbook.md](adoption/operator-runbook.md)** - Daily procedures
- **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)** - Detailed execution explanation

### For Developers
- **[PRD.md](./PRD.md)** - Full product requirements
- **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)** - Execution flow understanding
- **[PRD-v2.0-implementation-handoff.md](./PRD-v2.0-implementation-handoff.md)** - Implementation details

---

## 📖 Documentation Overview

| Document | Description | Size |
|----------|-------------|------|
| [EXECUTION-FLOW.md](./EXECUTION-FLOW.md) | Comprehensive step-by-step execution flow explanation | 27KB |
| [EXECUTION-FLOW-DIAGRAMS.md](./EXECUTION-FLOW-DIAGRAMS.md) | Visual Mermaid diagrams of execution flows | 10KB |
| [QUICK-REFERENCE.md](./QUICK-REFERENCE.md) | Command reference for common operations | 9KB |
| [docs/README.md](./docs/README.md) | Documentation index and navigation guide | 10KB |
| [DOCUMENTATION-SUMMARY.md](./DOCUMENTATION-SUMMARY.md) | Summary of all documentation created | 7KB |
| [INDEX.md](./INDEX.md) | Main documentation navigation index | 6KB |
| [PRD.md](./PRD.md) | Full product requirements (v1.2) | 56KB |

---

## 📖 Additional Documentation

### Product Requirements
- **[PRD-v2.0.md](./PRD-v2.0.md)** - v2.0 feature specification (9KB)
- **[PRD-v2.1-reliability-handoff.md](./PRD-v2.1-reliability-handoff.md)** - v2.1 reliability (7KB)
- **[PRD-v2.2-ship-readiness-handoff.md](./PRD-v2.2-ship-readiness-handoff.md)** - v2.2 ship readiness (21KB)
- **[PRD-v1.3-upstream-execution-bridge.md](./PRD-v1.3-upstream-execution-bridge.md)** - v1.3 upstream (37KB)
- **[PRD-v2.0-implementation-handoff.md](./PRD-v2.0-implementation-handoff.md)** - Implementation details (45KB)

### User Guides
- **[adoption/why-pi-spine.md](adoption/why-pi-spine.md)** - Positioning vs Taskplane, Babysitter, pi-conductor
- **[adoption/bootstrap-checklist.md](adoption/bootstrap-checklist.md)** - First-time setup (10KB)
- **[adoption/local-install.md](adoption/local-install.md)** - Git/path installation (4KB)
- **[adoption/operator-runbook.md](adoption/operator-runbook.md)** - Daily procedures (30KB)
- **[adoption/real-project-readiness.md](adoption/real-project-readiness.md)** - Phase 9 adoption (4KB)
- **[adoption/upstream-execution-workflow.md](adoption/upstream-execution-workflow.md)** - Workflow guide (8KB)

### Technical Documentation
- **[design/cursor-rules-discovery.md](design/cursor-rules-discovery.md)** - Cursor rules design (9KB)

---

## 🔍 Documentation by Purpose

### Understanding How pi-spine Works
1. Start with **[../README.md](../README.md)** (project overview and quick start)
2. Read **[adoption/why-pi-spine.md](adoption/why-pi-spine.md)** (positioning vs related tools)
3. Read **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)** (detailed flow)
4. Reference **[EXECUTION-FLOW-DIAGRAMS.md](./EXECUTION-FLOW-DIAGRAMS.md)** (visual diagrams)

### Running a Batch
1. Follow **[../README.md#quick-start](../README.md#quick-start)** (overview path), then **[adoption/bootstrap-checklist.md](adoption/bootstrap-checklist.md)** (setup detail)
2. Use **[QUICK-REFERENCE.md](./QUICK-REFERENCE.md)** (commands)
3. Check **[adoption/operator-runbook.md](adoption/operator-runbook.md)** (procedures)

### Contributing Code
1. Read **[PRD.md](./PRD.md)** (full spec)
2. Understand flow with **[EXECUTION-FLOW.md](./EXECUTION-FLOW.md)**
3. Review **[PRD-v2.0-implementation-handoff.md](./PRD-v2.0-implementation-handoff.md)**

---

## 📊 Documentation Statistics

| Category | Count | Total Size |
|----------|-------|------------|
| Main Documentation | 6 | 120KB |
| Product Requirements | 5 | 131KB |
| User Guides | 5 | 56KB |
| Technical Docs | 1 | 9KB |
| **Total** | **17** | **316KB** |

---

## 🎯 Key Topics Covered

- **Batch Lifecycle** - Planning → Running → Completed
- **Task Execution** - Waves, lanes, ticks, workers
- **Review Loops** - Code review, final review, contract verification
- **Error Recovery** - Diagnosis, retry, pause/resume, abort
- **Command Reference** - Common operations and workflows
- **Architecture** - System components and data flow
- **Git Strategy** - Worktrees, branches, merge flow
- **Journal Events** - Audit trail and replay

---

## 📚 Related Documentation

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
- **Documentation navigation?** → **[docs/README.md](./docs/README.md)**

---

## 📝 Contributing Documentation

When adding new documentation:

1. **Follow naming** - Use kebab-case with `.md` extension
2. **Add to index** - Include in INDEX.md or README.md
3. **Include size** - Add file size in KB
4. **Cross-reference** - Link from related documentation
5. **Update tables** - Keep documentation overview tables current

---

*Last updated: 2026-06-12*
