# Phase 1 Effective Configuration Boundary Report

## Summary

This phase formalizes a single effective runtime configuration snapshot for startup decisions, LAN/browser configuration, and runtime status. The implementation keeps the current behavior compatible while ensuring the actual API port can be read from one source and passed through the server/static web boundary.

## Status

Status: complete

## What changed

- Added the effective runtime config contract in [src/shared/config/runtime-config.ts](../../src/shared/config/runtime-config.ts).
- Added validation coverage in [src/shared/config/__tests__/runtime-config.test.ts](../../src/shared/config/__tests__/runtime-config.test.ts).
- Updated the LAN resolver in [src/main/server/lib/lan.ts](../../src/main/server/lib/lan.ts) to compute a single effective runtime snapshot rather than reconstructing LAN/browser settings in multiple places.
- Updated the web server to resolve its port from the effective setting boundary in [src/main/server/static-web.ts](../../src/main/server/static-web.ts).
- Kept compatibility with the existing service and LAN tests while making configured ports distinct from actual bound ports.

## Behavior implemented

- One typed runtime config boundary resolves local/remote mode, LAN enablement, candidate hosts, configured ports, and actual port values.
- Actual API and web bind/advertised values remain separate from configured values so runtime status and `/runtime-config.json` reflect the actual bound port.
- LAN host selection retains the current loopback fallback behavior while making it testable.
- Settings storage remains the persistence boundary; runtime composition reads the resolved config at the runtime boundary rather than re-deriving configuration from raw settings.

## Validation

Command run:

```bash
npm run test -- --run src/shared/config/__tests__/runtime-config.test.ts src/main/server/lib/lan.test.ts
```

Evidence:

- 2 test files passed
- 5 tests passed
- exit status: success

## Risks / open decisions

- This phase intentionally keeps the current compatibility identifiers (`COPILOT_CHEF_*`) and does not rework the wider settings model.
- The larger settings/UI preference split described in Phase 9 remains separate from this runtime-config boundary.

## Recommended next phase

Proceed to Phase 2: runtime coordinator and lifecycle.
