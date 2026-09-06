# Store listing

Copy for the Chrome Web Store and Firefox Add-ons submissions. Keep in step with `PRIVACY.md`.

## Name

Nussio Wallet

## Summary (132 characters max)

Antelope wallet and signing request authenticator for EOS, WAX, Telos, Proton and Libre. Keys stay
on your device.

## Description

Nussio Wallet keeps Antelope accounts in your browser and signs for them without sending your keys
anywhere.

- Import accounts by private key, watch any account read-only, or let the wallet find accounts your
  keys already control.
- See balances, CPU, NET and RAM, staking, REX and voting position across every account on a chain.
- Send tokens, stake and unstake, claim refunds, rent through PowerUp or REX, and buy or sell RAM.
- Sign requests from apps that support Anchor. Log in once and the app can keep sending requests
  through an encrypted channel, with every request still needing your approval.
- Vote for block producers, set a proxy, register as one, and edit account permissions.
- Tools for keys, contacts, custom tokens, contract tables and actions, transaction history, API
  node latency and encrypted backups that Anchor Desktop can also read.

Private keys are encrypted with your password using 600,000 rounds of PBKDF2 and AES-256-GCM. They
are decrypted only inside the extension's background worker, only while unlocked, and never leave
your device. The wallet locks itself when you go idle.

Available in English and Bahasa Indonesia.

Nussio Wallet is open source under the MIT license and is built on the feature set, translations
and protocol handling of Anchor Wallet by Greymass. It is not affiliated with or endorsed by
Greymass.

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
