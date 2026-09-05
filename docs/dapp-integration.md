# Integrating a dApp

Nussio Wallet speaks the protocols Anchor speaks, so apps built on
[wharfkit](https://wharfkit.com) with `@wharfkit/wallet-plugin-anchor` work unchanged. There is
nothing Nussio-specific to install.

## What the wallet handles

| entry point                                                        | how it reaches the wallet                                                                         |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| A link with an `esr:`, `esr-anchor:`, `anchor:` or `eosio:` scheme | the content script captures the click, including inside closed shadow roots, and opens the prompt |
| `window.open('esr:…')`                                             | patched in the page world and captured                                                            |
| A pasted request                                                   | Broadcast → Signing request, or the popup                                                         |
| A session request                                                  | delivered over the buoy channel created at login                                                  |

`window.location.href = 'esr:…'` cannot be captured by any extension; browsers do not route unknown
schemes to one. wharfkit tries this first and logs a failure, then shows its "Launch Anchor" button,
which does work.

## Login and sessions

An identity request that carries a `link` info key gets `link_ch`, `link_key`, `link_name` and
`link_meta` back in the callback, which is what `anchor-link` needs to open a session. After that
the app can call `transact()` with every extension page closed: the request travels sealed over the
relay, the wallet decrypts it and opens the prompt.

`link_meta` reports `sameDevice: false`, so wharfkit offers the QR and link fallback the extension
can capture rather than a same-device redirect it cannot.

## Requests the wallet refuses

- `updateauth`, `linkauth` and `deleteauth` on `owner` or `active`, unless the user has enabled
  dangerous transactions in Settings.
- Requests over 16 KB, or whose payload decompresses past 500 KB.
- More than five capture attempts from one origin in ten seconds.

## Callbacks

Both background POST callbacks and foreground redirects are supported, with the standard template
variables including `cid`, `sig0…N`, `bn` and `tx`. Cancelling posts `{"rejected": …}` to the
callback URL, so an app should treat that as a user decline rather than a timeout.

## Testing against the wallet

1. `pnpm build`, then load `dist/chrome-mv3` unpacked.
2. Import a Jungle 4 account.
3. Point your app at Jungle 4 and log in with the Anchor plugin; the prompt opens on the identity
   request.
4. Call `transact()`; the request arrives through the session channel.

## Not implemented

`window.nussio` is present but every method rejects with `not_implemented`. A provider API with
per-origin permission prompts is planned; until then use the ESR and anchor-link paths above.
