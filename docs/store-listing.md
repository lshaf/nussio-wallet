# Store listing

Copy for the Chrome Web Store and Firefox Add-ons submissions. Keep in step with `PRIVACY.md`.

## Name

Nussio Wallet

## Summary (132 characters max)

Wallet for Antelope blockchains. Signs requests from apps, supports the Ledger hardware wallet, and
keeps your keys on your device.

## Description

Nussio Wallet keeps your Antelope accounts in the browser and signs for them without sending your
keys anywhere. The main public Antelope networks and their testnets come preconfigured, and any
other Antelope chain can be added by entering its API endpoint. The Ledger hardware wallet is
supported.

ACCOUNTS

- Import an account with its private key, watch one read-only, or let the wallet find the accounts
  a key already controls.
- Ledger hardware wallet support: connect a device running the Antelope app, choose the accounts it
  holds, and review and approve every transaction on the device. The key never touches the browser.

EVERYDAY USE

- See balances, CPU, NET and RAM usage, staking and voting position for every account on a chain.
- Send tokens, stake and unstake, claim refunds, rent resources through PowerUp or REX, and buy or
  sell RAM.
- Vote for block producers or through a proxy, and manage your account's permissions.

APPS

- Sign requests from any app that supports the Anchor protocol. After one login the app can keep
  sending requests over an encrypted channel, and each one is still shown to you for approval.
- Apps can also call the wallet directly through window.nussio. Nothing is signed silently, and the
  prompt always shows what was requested.

TOOLS

- Manage keys and contacts, track custom tokens, browse contract tables and call actions, read
  transaction history, compare API node latency, and make encrypted backups that Anchor Desktop can
  also read.

WHAT IT ASKS FOR

- No host permissions. The extension never asks to read or change data on the sites you visit; its
  content script only recognises signing-request links and provides window.nussio.
- No accounts, no analytics, no telemetry. Network requests go only to the blockchain nodes and
  relays you configure.

Private keys are encrypted with your password using 600,000 rounds of PBKDF2 and AES-256-GCM. They
are decrypted only inside the extension's background worker, only while unlocked, and never leave
your device. The wallet locks itself when you go idle.

Available in English and Bahasa Indonesia.

Nussio Wallet is open source under the MIT license and is built on the feature set, translations
and protocol handling of Anchor Wallet by Greymass. It is not affiliated with or endorsed by
Greymass.

Website: https://nussio.xid.run/
For app developers: https://nussio.xid.run/developers.html
Source: https://github.com/lshaf/nussio-wallet

Do not list chain names in the summary or description. The 2026-09-16 review rejected
"EOS, WAX, Telos, Proton, Libre, FIO, UX Network" as keyword spam (reference Yellow Argon).

## Category

Productivity (Chrome) · Privacy & Security (Firefox)

## Permission justifications

| permission                   | justification                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storage`                    | Stores the encrypted keyring, accounts, blockchain configuration and preferences on the device. Nothing is uploaded.                                                                                                                                                                                                                                                                                                                                                                                     |
| `alarms`                     | Keeps the signing-request channel alive and schedules the idle lock while the background worker sleeps.                                                                                                                                                                                                                                                                                                                                                                                                  |
| `idle`                       | Locks the wallet after the inactivity period the user chooses.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `contextMenus`               | Adds "Open with Nussio Wallet" so a user can send a signing-request link to the wallet.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `clipboardWrite`             | Copies keys, transaction JSON and signing requests when the user presses a copy button.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `sidePanel`                  | Opens the wallet in Chrome's side panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Content scripts on all sites | The wallet has to recognise `esr:` signing-request links, which appear on any site, and expose `window.nussio` to a dApp before its scripts look for it. Both need to run at document start, so `activeTab` cannot serve them: it only grants access after a click on the extension action. No page content is read; the script matches request links and nothing else. Host permissions themselves are optional and ungranted, because every endpoint the wallet contacts answers with permissive CORS. |

## Data collection disclosure

No data is collected. No analytics, no telemetry, no account. Network requests go only to the
blockchain nodes and relays listed in `PRIVACY.md`, all of which the user can change.

## Screenshots to capture (1280x800)

1. Overview with two accounts and the balance table.
2. Signing prompt showing a transfer under review.
3. Resources page with CPU, NET and RAM gauges.
4. Governance producer list with votes selected.
5. Tools index.

Generate them with `pnpm shots:store`. Output lands in `store/screenshots/` at exactly 1280x800,
no cropping needed. The signing prompt is a 420px window, so it is composited centred on a dark
canvas rather than stretched.

## Support

Repository issue tracker. Privacy policy: `PRIVACY.md`.
