# Changelog

Notable changes per release. Dates are the tag date.

## 1.1.3 — 2026-09-18

### Fixed

- The build is reproducible from the sources archive alone. Tailwind scanned every text file in
  the tree for class names, so prose in README, docs or the site could add a utility, change the
  stylesheet hash and rename every chunk. The scan is now pinned to `src/`.
- `BUILD.md` no longer relies on the execute bit the zip drops: the two pnpm commands come first,
  the script runs through `sh`, and a Docker one-liner rebuilds in a clean container.

## 1.1.2 — 2026-09-16

### Changed

- The manifest names its author and home page (https://nussio.xid.run/) and describes the wallet
  without listing chains. Exported unsigned transactions download as `nussio-unsigned-*.json`.
- The Firefox sources archive leaves out signing keys, the site, store assets and test output, and
  ships `BUILD.md` with a `scripts/build-firefox.sh` that reproduces the add-on byte for byte.

## 1.1.1 — 2026-09-16

### Changed

- Nussio Wallet is on the Chrome Web Store. The site's install section now leads with the listing
  for Chrome, Edge and Brave and keeps the zip as the unpacked alternative; Firefox is unchanged.
- Release notes on GitHub come from the tag message, or the matching changelog section, instead of
  a generated commit list.

## 1.1.0 — 2026-09-08

### Added

- Ledger support over WebHID: import accounts from a device running the Antelope app, then sign
  in-app transactions and dApp signing requests on it. The transaction is serialised and the
  signature assembled in the service worker, so the extension pages only move APDU packets.
- A developer page on the site covering the `window.nussio` provider option by option, how a
  signing request reaches the wallet, and what the wallet refuses.

### Changed

- Account lists no longer arrive with every match ticked. The header button now toggles between
  Select all and Unselect all.
- The Firefox build is now Manifest V3, matching Chrome. Both declare the same content security
  policy for extension pages.
- Dropped the `<all_urls>` host permission. Every endpoint the wallet uses answers with permissive
  CORS, so the install no longer asks to read and change data on every site. It stays available as
  an optional permission for a custom node that needs it.

## 1.0.0 — 2026-09-05

### Added

- Wallet basics: password-encrypted keyring, hot, watch, manual and auto-detected account import,
  chain management with node validation, idle lock, popup and full-tab layouts.
- Read-only dashboard: balances, resources, governance columns, price badge, per-account refresh.
- Transactions: build, sign and broadcast through the service worker, Greymass Fuel with byte-level
  validation of the cosigned transaction, an error taxonomy, unsigned export for watch accounts.
- Signing requests: ESR parsing, prompt window with review, identity, success and error stages,
  callbacks, link capture that also reaches closed shadow roots, context menu entry.
- Sessions: anchor-link over buoy, so apps can transact after login with every extension page
  closed; connected apps and link service panels.
- Tools: backup and restore including Anchor Desktop files, key management and generator, contacts,
  custom tokens, pending account creation, permissions editor, name auctions, account creation,
  smart contract browser, history, API ping and the ABI cache.
- Resources: PowerUp and REX rentals, RAM buy and sell, delegation reclaim.
- Governance: producer voting with a 30-slot selector, proxies, proxy registration.
- Interface: English and Bahasa Indonesia, light and dark themes, block explorer chooser.
- `window.nussio` provider: `login`, `transact`, `sign`, `isConnected` and `disconnect`, each behind
  the signing prompt, with per-origin connections listed and revocable under Settings.

### Security

- Sender guard on the service messaging channel, blocking calls that do not come from an extension
  page of this extension (CVE-2023-40580 shape).
- Signing request size and decompression caps; per-origin rate limit on link capture.
- Provider calls are gated per origin: only `login` works unconnected, method names come from a
  fixed allowlist, arguments are capped at 32 KB, and the origin is read from the message sender.
- Threat model in `docs/security.md`.

### Fixed

- Legacy keyring decryption used the wrong hash, so no real Anchor Desktop backup could be read.
- Proton showed a SYS balance labelled XPR.
- WAX and WAX Testnet had PowerUp and name bidding hidden.
- Settings added after an install were read as undefined until the storage migration landed.
