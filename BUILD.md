# Building the Firefox add-on from source

This is the reproducible build for the file uploaded to addons.mozilla.org. The same tree also
produces the Chrome build (`pnpm zip`), which is not needed for review.

## Environment

- Linux or macOS. The release was built on macOS (arm64); GitHub Actions builds the same output on
  `ubuntu-latest`.
- Node.js 22.x — the release used 22.18.0. Install from https://nodejs.org or with your version
  manager (`nvm install 22`).
- pnpm 11.25.0, pinned in the `packageManager` field of `package.json`. Node ships Corepack, which
  installs exactly that version:

  ```bash
  corepack enable
  corepack prepare pnpm@11.25.0 --activate
  ```

No other tools are required. Network access is needed once, to fetch the dependencies listed in
`pnpm-lock.yaml`.

## Steps

```bash
unzip nussio-wallet-<version>-sources.zip -d nussio-wallet
cd nussio-wallet
./scripts/build-firefox.sh
```

The script checks the Node version, enables Corepack if `pnpm` is missing, installs dependencies
with `--frozen-lockfile`, and runs `pnpm zip:firefox`. Done by hand, that is:

```bash
pnpm install --frozen-lockfile
pnpm zip:firefox
```

## Output

- `dist/firefox-mv3/` — the unpacked add-on.
- `dist/nussio-wallet-<version>-firefox.zip` — the file submitted to AMO.
- `dist/nussio-wallet-<version>-sources.zip` — this source archive, regenerated.

The bundler (WXT 0.20 on Vite with Rolldown) names chunks by content hash and writes zip entries
with a fixed 1980-01-01 timestamp, so a rebuild from the same sources yields the same archive.
To compare against the uploaded file, unzip both and `diff -r` the directories.

## What is generated, and from what

| generated                           | source                                                     |
| ----------------------------------- | ---------------------------------------------------------- |
| `dist/firefox-mv3/*.js`, `chunks/*` | `src/**/*.ts` and `src/**/*.vue`, compiled and bundled     |
| `dist/firefox-mv3/*.css`            | Tailwind classes used in `src/`, via `@tailwindcss/vite`   |
| `dist/firefox-mv3/manifest.json`    | `wxt.config.ts` (`manifest` block) plus `src/entrypoints/` |
| `.wxt/`                             | TypeScript declarations, written by `wxt prepare`          |

Nothing under `src/` is machine-generated. `src/components/ui/` was scaffolded by shadcn-vue and
then edited by hand; `src/locales/` is hand-maintained JSON.

## Validator warnings

`web-ext lint` reports three warnings on the built add-on, none from this project's code:

- "Unsafe assignment to innerHTML" — Vue 3's runtime (`v-html` setter and template mount). `src/`
  uses neither `v-html` nor `innerHTML`.
- "The Function constructor is eval" (twice) — zod's JIT feature probe, `try { Function('') }
catch {}`. Under the extension CSP it throws and zod uses its non-JIT path. No string is
  evaluated.
