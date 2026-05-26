# Copilot Chef Documentation Structure

## 1. Core Documentation Map

| Topic | File | Summary |
|---|---|---|
| Workspace instructions for Copilot | `../.github/copilot-instructions.md` | High-signal routing guide with project overview and common pitfalls |
| Developer workflows and commands | `developer-guide.md` | Setup, run, test, build, and feature implementation workflow |
| System architecture and runtime model | `architecture.md` | Process boundaries, data flow, auth, streaming, and runtime modes |
| App configuration and settings | `copilot-chef-config.md` | Environment variables, app settings, and preference contracts |
| Electron IPC contracts | `ipc-channels.md` | Canonical request-response and push channel reference |
| Frontend visual and UX standards | `copilot-chef-style-guide.md` | UI style system and frontend implementation expectations |
| PA machine API | `pa-machine-api.md` | Machine caller API routes, auth, and examples |
| PA machine operations | `pa-machine-runbook.md` | Operational procedures and troubleshooting for PA integrations |
| Release process | `release-guide.md` | Packaging and release workflow guidance |

---

## 2. Maintenance Rules

1. Keep one source of truth per topic and link to it from other docs.
2. When adding or changing IPC channels, update `ipc-channels.md` in the same change.
3. When adding or changing settings, update `copilot-chef-config.md` in the same change.
4. When changing build/test/dev commands, update `developer-guide.md` in the same change.
5. For frontend/UI behavior changes, verify alignment with `copilot-chef-style-guide.md`.
