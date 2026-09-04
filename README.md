# Anchor Extension

Browser-extension re-implementation of [Anchor Wallet](https://github.com/greymass/anchor) for Antelope chains (EOS, WAX, Telos, Proton, Libre, FIO, …): local key custody, transaction signing, and the EOSIO Signing Request (ESR) / anchor-link session protocol, so dApps that already support Anchor work unchanged.

Functional parity with the desktop app, redesigned for Manifest V3. Not a code port.

## Stack

WXT · Vue 3 (`<script setup>`) · TypeScript · Pinia · Vue Router · TanStack Vue Query · Tailwind v4 + shadcn-vue · `@webext-core/messaging` + `proxy-service` · zod · `@wharfkit/antelope` · `@wharfkit/signing-request` · `@greymass/anchor-link-session-manager` · i18next

## Develop

```bash
pnpm install
pnpm dev            # Chrome with HMR
pnpm dev:firefox
pnpm check          # typecheck + lint + test
pnpm zip            # .output/*.zip
```

## Layout

```
src/
  entrypoints/   background.ts content.ts inpage.ts popup/ app/ prompt/
  services/      run in the service worker, exposed to pages via proxy-service
  features/      UI grouped by capability (views, components, composables)
  composables/   the only bridge between views and services
  components/ui/ shadcn-vue primitives
  lib/           crypto, antelope helpers, storage schemas, messaging protocol, i18n
  stores/        Pinia stores (page-local)
  locales/       i18next namespaces
docs/adr/        architecture decision records
```

## Rules

- Services own all key and chain logic. Components never touch private keys.
- Every message and storage item has a zod schema in `src/lib`.
- `<script setup lang="ts">` only; typed `defineProps` / `defineEmits`.
- See `CONTRIBUTING.md` and `docs/adr/`.

## License

MIT. Locales, chain logos and icons are from Anchor Wallet (MIT, Greymass); see `THIRD_PARTY_NOTICES.md`.
