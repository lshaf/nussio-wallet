# Changelog

Notable changes per release. Dates are the tag date.

## Unreleased

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

### Security

- Sender guard on the service messaging channel, blocking calls that do not come from an extension
  page of this extension (CVE-2023-40580 shape).
- Signing request size and decompression caps; per-origin rate limit on link capture.
- Threat model in `docs/security.md`.

### Fixed

- Legacy keyring decryption used the wrong hash, so no real Anchor Desktop backup could be read.
- Proton showed a SYS balance labelled XPR.
- WAX and WAX Testnet had PowerUp and name bidding hidden.
- Settings added after an install were read as undefined until the storage migration landed.
