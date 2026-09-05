# Privacy policy

Nussio Wallet, last updated 2026-09-05.

## What the extension stores

Everything stays on your device, in the browser's extension storage:

- Private keys, encrypted with your wallet password (PBKDF2-SHA256, 600,000 rounds, AES-256-GCM).
- Wallet accounts, blockchain settings, contacts, tracked tokens and interface preferences.
- Sessions with apps you logged in to, and signing requests waiting for your decision.

Unlocked keys live in session storage and are cleared when you lock the wallet, when the idle
timeout fires, and when the browser closes.

## What leaves your device

The extension talks to servers you can see and change in Settings:

| destination                                               | what is sent                                          | why                                         |
| --------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------- |
| The API node of each enabled blockchain                   | account names you view, transactions you sign         | reading balances and sending transactions   |
| Greymass Fuel (chains where it is enabled)                | the unsigned transaction                              | covering network resources                  |
| The link relay (`cb.anchor.link` by default)              | encrypted signing requests from apps you logged in to | receiving requests while the wallet is idle |
| A Hyperion history node, only on the History screen       | the account name you are viewing                      | listing past actions                        |
| The block explorer you choose, only when you click a link | the transaction id                                    | opening the explorer                        |
| An API node you ping, only on the API ping screen         | a `get_info` request                                  | measuring latency                           |

Every one of these learns your IP address, as any web request does.

## What we do not do

- No analytics, telemetry, crash reporting or advertising identifiers.
- No account, sign-up or server owned by this project.
- Private keys are never sent anywhere. They are used only inside the extension's service worker
  to produce signatures.
- Page content is not read. The content script looks only for signing-request links you click.

## Permissions

`storage`, `alarms`, `idle`, `contextMenus`, `clipboardWrite`, `sidePanel` and access to all sites.
The site access exists because blockchain API nodes, history nodes and the link relay are
addresses you choose, and because signing-request links can appear on any website. See
`docs/security.md` for the full justification.

## Your data, your control

Settings → Danger zone deletes everything the extension stored. Uninstalling removes it as well.
Back up before either: keys that exist only here cannot be recovered.

## Contact

Report a problem through the repository's issue tracker.
