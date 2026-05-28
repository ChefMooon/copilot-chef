# Local Recipe Book Documentation Structure

## 1. Core Documentation Map

| Topic | File | Summary |
|---|---|---|
| Workspace instructions for Copilot | `../.github/copilot-instructions.md` | High-signal routing guide with project overview and common pitfalls |
| Developer workflows and commands | `developer-guide.md` | Setup, run, test, build, and feature implementation workflow |
| System architecture and runtime model | `architecture.md` | Process boundaries, data flow, auth, streaming, and runtime modes |
| App configuration and settings | `copilot-chef-config.md` | Environment variables, app settings, and preference contracts |
| LAN and browser access | `lan-browser-access.md` | Trusted-device LAN/browser access, token lifecycle, and operations |
| Electron IPC contracts | `ipc-channels.md` | Canonical request-response and push channel reference |
| Frontend visual and UX standards | `copilot-chef-style-guide.md` | UI style system and frontend implementation expectations |
| Browser page QA implementation plan | `browser-page-qa-plan.md` | Sequential browser route QA plan, matrix, severity rubric, and execution workflow |
| Browser page QA findings log | `browser-page-qa-findings.md` | Issue log and per-route completion matrix for the current QA cycle |
| Browser page remediation planning | `browser-page-remediation-plan.md` | Template for quick-win and deep-refactor fix planning after QA completion |
| Release process | `release-guide.md` | Packaging and release workflow guidance |

---

## 2. Maintenance Rules

1. Keep one source of truth per topic and link to it from other docs.
2. When adding or changing IPC channels, update `ipc-channels.md` in the same change.
3. When adding or changing settings, update `copilot-chef-config.md` in the same change.
4. When changing build/test/dev commands, update `developer-guide.md` in the same change.
5. For frontend/UI behavior changes, verify alignment with `copilot-chef-style-guide.md`.
