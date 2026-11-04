# tyto-template-voce-conhece

`voce-conhece`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its own
repository: a "do you know the difference" carousel at 1080×1350 — a cover with the question,
explanation slides with coloured highlights and pictures among the lines, and a sign-off.

**This repository holds the composition only.** The logo and the signature are not here: Tyto
hands them to the template from the brand kit installed on the machine, under the manifest's
brand `marinho`, and without one it draws placeholders (Tyto ADR 0063, ADR 0065). The cover's
picture and every image are the brief's. The example brief is invented copy.

## Install into Tyto

A plugin file pins the template to a release (Tyto ADR 0151). Save this as
`TYTO_HOME/plugin-files/voce-conhece.yaml` (`~/.tyto` by default), or as
`.tyto/plugin-files/voce-conhece.yaml` beside a project's briefs:

```yaml
version: 1
templates:
  voce-conhece:
    source:
      git: https://github.com/rafaelsilvalor/tyto-template-voce-conhece.git
      ref: v0.1.0
```

Or install the default branch, as it is:

```
tyto plugin install git+https://github.com/rafaelsilvalor/tyto-template-voce-conhece.git
```

Tyto never builds what it fetches, so `dist/index.js` is committed on `main` and every release is
a tag of it. A pack brings templates and no formats: copy `templates/formats.yaml` into the
project that renders `voce-conhece`, or merge its `grid` line into the project's own.

## Writing a brief

```
---
template: voce-conhece
formats: [grid]
---

::lamina {capa}
  Você sabe a diferença entre
  Trocador de calor e regenerador térmico?

::lamina
  O **trocador de calor** passa a energia através de uma parede.
  Já o {cor:azul}regenerador{/} guarda o calor numa matriz sólida.

::lamina {fecho}
```

- **The cover**, `{capa}`: its first line is the lead, the rest the title, both in capitals.
- **An explanation**, an unmarked `::lamina`: each line one paragraph. `**x**` is a highlight
  at the highlight's weight and colour; `{cor:azul}x{/}`, `vermelho`, `verde` and `ocre` are
  the four coloured ones. Math is written as Unicode characters (`ΔT`, `·`, `≤`).
- **The sign-off**, `{fecho}`: empty, or one line that replaces its title.

## What it may reach

| Permission        | Why                                                               |
| ----------------- | ----------------------------------------------------------------- |
| `font:CircularXX` | Every word is set in CircularXX, a licensed face (Tyto ADR 0048). |

**The install asks for it once.** Faces Tyto ships cross to a plugin freely; a face installed
on the machine crosses only under this permission.

## What a configuration may change

`templates/voce-conhece/manifest.yaml` declares the colours and the highlight's weight as
`values` (Tyto ADR 0153). A configuration changes a value, never which pieces are drawn (Tyto
ADR 0151).

## Development

`pnpm check` runs Prettier, the type checker, ESLint and the tests; `pnpm build` writes
`dist/index.js`, one ES module with every `@tyto` import inlined, which is committed and which
CI rebuilds and compares.

The template depends on Tyto's published contract, held by GitHub Packages under the owner's
scope (Tyto ADR 0149) and aliased in `package.json`. The committed `.npmrc` names the scope
only. GitHub asks for a token with `read:packages` even for public packages; hand it to pnpm
for the one command:

```sh
pnpm install "--//npm.pkg.github.com/:_authToken=$(gh auth token)"
```

The tests, all without Tyto:

- `src/template.test.ts`: the carousel's rules on the scene.
- `tests/examples.test.ts`: the example brief compiled as Tyto compiles it, through
  `@tyto/template-kit/testing` (Tyto ADR 0152), against the HTML of each slide in
  `tests/__snapshots__/`.
- `tests/faces.test.ts`: the manifest's `faces` are exactly the faces the example draws — in a
  plugin's process a face left out measures as nothing.
- `tests/values.test.ts`: each declared default pinned to the one the code falls back to, and a
  colour set in a test found in the HTML.
- `tests/plugin.test.ts`: the built `dist/index.js`, loaded through
  `@tyto/plugin-api/testing` (Tyto ADR 0150), drawing a slide across the isolation protocol.

The `contract` workflow runs every day against the newest published contract, past the ranges
`package.json` asks for, so a Tyto release that breaks this template turns it red before
somebody installs it.
