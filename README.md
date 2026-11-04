# tyto-template-voce-conhece

`voce-conhece`, a [Tyto](https://github.com/rafaelsilvalor/tyto) code template in its own
repository: a "do you know the difference" carousel at 1080×1350 — a cover with the question,
explanation slides with coloured highlights and pictures among the lines, and a sign-off.

**This repository holds the composition only.** The logo and the signature are not here: Tyto
hands them to the template from the brand kit installed on the machine, under the manifest's
brand `engenharia`, and without one it draws placeholders (Tyto ADR 0063, ADR 0065). The cover's
picture and every image are the brief's. The example briefs are invented copy:
`diferenca.brief` and `formula.brief`, which writes Greek letters and operators.

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
      ref: v0.4.0
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

::lamina {titulo}
  Na prática
  A taxa segue Q = U · A · ΔT.
::imagem ./grafico.png
  A área cresce quando ΔT cai.

::lamina {fecho}
```

- **The cover**, `{capa}`: its first line is the lead, the rest the title, both in capitals.
  The lead is set at the largest size between `lead-floor` and `lead-ceiling` that keeps it on
  one line, and wraps at the floor; the title at the largest between `title-floor` and
  `title-ceiling` at which no word runs past the cover and it ends over the button, reported as
  `W_TEMPLATE_OVERFLOW` when not even the floor does. `fundo: ./arte.png` in the frontmatter
  is a 1080 × 1350 picture under the words, full bleed; without it the cover is flat `deep`.
- **An explanation**, an unmarked `::lamina`: each line one paragraph. `**x**` is a highlight
  at the highlight's weight and colour; `{cor:azul}x{/}`, `vermelho`, `verde` and `ocre` are
  the four coloured ones, at the same weight. Math is written as Unicode characters (`ΔT`,
  `·`, `≤`, `∇`, `ε₀`): a glyph CircularXX lacks is drawn in Tyto's bundled symbol faces,
  Noto Sans Math and then Source Sans 3 (Tyto ADR 0168). The paragraphs are set at the largest size between `body-floor` and
  `body-ceiling` (the reference's 40 px) that fits between the logo and the footer, and the
  block is centred where the reference centres it.
- **A title on an explanation**, `{titulo}`: the slide's first line is drawn over the
  paragraphs as the cover's title is (Black, capitals, the accent), at the largest size between
  `slide-title-floor` and `slide-title-ceiling` at which no word runs past the paragraphs.
- **Pictures**: `::imagem ./figura.png` after the slide's `::lamina` shows the file where it is
  written among the lines, in questao-estrategica's frame (a border with a bar down the left,
  rounded inside corners and a shadow), its border in `deep`. The frame is as tall as the
  picture's shape makes it (Tyto ADR 0158, ADR 0160), from a 3:1 band to a square; the
  indented lines under it go on. `::imagem {sem-quadro} ./foto.png` draws that picture without
  the frame, at the paragraphs' place and width, between the same 3:1 and square.
- **The sign-off**, `{fecho}`: empty, or one line that replaces its title.
- **No lone word** (Tyto ADR 0167): no title or paragraph ends on a line of one word. The
  template moves a word down from the line above, spaces the letters by up to a hundredth of an
  em or, for a title, sets it up to 8% smaller, never under its floor; the paragraphs keep the
  size they share. A word nothing within those limits clears stays, and the render reports
  `W_TEMPLATE_ORPHAN` naming it. Two words joined by a no-break space move together.

## What it may reach

| Permission        | Why                                                               |
| ----------------- | ----------------------------------------------------------------- |
| `font:CircularXX` | Every word is set in CircularXX, a licensed face (Tyto ADR 0048). |

**The install asks for it once.** Faces Tyto ships cross to a plugin freely; a face installed
on the machine crosses only under this permission. The reference sets the cover in ExtraBlack,
which Tyto has no face for: it is Black (900), the maintainer's call.

## What a configuration may change

`templates/voce-conhece/manifest.yaml` declares, as `values` (Tyto ADR 0153):

- ten colours: `deep` (the cover's and the sign-off's), `accent`, `on-deep`, `paper`,
  `body-ink`, `highlight-color` (`**x**`) and the four `mark-cor-azul`, `-vermelho`, `-verde`
  and `-ocre`, the names every Tyto template shares (0.4.0 renamed them from `highlight-ink` and
  `highlight-<colour>`: a configuration that set the old names sets the new ones). The accent is the brand kit's when it has one (Tyto ADR 0155); `#1d9ad5` is a
  neutral stand-in.
- `highlight-weight` (500): set at the nearest of the faces the manifest lists.
- four pairs of floor and ceiling, the font sizes each text is fitted between: `lead-*`,
  `title-*`, `slide-title-*` and `body-*`.
- `orphan-shrink` (0.08) and `orphan-tracking` (0.01 em): how far a text may move to keep a
  word off its last line, questao-estrategica's limits; 0 turns either off.
- `cover-background`, an image with no default: the cover's picture for every brief of a
  configuration; a brief's own `fundo` wins over it.

A configuration changes a value, never which pieces are drawn (Tyto ADR 0151).

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

- `src/template.test.ts`: the carousel's rules on the scene — the slide each mark makes, the
  arrow and button on every slide but the last, capitals as Portuguese writes them, each size
  between its floor and ceiling and the overflow warning, the highlights' weight and colours
  (an unknown colour left plain), the `{titulo}`, and pictures among the lines in the order
  written, held between 3:1 and square.
- `tests/examples.test.ts`: the example briefs compiled as Tyto compiles them, through
  `@tyto/template-kit/testing` (Tyto ADR 0152), against the HTML of each slide in
  `tests/__snapshots__/`.
- `tests/faces.test.ts`: the manifest's CircularXX faces are exactly the ones the examples
  draw, and the rest are Tyto's symbol chain at every weight they draw (Noto Sans Math, then
  Source Sans 3 at 400 or 700, Tyto ADR 0168) — in a plugin's process a face left out measures
  as nothing.
- `tests/values.test.ts`: each declared default pinned to the one the code falls back to, and a
  colour set in a test found in the HTML.
- `tests/plugin.test.ts`: the built `dist/index.js`, loaded through
  `@tyto/plugin-api/testing` (Tyto ADR 0150), drawing a slide across the isolation protocol.

The `contract` workflow runs every day against the newest published contract, past the ranges
`package.json` asks for, so a Tyto release that breaks this template turns it red before
somebody installs it.
