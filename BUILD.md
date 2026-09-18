# Building the Firefox add-on from source

This is the reproducible build for the file uploaded to addons.mozilla.org. The same tree also
produces the Chrome build (`pnpm zip`), which is not needed for review.

## Environment

- Linux or macOS, x86-64 or ARM64. Verified identical output on Ubuntu (Node 22 and Node 24, ARM64)
  and macOS (Apple silicon).
- Node.js 22 or 24. Install from https://nodejs.org or with a version manager (`nvm install 22`).
- pnpm 11.25.0, pinned in the `packageManager` field of `package.json`. Node ships Corepack, which
  installs exactly that version:

  ```bash
  corepack enable
  corepack prepare pnpm@11.25.0 --activate
  ```

Use pnpm, not npm or yarn: `pnpm-lock.yaml` fixes every dependency version, and another package
manager resolves them differently and produces a different bundle.

Network access is needed once, to fetch the dependencies listed in `pnpm-lock.yaml`.

## Steps

```bash
unzip nussio-wallet-<version>-sources.zip -d nussio-wallet
cd nussio-wallet
pnpm install --frozen-lockfile
pnpm zip:firefox
```

`scripts/build-firefox.sh` runs the same two commands after checking the Node version, and prints
the SHA-256 of the results. The zip archive does not keep the execute bit, so run it through `sh`:

```bash
sh scripts/build-firefox.sh
```

To build in a clean container instead of a local toolchain, from the unzipped directory:

```bash
docker run --rm -v "$PWD":/work -w /work node:22 sh -c \
  "corepack enable && corepack prepare pnpm@11.25.0 --activate && sh scripts/build-firefox.sh"
```

## Output

- `dist/firefox-mv3/` — the unpacked add-on.
- `dist/nussio-wallet-<version>-firefox.zip` — the file submitted to AMO.
- `dist/nussio-wallet-<version>-sources.zip` — this source archive, regenerated.

The bundler (WXT 0.20 on Vite with Rolldown) names chunks by content hash and writes zip entries
with a fixed 1980-01-01 timestamp, so a rebuild from the same sources yields the same archive:
`sha256sum dist/nussio-wallet-<version>-firefox.zip` matches the uploaded file. If it does not,
unzip both and `diff -r` the directories to see which file moved.

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
