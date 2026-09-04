# Contributing

## Setup

Node 22, pnpm (`corepack enable pnpm`). `pnpm install` runs `wxt prepare` and installs git hooks.

## Workflow

1. Pick an item from the plan (vault `project/anchor-extension/plan.md`) and the matching feature section in `features/*.md`.
2. Create the feature folder under `src/features/<name>/` with `views/`, `components/`, `composables/`.
3. Put chain or key logic in `src/services/*.service.ts` (runs in the service worker) and expose it through `defineProxyService`.
4. Add or extend zod schemas in `src/lib/storage/schemas.ts` or `src/lib/messaging/protocol.ts` before using new data shapes.
5. Add i18n keys to `src/locales/en-US/<namespace>.json`.
6. Tests: `*.test.ts` next to the code; `pnpm check` before pushing.

## Conventions

- Vue: `<script setup lang="ts">`, Composition API only, `defineProps<{}>()`, `defineEmits<{}>()`.
- State: Pinia stores are page-local mirrors; the service worker is the source of truth.
- Never store secrets in Pinia or `chrome.storage.local`; unlocked keys live only in `chrome.storage.session` and service-worker memory.
- Imports: explicit (`#imports` for WXT helpers, `@/` for `src/`). No auto-imports.
- Lint and format run on commit through lint-staged.

## Commits

Subject line starts with an emoji followed by a short description, e.g. `🧱 add keyring schema`. Commit on the current branch.
