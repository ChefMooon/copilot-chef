# How Skills and Tools Work in `burkeholland/max`

**Source**: [burkeholland/max](https://github.com/burkeholland/max/tree/main) — AI orchestrator built on the GitHub Copilot SDK  
**Researched**: 2026-03-20

---

## Executive Summary

`max` is a personal developer AI assistant (published as the npm package `heymax`) that runs a persistent Copilot SDK orchestrator session and dispatches work to ephemeral "worker" sessions. Its **Tools** are hard-coded TypeScript functions registered with the Copilot SDK session and give the orchestrator capabilities like spawning workers, managing memory, and switching models. Its **Skills** are markdown instruction documents (`SKILL.md` files with YAML frontmatter) that are read at runtime and injected into the session context as behavioral guidance — they teach the AI how to use external CLI tools or services without requiring a code redeploy. The two systems are complementary: tools are code, skills are prose.

---

## Architecture Overview

```
User (Telegram / TUI)
        │
        ▼
   Max Daemon  ──────────────────────────────────────
        │                                            │
        ▼                                            ▼
 Orchestrator Session                      Skills (SKILL.md files)
 (Copilot SDK, persistent)                 injected as context
        │  Tools (TypeScript, 17 tools)
        │
  ┌─────┼─────────┐
  │     │         │
Worker  Worker  Worker   (ephemeral Copilot CLI sessions)
  │
SQLite (~/.max/max.db)
MCP Servers (~/.copilot/mcp-config.json)
```

---

## Tools System

### What Tools Are

Tools are TypeScript functions registered with the Copilot SDK session using `defineTool()` from `@github/copilot-sdk`. They are the only way the orchestrator can take _actions_ — everything the AI does programmatically flows through a tool call.[^1]

All tools are created inside a single factory function:

```ts
// src/copilot/tools.ts
export function createTools(deps: ToolDeps): Tool<any>[] {
  return [
    defineTool("create_worker_session", { ... }),
    defineTool("send_to_worker", { ... }),
    // ...16 more
  ];
}
```

The `ToolDeps` interface carries three shared references into every tool handler[^2]:
- `client: CopilotClient` — the SDK client for creating/resuming Copilot sessions
- `workers: Map<string, WorkerInfo>` — the in-memory registry of live worker sessions
- `onWorkerComplete` — callback fired when a background worker finishes

### How Tools Are Registered

During orchestrator session creation (`ensureOrchestratorSession`), tools are assembled by calling `getSessionConfig()`[^3]:

```ts
// src/copilot/orchestrator.ts
function getSessionConfig() {
  const tools = createTools({ client, workers, onWorkerComplete: feedBackgroundResult });
  const mcpServers = loadMcpConfig();
  const skillDirectories = getSkillDirectories();
  return { tools, mcpServers, skillDirectories };
}
```

These are then passed into `client.createSession()` / `client.resumeSession()`. The SDK wires tool definitions to the model — when the model emits a tool call in its response, the SDK invokes the corresponding handler automatically.

### The 17 Tools

| Tool | Category | Purpose |
|------|----------|---------|
| `create_worker_session` | Workers | Spawn a new Copilot CLI session in a directory (optionally with an initial prompt, which runs non-blocking) |
| `send_to_worker` | Workers | Send a follow-up prompt to an existing worker (non-blocking) |
| `list_sessions` | Workers | List all active workers with status and CWD |
| `check_session_status` | Workers | Get detailed status + last output of a specific worker |
| `kill_session` | Workers | Terminate a worker and remove from SQLite |
| `list_machine_sessions` | Machine | Enumerate ALL Copilot sessions on the machine (VS Code, terminal, etc.) via `~/.copilot/session-state/` |
| `attach_machine_session` | Machine | Resume an existing machine session as a managed worker |
| `list_skills` | Skills | List all installed skills (bundled + local + global) |
| `learn_skill` | Skills | Create a new `SKILL.md` in `~/.max/skills/` at runtime |
| `uninstall_skill` | Skills | Remove a skill from `~/.max/skills/` |
| `list_models` | Models | List available Copilot models with billing info |
| `switch_model` | Models | Persist a model switch; disables auto-routing |
| `toggle_auto` | Models | Enable/disable the automatic model router |
| `remember` | Memory | Write a fact to SQLite long-term memory |
| `recall` | Memory | Full-text search across stored memories |
| `forget` | Memory | Delete a memory by ID |
| `restart_max` | System | Restart the daemon process |

### Worker Tool Deep Dive

Worker tools are the most important category. When `create_worker_session` or `send_to_worker` is called with an `initial_prompt`, the work is dispatched **non-blocking**[^4]:

```ts
session.sendAndWait({ prompt: `Working directory: ${workingDir}\n\n${initial_prompt}` }, timeoutMs)
  .then((result) => {
    worker.lastOutput = result?.data?.content || "No response";
    deps.onWorkerComplete(args.name, worker.lastOutput);
  })
  .catch((err) => { /* format and report error */ })
  .finally(() => {
    // Auto-destroy to free ~400MB memory per worker
    session.destroy().catch(() => {});
    deps.workers.delete(args.name);
    getDb().prepare(`DELETE FROM worker_sessions WHERE name = ?`).run(args.name);
  });
return `Task dispatched — I'll notify you when it's done.`; // returns immediately
```

When work completes, `feedBackgroundResult` injects a `[Background task completed]` message back into the orchestrator's message queue, causing it to summarize and relay results to the user[^5]:

```ts
export function feedBackgroundResult(workerName: string, result: string): void {
  const prompt = `[Background task completed] Worker '${workerName}' finished:\n\n${result}`;
  sendToOrchestrator(prompt, { type: "background" }, (_text, done) => {
    if (done && proactiveNotifyFn) proactiveNotifyFn(_text, channel);
  });
}
```

Blocked directories (`.ssh`, `.aws`, `.kube`, etc.) are hard-coded and rejected before any worker can be created in them.[^6]

---

## Skills System

### What Skills Are

A Skill is a directory with exactly two files[^7]:
- `SKILL.md` — YAML frontmatter (`name`, `description`) + markdown body with instructions
- `_meta.json` — minimal metadata (`slug`, `version`)

The markdown body is plain text — there is no proprietary schema. It describes CLI commands, authentication steps, usage patterns, and gotchas. The Copilot SDK reads the `SKILL.md` content and makes it available as additional context for the session.

### Skill Directories (Three-Tier Precedence)

Skills are scanned from three locations[^8]:

```ts
// src/copilot/skills.ts
const BUNDLED_SKILLS_DIR = join(dirname(...), "..", "..", "skills"); // shipped with the package
const LOCAL_SKILLS_DIR   = join(homedir(), ".max", "skills");        // ~/.max/skills/
const GLOBAL_SKILLS_DIR  = join(homedir(), ".agents", "skills");     // ~/.agents/skills/
```

All three directories are returned by `getSkillDirectories()` and passed to the session configuration. Bundled skills are always available; local skills override or extend the set.

### Skill File Format

```markdown
---
name: Google (gogcli)
description: Access Gmail, Google Calendar, Drive, Contacts, Tasks, Sheets, Docs, and more via the gog CLI.
---

# Google CLI (gogcli)

Max can interact with Google services using the `gog` CLI tool...

## Gmail
```bash
gog gmail search "is:unread" --json
```
```

The `parseFrontmatter()` function in `skills.ts` extracts `name` and `description` with a simple regex — no YAML library is used[^9].

### Bundled Skills

Two skills ship with the package[^10]:

| Slug | Purpose |
|------|---------|
| `find-skills` | Orchestrates discovery and installation of community skills from https://skills.sh |
| `gogcli` | Instructions for the `gog` CLI to access Gmail, Calendar, Drive, Contacts, Tasks, Sheets, Docs |

`find-skills` is Meta — it teaches Max how to find and install _more_ skills. It uses a worker session to call the skills.sh search API and `web_fetch` for security audit data, then calls `learn_skill` after user permission.

### Runtime Skill Creation (`learn_skill` tool)

Skills can be created at runtime without any code change or restart[^11]:

```ts
// src/copilot/tools.ts → learn_skill handler
handler: async (args) => {
  return createSkill(args.slug, args.name, args.description, args.instructions);
}

// src/copilot/skills.ts
export function createSkill(slug, name, description, instructions): string {
  const skillDir = join(LOCAL_SKILLS_DIR, slug);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "_meta.json"), JSON.stringify({ slug, version: "1.0.0" }));
  writeFileSync(join(skillDir, "SKILL.md"), `---\nname: ${name}\ndescription: ${description}\n---\n\n${instructions}\n`);
  return `Skill '${name}' created at ${skillDir}. It will be available on your next message.`;
}
```

The next message triggers a new orchestrator session creation (or the skill directories are re-scanned), so the new skill is immediately active.

### skills-lock.json

A lockfile tracks the hash of bundled/managed skill content[^12]:

```json
{
  "version": 1,
  "skills": {
    "find-skills": {
      "source": "vercel-labs/skills",
      "sourceType": "github",
      "computedHash": "6412eb4eb3b91595ebab937f0c69501240e7ba761b3d82510b5cf506ec5c7adc"
    }
  }
}
```

---

## Model Router

The orchestrator includes an auto-routing layer in `src/copilot/router.ts` that classifies messages into three tiers[^13]:

| Tier | Default Model | When Used |
|------|--------------|-----------|
| `fast` | `gpt-4.1` | Greetings, acknowledgments, short factual questions |
| `standard` | `claude-sonnet-4.6` | Coding tasks, tool use, moderate reasoning |
| `premium` | `claude-opus-4.6` | Complex architecture, deep analysis |

An **override rule** for "design" topics (`ui`, `ux`, `css`, `layout`, etc.) forces `claude-opus-4.6` regardless of tier. Classification is LLM-based via `src/copilot/classifier.ts` (using GPT-4.1), with pattern-matching fallbacks for short follow-ups. Auto-routing is disabled by default and toggled with `toggle_auto`.

---

## How Skills and Tools Interact

The system has a deliberate division of responsibility:

1. **Tools = capabilities** — what the AI can do (create workers, search memory, call APIs)
2. **Skills = knowledge** — how the AI should use external tools (CLI syntax, auth flows, gotchas)

A concrete example:
- The `gogcli` skill tells the AI which `gog` commands to run for Gmail
- The `create_worker_session` tool actually runs those commands in a shell via a worker Copilot session

When a user asks "check my unread email", the orchestrator:
1. Reads the `gogcli` skill instructions (already in session context)
2. Calls `create_worker_session` with an `initial_prompt` derived from those instructions
3. The worker runs `gog gmail search "is:unread" --json` and returns the output
4. `feedBackgroundResult` delivers the output back to the orchestrator, which summarizes it

This means adding a new external tool integration requires only writing a `SKILL.md` — no TypeScript, no restart.

---

## System Message Integration

Skills are injected at the SDK session level via the `skillDirectories` field. The system message (`src/copilot/system-message.ts`) separately provides behavioral guidance about _when_ and _how_ to use skills[^14]:

```
Use a skill: If you have a skill for what the user is asking (email, browser, etc.), 
use it. Skills teach you how to use external tools — follow their instructions.

Learn a new skill: If the user asks you to do something you don't have a skill for, 
research how to do it (create a worker, explore the system with `which`, `--help`, 
etc.), then use `learn_skill` to save what you learned for next time.
```

Long-term memory (from `remember`/`recall`) is surfaced separately as a `## Long-Term Memory` block appended to the system message at session creation time[^15].

---

## Key Repositories Summary

| Repository | Purpose | Key Files |
|------------|---------|-----------|
| [burkeholland/max](https://github.com/burkeholland/max) | Main repo | All source |
| `src/copilot/tools.ts` | All 17 tool definitions | Tool handlers |
| `src/copilot/skills.ts` | Skill scan/create/remove logic | `listSkills`, `createSkill`, `removeSkill` |
| `src/copilot/orchestrator.ts` | Session lifecycle, message queue, worker results | `sendToOrchestrator`, `feedBackgroundResult` |
| `src/copilot/system-message.ts` | Orchestrator system prompt | `getOrchestratorSystemMessage` |
| `src/copilot/router.ts` | Automatic model selection | `resolveModel`, `RouterConfig` |
| `skills/find-skills/SKILL.md` | Bundled skill — community skill discovery | Uses skills.sh API |
| `skills/gogcli/SKILL.md` | Bundled skill — Google services | `gog` CLI commands |

---

## Confidence Assessment

- **High confidence**: All claims about tools, skill format, directory layout, and orchestrator logic are directly verified from source code. File paths and function names are exact.
- **Medium confidence**: How `skillDirectories` is consumed by the Copilot SDK is inferred from the API surface — the SDK internals are not publicly documented in this repo. The claim that skills are "injected as context" is based on the parameter name and system prompt references; the exact SDK behavior is a black box here.
- **Assumption**: `skills-lock.json` appears to be used for integrity checking but no code referencing it was found in the fetched source tree — it may be used by tooling outside the main daemon.

---

## Footnotes

[^1]: `src/copilot/tools.ts:1-12` — imports `defineTool` from `@github/copilot-sdk` and the `createTools` factory function signature.
[^2]: `src/copilot/tools.ts:46-51` — `ToolDeps` interface definition with `client`, `workers`, and `onWorkerComplete`.
[^3]: `src/copilot/orchestrator.ts` — `getSessionConfig()` assembles tools, MCP servers, and skill directories.
[^4]: `src/copilot/tools.ts` — `create_worker_session` handler's non-blocking dispatch with `.then()/.finally()` cleanup.
[^5]: `src/copilot/orchestrator.ts` — `feedBackgroundResult()` function re-queuing worker output as an orchestrator message.
[^6]: `src/copilot/tools.ts:31-36` — `BLOCKED_WORKER_DIRS` constant listing `.ssh`, `.aws`, `.kube`, etc.
[^7]: `skills/find-skills/` and `skills/gogcli/` — each directory contains exactly `SKILL.md` and `_meta.json`.
[^8]: `src/copilot/skills.ts:9-17` — three skill directory constants: `BUNDLED_SKILLS_DIR`, `LOCAL_SKILLS_DIR`, `GLOBAL_SKILLS_DIR`.
[^9]: `src/copilot/skills.ts` — `parseFrontmatter()` uses a simple regex and line-by-line key parsing.
[^10]: `skills/` directory in the repo tree — `find-skills` and `gogcli` subdirectories.
[^11]: `src/copilot/skills.ts` — `createSkill()` function writing `_meta.json` and `SKILL.md` to `~/.max/skills/`.
[^12]: `skills-lock.json` — root-level lockfile with hash for `find-skills`.
[^13]: `src/copilot/router.ts` — `DEFAULT_CONFIG` with `tierModels` and `overrides`, `resolveModel()` entry point.
[^14]: `src/copilot/system-message.ts` — "Use a skill" and "Learn a new skill" sections of the system message.
[^15]: `src/copilot/system-message.ts:1-5` — `memorySummary` injected as `## Long-Term Memory` block.
