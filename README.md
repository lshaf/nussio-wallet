# Nussio Wallet

Browser-extension wallet for Antelope chains, built on the feature set and protocols of [Anchor Wallet](https://github.com/greymass/anchor) by Greymass (MIT). Nussio Wallet is not affiliated with or endorsed by Greymass. Supports EOS, WAX, Telos, Proton, Libre, FIO and custom chains: local key custody, transaction signing, and the EOSIO Signing Request (ESR) / anchor-link session protocol, so dApps that already support Anchor work unchanged.

Functional parity with the desktop app, redesigned for Manifest V3. Not a code port.

## Stack

WXT · Vue 3 (`<script setup>`) · TypeScript · Pinia · Vue Router · TanStack Vue Query · Tailwind v4 + shadcn-vue · `@webext-core/messaging` + `proxy-service` · zod · `@wharfkit/antelope` · `@wharfkit/signing-request` · `@greymass/anchor-link-session-manager` · i18next

## Develop

```bash
pnpm install
pnpm dev            # Chrome with HMR
pnpm dev:firefox
pnpm check          # typecheck + lint + unit tests
pnpm build && pnpm test:e2e   # Playwright against dist/chrome-mv3 (needs `pnpm exec playwright install chromium`)
pnpm test:e2e:edge            # same suite in Microsoft Edge; test:e2e:brave for Brave
pnpm check:bundle             # entry-point size budgets
pnpm zip            # dist/*.zip
pnpm shots          # rebuild and recapture site/screenshots against Jungle 4
```

## Testing

### Automated

```bash
pnpm check                      # typecheck + lint + unit tests (vitest)
pnpm build && pnpm test:e2e     # Playwright loads dist/chrome-mv3 into Chromium and walks onboarding on Jungle4
E2E_SHOTS=./shots pnpm test:e2e # same, with screenshots per step
```

First time: `pnpm exec playwright install chromium`.

### Manual (Chrome / Edge / Brave)

1. `pnpm dev` — WXT builds to `dist/chrome-mv3` and opens a Chromium profile with the extension loaded and hot reload.
   Or build once (`pnpm build`) and load it yourself: `chrome://extensions` → Developer mode → Load unpacked → `dist/chrome-mv3`.
2. Click the Nussio Wallet toolbar icon → **Open wallet** (or open `chrome-extension://<id>/app.html`).
3. Set a password → enable **Jungle 4 (EOS Testnet)** → Validate the node → Enable.
4. Import an account:
   - **Watch**: any existing account, e.g. `eosio`.
   - **Private key**: a Jungle4 account you own (create one at https://monitor4.jungletestnet.io and paste its active key).
   - **Ledger**: a device running the Antelope app, over WebHID. Chromium only; the tab is hidden on Firefox.
5. Home shows the selected wallet; use the top bar to switch chain/account and lock/unlock; Settings → Danger zone resets everything.

### Manual (Firefox)

`pnpm dev:firefox`, or `pnpm build:firefox` then `about:debugging#/runtime/this-firefox` → Load Temporary Add-on → `dist/firefox-mv3/manifest.json`.

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

## Tools

Tools (`#/tools`) holds the wallet-maintenance screens:

- **Backup and restore** — encrypted export in the Nussio format or an Anchor Desktop compatible
  one, and restore of either (including Anchor's v1 per-wallet keyring). See `docs/adr/0004`.
- **Manage keys** — stored keys with the wallets that use them, reveal (password + QR), remove when
  unused, a K1 generator, and an inspector that converts between WIF/PVT and legacy/modern public
  key formats.
- **Contacts** — saved accounts with a default memo that fills in on the send form.
- **Custom tokens** — track a token by contract and symbol, or scan the account when the node
  exposes a Hyperion token index.
- **Pending** — signing requests waiting for you, backup reminders, and account creation requests
  (two keypairs, mandatory owner-key export, a shareable ESR link for whoever pays, then import).

## Releasing

```bash
git push origin v1.2.3      # CI checks, zips both browsers, publishes the release,
                            # then the site redeploys with those zips
git push origin web-v1      # site only: redeploys site/ with the current release's zips
```

`v*` runs `.github/workflows/ci.yml`; the Pages workflow follows it on success. `web-v*` and the
**Run workflow** button deploy the site alone, so copy and screenshot changes do not need a new
extension release. Pushes to `main` never deploy.

A release carries `dist/*.zip` for both browsers. Chrome and Firefox sign their own uploads, so CI
never packs a CRX.

### Local CRX

`pnpm crx` packs `dist/chrome-mv3` into a signed CRX for local installs and side-loading tests. It
needs an RSA key, which also fixes the extension id, so generate it once and keep it out of the
repo.

```bash
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out nussio-crx.pem
CRX_KEY_FILE=nussio-crx.pem pnpm crx   # writes dist/*.crx, prints the extension id
```

Without `CRX_KEY_FILE` the script prints a notice and exits.

## Docs

`docs/security.md` threat model · `docs/qa.md` release checks · `docs/store-listing.md` store copy
and permission justifications · `docs/dapp-integration.md` for app developers · `docs/design.md`
design system · `docs/adr/` decisions · `PRIVACY.md` · `CHANGELOG.md`

## Rules

- Services own all key and chain logic. Components never touch private keys.
- Every message and storage item has a zod schema in `src/lib`.
- `<script setup lang="ts">` only; typed `defineProps` / `defineEmits`.
- See `CONTRIBUTING.md` and `docs/adr/`.

## License

MIT. Nussio Wallet is derived from Anchor Wallet (MIT, Greymass): locales, chain logos, protocol handling and feature design; see `THIRD_PARTY_NOTICES.md`. The Nussio Wallet name and icon are its own.
