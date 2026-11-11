# How to write a `voce-conhece` brief

`voce-conhece` is a 1080×1350 carousel that explains the difference between two things: a
**cover** (the call "Você sabe a diferença entre" and the title in capitals, with a "Confira"
button), **explanation slides** (paragraphs with coloured highlights, pictures among the lines
and an optional title) and a **sign-off** ("Gostou do conteúdo?" and four rows of icons).

Recognise it by the request: "você sabe a diferença", "qual a diferença entre", "você conhece",
or technical content comparing two concepts.

## Slots

| Slot     | Where                                       | Rule                                                                                                                                                                                                                               |
| -------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lamina` | directive, repeated                         | 1 to 10 slides; see Normalisation.                                                                                                                                                                                                 |
| `fundo`  | frontmatter                                 | Optional image, 1080×1350: the cover's background, full bleed. Without it the cover is plain.                                                                                                                                      |
| `imagem` | directive `::imagem ./file.png`, in a slide | Pictures, as many as needed, each where its line stands, in a frame; `::imagem {sem-quadro} ./file.png` drops that picture's frame.                                                                                                |
| `selo`   | frontmatter                                 | Optional, 1080×140: `selo: ./selo.png`. At the foot of the **last** slide (usually the sign-off); its signature moves up 140. On an explanation as the last slide, the paragraphs fit the page above. Only when the person has it. |

There is no `::titulo` and no `::fecho` in this template. Format: `formats: [grid]` only.

## Normalisation

Each slide says what it is by its mark in braces:

1. **`::lamina {capa}`**, first: the **1st line is the call** ("Você sabe a diferença entre"),
   the **following lines are the title** ("Ponte rolante e pórtico?"). Write in ordinary case:
   the template sets capitals. The type size adjusts by itself.
2. **`::lamina`** with no mark, an **explanation**: **each line is a paragraph**.
3. **`::lamina {titulo}`**: an explanation whose **1st line is the slide's title** (capitals,
   heavy, in the deep colour by default); the rest are paragraphs. The title accepts
   `{cor:azul|vermelho|verde|ocre}part{/}` in that colour. `**part**` in the title changes
   nothing visible: it is already the heaviest weight; use `{cor:…}` to highlight there.
4. **`::lamina {fecho}`**, last: empty, or **one line**, which replaces the title "Gostou do
   conteúdo?".

**Highlights** inside paragraphs:

- `**part**` — a highlight in the text's colour, heavier (Medium).
- `{cor:azul}part{/}`, `{cor:vermelho}…{/}`, `{cor:verde}…{/}`, `{cor:ocre}…{/}` — a coloured
  highlight, also heavier. Only these four colours exist.

Highlight only where the original text highlights something; never a whole sentence.

**Maths** goes in as Unicode characters, straight in the text: `Q = U · A · ΔT`, `≤`, `≥`, `²`,
`√`, `π`, `Δ`. What the text face lacks comes out in Tyto's symbol face without overlapping; an
operator (`=`, `+`, `·`) never starts a line. A built formula (stacked fraction, root with a
bar) goes in as a picture. A number and its unit never split at a break (`3 s`, `2 m/s²`):
write an ordinary space. To keep a whole formula on one line, replace **its** spaces with
no-break spaces (U+00A0); only for a short formula, or it will not fit the line.

**Pictures among the text:** a line `::imagem ./file.png`, not indented, **after** the
`::lamina` and **where it appears**; the indented lines under it continue the slide. Only
explanation slides take pictures; the cover and the sign-off do not. The frame takes the height
the picture's shape asks for, between a 3:1 band and a square.

**With or without a frame:** by default a picture is framed (a border, a bar on the left and a
shadow). For a picture without a frame — a cut-out photo, a diagram with its own background —
write the mark on its line, **before** the file: `::imagem {sem-quadro} ./foto.png`. The mark
holds for that picture only; the others on the slide stay framed.

The "next slide" arrow, the logo and the signature are drawn by themselves.

## How to split into slides

Paragraphs are drawn at 40 px and shrink to 30 px when they do not fit; below that Tyto warns
`W_TEMPLATE_OVERFLOW` — then **split into one more `::lamina`**. Measured: a reference slide of 2
paragraphs and 251 characters uses 7 lines and fills less than half the slide. Count on up to
about 600 characters per slide without a picture, and fewer with a picture or a title (an
estimate from that measure, not measured at the limit).

## Example

Copy (invented):

```
Você sabe a diferença entre ponte rolante e pórtico?
A ponte rolante corre sobre trilhos presos à estrutura do galpão, no alto. Já o pórtico tem
pernas próprias e corre sobre trilhos no piso.
Na prática: a carga admissível segue P ≤ 0,8 · Pmáx.
```

Brief:

```brief
---
template: voce-conhece
formats: [grid]
---
::lamina {capa}
  Você sabe a diferença entre
  Ponte rolante e pórtico?

::lamina
  A **ponte rolante** corre sobre trilhos presos à estrutura do galpão, no alto.
  Já o {cor:azul}pórtico{/} tem pernas próprias e corre sobre trilhos no piso.

::lamina {titulo}
  Na prática
  A carga admissível segue P ≤ 0,8 · Pmáx.

::lamina {fecho}
```

## Known traps

- **"Unknown template"**: the plugin is not installed, or the Tyto is older than the plugin API
  the manifest's `engine` asks for.
- **A colour outside the four** (`{cor:roxo}`): comes out as plain text, with no highlight and
  no warning. Use only azul, vermelho, verde or ocre.
- **Symbols no face has**: subscript letters (`ₐ ₑ ₒ ₓ`…) and `℃`; Tyto warns
  `W_GLYPH_MISSING`. Write `°C` and numeric subscripts (`x₁`), or use a picture.
- **`{sem-quadro}` after the file** (`::imagem ./x.png {sem-quadro}`) is ignored without a
  warning.
- **The cover's title on the call's line**: the cover's 1st line is always the call; the title
  goes on the line below.
