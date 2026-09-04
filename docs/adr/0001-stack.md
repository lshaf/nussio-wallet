# ADR 0001 — Stack: WXT + Vue 3 + wharfkit

Status: accepted · Date: 2026-09-04

## Context

Re-implement Anchor Wallet desktop (Electron, React, Redux) as a browser extension with functional parity. Must be readable for a small team, build for Chrome, Edge, Firefox and Safari, and speak the existing ESR / anchor-link protocols.

## Decision

- **WXT** as extension framework: file-based entrypoints generate the manifest, HMR, multi-browser builds, typed versioned storage.
- **Vue 3** Composition API with `<script setup lang="ts">`; **Pinia** for page-local state; **Vue Router** hash history in the full-wallet page; **TanStack Vue Query** for chain reads.
- **Tailwind v4 + shadcn-vue** for UI primitives copied into the repo.
- **`@webext-core/messaging` + `proxy-service`** for typed calls from pages into service-worker services.
- **zod** schemas as the single contract for storage items, messages, forms and backup files; **vee-validate** for forms.
- **`@wharfkit/antelope`**, **`@wharfkit/signing-request` v3**, **`@greymass/anchor-link-session-manager` 0.4** (already on wharfkit), `@wharfkit/resources`, `pako`.
- **WebCrypto** (PBKDF2-SHA256 → AES-256-GCM) keyring; crypto-js only lazily for importing legacy desktop backups.
- **i18next + i18next-vue + sprintf** to reuse desktop locale files unchanged.
- Vitest, Playwright, ESLint, Prettier, husky + lint-staged.

## Consequences

- React was rejected by the team as harder to reason about; Vue SFCs read top-to-bottom.
- No auto-imports: every file states its imports.
- Service worker is the only place that holds keys; pages are thin.
- Desktop code is a reference for behaviour, not a source to copy.
