# Integrating a dApp

Apps built on [wharfkit](https://wharfkit.com) have two routes in. The
[`nussio-wharfkit-plugin`](https://www.npmjs.com/package/nussio-wharfkit-plugin) wallet plugin talks
to the extension directly. And because Nussio Wallet speaks the protocols Anchor speaks, an app
using `@wharfkit/wallet-plugin-anchor` works unchanged with nothing Nussio-specific installed.

## The wharfkit plugin

```sh
npm i nussio-wharfkit-plugin @wharfkit/session
```

```ts
import { SessionKit } from '@wharfkit/session';
import { WalletPluginNussio } from 'nussio-wharfkit-plugin';

const kit = new SessionKit({ ..., walletPlugins: [new WalletPluginNussio()] });
```

| session call   | what the plugin does                                                                                                                                                        |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kit.login()`  | `window.nussio.login(chainId)` for the chain wharfkit selected. The prompt asks the user to pick an account and approve the site.                                           |
| `transact()`   | Encodes the resolved transaction as a non-broadcast signing request and calls `window.nussio.sign(uri)`. The extension signs; wharfkit broadcasts exactly what it resolved. |
| `kit.logout()` | `window.nussio.disconnect()`, dropping the site connection. Never throws.                                                                                                   |

`requiresChainSelect` is `true`, so the chain comes from `kit.login({ chain })`, the single
configured chain, or the UI's chain picker; it must be enabled in the extension. Fuel does not run on
this path because the extension never broadcasts, so use
`@wharfkit/transact-plugin-resource-provider` for cosigned resources. Extension rejections surface
as `NussioWalletError` carrying the same string codes the provider uses. Source, tests and the full
option list live at [lshaf/nussio-wharfkit-plugin](https://github.com/lshaf/nussio-wharfkit-plugin).

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
3. Point your app at Jungle 4 and log in with the Nussio plugin or the Anchor plugin; the prompt
   opens on the identity request.
4. Call `transact()`; with the Nussio plugin the prompt opens directly, with the Anchor plugin the
   request arrives through the session channel.

## The `window.nussio` provider

Every page gets a frozen `window.nussio` in the page world. It is a thin alternative to the ESR and
anchor-link paths for apps that would rather call the wallet directly. Five methods, nothing else:

| method            | argument                                                                                        | resolves with                                      |
| ----------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `login(chainId?)` | optional chain id, defaults to the wallet's current chain                                       | `{ chainId, actor, permission }`                   |
| `transact(args)`  | `{ action }`, `{ actions }`, `{ transaction }` or a request URI; `broadcast` defaults to `true` | `{ chainId, transactionId, blockNum, signatures }` |
| `sign(uri)`       | an `esr:` request URI                                                                           | same as `transact`                                 |
| `isConnected()`   | —                                                                                               | `true` when this origin has an approved login      |
| `disconnect()`    | —                                                                                               | `true`, after the connection is dropped            |

```js
if (window.nussio?.isNussioWallet) {
  const { actor, permission } = await window.nussio.login();
  await window.nussio.transact({
    action: {
      account: 'eosio.token',
      name: 'transfer',
      data: { from: actor, to: 'teamgreymass', quantity: '1.0000 EOS', memo: '' },
    },
  });
}
```

Rules the provider enforces:

- `login` is the only method that works without an approved connection. `transact` and `sign` reject
  with `not_connected` until the user approves a login for that exact origin.
- The origin comes from the sender of the message, never from anything the page passes.
- An action with no `authorization` is signed by the connected account; an action that names its own
  authorization is left alone and the prompt shows what it asked for.
- Every call still opens the prompt. There is no silent signing, and no method that reads keys.
- Rejections are strings: `not_connected`, `rejected`, `connections_disabled`, `invalid_params`,
  `unknown_method`, `unknown_chain`, `rate_limited`, `params_too_large`.
- The user can drop a connection any time under Settings → Connected websites, and turn the whole
  provider off with "Allow websites to connect to this wallet".

A cancelled prompt rejects with `rejected`. A prompt left open for five minutes rejects the same way.
