/**
 * `voce-conhece` — a "do you know the difference" carousel of 1080×1350 slides.
 *
 * ## The three kinds of slide
 *
 * | slide       | the brief writes          | drawn                                                |
 * | ----------- | ------------------------- | ---------------------------------------------------- |
 * | cover       | `::lamina {capa}`         | the lead line, the title in capitals, the button     |
 * | explanation | `::lamina` with its lines | one paragraph per line, highlights, pictures         |
 * | sign-off    | `::lamina {fecho}`        | the sign-off's title, four rows of icon and words    |
 *
 * One `::lamina` is one slide in Tyto, and a template cannot add slides of its own, so the
 * brief marks the cover and the sign-off.
 *
 * Every position is the reference art's (the maintainer's PSD), in the slide's pixels: a text
 * is placed by the top of its capitals, measured on the reference's flattened image. The logo
 * and the signature are the brand kit's (Tyto ADR 0063), placeholders without one; the accent
 * is the kit's too, when it has one (Tyto ADR 0155); every other colour is a declared value
 * (Tyto ADR 0153) whose default is the reference's.
 *
 * The frame's pieces — the cover's button, the signature at the foot and the sign-off's icon
 * rows — are exported functions of their own, so another template of the same art can draw them.
 */

import {
  colorValue,
  frame,
  image,
  imageValue,
  lineBreak,
  numberValue,
  rect,
  run,
  runsOf,
  solid,
  text,
  vector,
} from '@tyto/core/template';
import { accentOf, drawLogo, oneInk, signatureOf } from '@tyto/house-style';
import {
  ORPHAN_LIMITS,
  at,
  highlightsFromValues,
  imageHeight,
  lines,
  plain,
  reportOrphan,
  reportOverflow,
  settle,
} from '@tyto/template-kit';

import type {
  AssetRef,
  BrandKit,
  ResolvedSlot,
  RichText,
  TemplateBuild,
  TemplateContext,
  TextRun,
} from '@tyto/core';
import type { NodeDraft, TextDraft } from '@tyto/core/template';
import type { HighlightSpec, OrphanLimits, Setting } from '@tyto/template-kit';

/* -------------------------------------------------------------------------- the words -- */

/** The sign-off's title when the brief writes none. */
export const DEFAULT_SIGN_OFF_TITLE = 'Gostou do conteúdo?';

/** The cover's button. */
const BUTTON_WORD = 'Confira';

/* ------------------------------------------------------------------------- the tokens -- */

/** The colours a configuration may change, by declared value name, each the reference's. */
export const COLOR_DEFAULTS = {
  /** The cover's and the sign-off's colour, where no picture covers it. */
  deep: '#204e72',
  /** The cover's title, its button and the sign-off's title, when no brand kit gives one. */
  accent: '#1d9ad5',
  /** The words and icons on the deep colour. */
  'on-deep': '#ffffff',
  /** The paper of the explanation slides. */
  paper: '#ffffff',
  /** The explanation's words, and the signature on paper. */
  'body-ink': '#4d4d4d',
  /** `**x**`'s colour, under the house's shared name (Tyto `docs/template-conventions.md`). */
  'highlight-color': '#4d4d4d',
  /** The four `{cor:…}` highlights, `mark-<family>-<name>` as the house names them. */
  'mark-cor-azul': '#2f628a',
  'mark-cor-vermelho': '#873131',
  'mark-cor-verde': '#39902e',
  'mark-cor-ocre': '#8a662d',
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;
type Ink = (name: ColorName) => string;

/** The numbers a configuration may change, by declared value name (Tyto ADR 0153). */
export const NUMBER_DEFAULTS = {
  /** The weight every highlight is set at, snapped to the nearest face the manifest lists. */
  'highlight-weight': 500,
  /** The cover's title is set at the largest size between these that keeps it in its room. */
  'title-floor': 56,
  'title-ceiling': 94.23,
  /** The explanation's paragraphs, the same way: the reference's 40 px unless they do not fit. */
  'body-floor': 30,
  'body-ceiling': 40,
  /** The cover's lead: the reference's 47.11 px, smaller to stay on one line, down to the floor. */
  'lead-floor': 32,
  'lead-ceiling': 47.11,
  /** An explanation's `{titulo}`, set as the cover's title: the largest size whose words fit. */
  'slide-title-floor': 40,
  'slide-title-ceiling': 56,
  /**
   * How far under its fitted size a title may go to keep a word off a line of its own (Tyto
   * ADR 0167), never under its floor; the paragraphs keep the size they share.
   */
  'orphan-shrink': ORPHAN_LIMITS.shrink,
  /** The most letter spacing, in em, a title or a paragraph may take or give for the same. */
  'orphan-tracking': ORPHAN_LIMITS.tracking,
} as const;

type NumberName = keyof typeof NUMBER_DEFAULTS;

/**
 * The sizes a text may take between its `<name>-floor` and `<name>-ceiling` values, largest
 * first, a pixel apart: the ceiling itself, then down to the floor, which comes last even when
 * the step misses it.
 */
function sizesBetween(
  context: TemplateContext,
  name: 'title' | 'body' | 'lead' | 'slide-title',
): number[] {
  const value = (key: NumberName) => numberValue(context, key, NUMBER_DEFAULTS[key]);
  const floor = value(`${name}-floor`);
  const ceiling = Math.max(floor, value(`${name}-ceiling`));
  const sizes: number[] = [];
  for (let size = ceiling; size > floor; size -= 1) sizes.push(size);
  sizes.push(floor);
  return sizes;
}

/** The `orphan-*` values: how far `settle` may move a text to keep a word off its last line. */
function orphanLimits(context: TemplateContext): OrphanLimits {
  return {
    shrink: numberValue(context, 'orphan-shrink', NUMBER_DEFAULTS['orphan-shrink']),
    tracking: numberValue(context, 'orphan-tracking', NUMBER_DEFAULTS['orphan-tracking']),
  };
}

/** A text's setting before any orphan is looked for: its size, no spacing, its own runs. */
const plainSetting = (size: number): Setting => ({ size, letterSpacing: 0 });

const FACE = { family: 'CircularXX', source: 'system' } as const;
const LIGHT = 300;
const REGULAR = 400;
const MEDIUM = 500;
const BOLD = 700;
/** The reference sets the cover in ExtraBlack, which Tyto has no face for: Black, the maintainer's call. */
const BLACK = 900;
/** The faces the manifest lists: a highlight weight between them is set at the nearest. */
const WEIGHTS = [LIGHT, REGULAR, MEDIUM, BOLD, BLACK] as const;

/**
 * CircularXX's vertical metrics, in em, from its `OS/2` table and the same in every weight: a
 * line of height `lineHeight` puts the content area in its middle, so the capitals start this
 * far below the line's top (measured on concursos-abertos against its reference art).
 */
const ASCENT = 0.75;
const DESCENT = 0.25;
const CAP_HEIGHT = 0.709;

function capOffset(size: number, lineHeight: number): number {
  return size * ((lineHeight - (ASCENT + DESCENT)) / 2 + (ASCENT - CAP_HEIGHT));
}

const SLIDE_WIDTH = 1080;
/** A glyph's advance, in em, for when nothing can be measured (a test, CI without the face). */
const ESTIMATED_ADVANCE = 0.5;

/**
 * The paragraphs' highlights as the kit's data (Tyto TYTO-554): `**x**` in `highlight-color`, and
 * the four `{cor:…}` names the brief may write, each in its `mark-cor-<name>` colour and, like
 * bold, at the highlight's weight. The colours here are the defaults; `highlightsFromValues`
 * lays a configuration's over them.
 */
const HIGHLIGHT_SPEC = {
  bold: { color: COLOR_DEFAULTS['highlight-color'], weight: NUMBER_DEFAULTS['highlight-weight'] },
  marks: {
    cor: {
      like: 'bold',
      values: {
        azul: { color: COLOR_DEFAULTS['mark-cor-azul'] },
        vermelho: { color: COLOR_DEFAULTS['mark-cor-vermelho'] },
        verde: { color: COLOR_DEFAULTS['mark-cor-verde'] },
        ocre: { color: COLOR_DEFAULTS['mark-cor-ocre'] },
      },
    },
  },
} as const satisfies HighlightSpec;

/** The logo on every slide: the reference's owl, 59 px tall. */
const LOGO = { y: 76, height: 59 } as const;

/* --------------------------------------------------------------------------- the build -- */

export type Role = 'capa' | 'explicacao' | 'fecho';

/** Which slide this `::lamina` is: the brief marks every one but an explanation. */
export function roleOf(context: TemplateContext): Role {
  if (context.adjustments['capa'] === true) return 'capa';
  if (context.adjustments['fecho'] === true) return 'fecho';
  return 'explicacao';
}

export const build: TemplateBuild = (context: TemplateContext) => {
  const ink: Ink = (name) => colorValue(context, name, COLOR_DEFAULTS[name]);
  const accent = accentOf(context.brand, ink('accent'));
  const role = roleOf(context);
  const last = context.artwork.index === context.artwork.count - 1;
  const base = { format: context.format, size: context.size, idPrefix: context.idPrefix };

  if (role === 'capa') {
    // The brief's `fundo` wins; else the configuration's `cover-background`; else flat.
    const written = context.slots['fundo']?.value;
    const picture =
      written?.kind === 'image' ? written.asset : imageValue(context, 'cover-background');
    return frame({
      ...base,
      background: solid(ink('deep')),
      children: [
        ...(picture === undefined
          ? []
          : [image({ name: 'fundo', asset: picture, size: context.size, fit: 'cover' })]),
        at(COVER.x, LOGO.y, drawLogo(context.brand, LOGO.height, oneInk(ink('on-deep')))),
        ...cover(context, ink('on-deep'), accent),
        ...(last ? [] : coverButton({ fill: accent, ink: ink('deep') })),
      ],
    });
  }

  if (role === 'fecho') {
    return frame({
      ...base,
      background: solid(ink('deep')),
      children: [
        at(SIDE_X, LOGO.y, drawLogo(context.brand, LOGO.height, oneInk(ink('on-deep')))),
        signOffTitle(context, accent),
        ...iconSignOff({ ink: ink('on-deep'), inside: ink('deep') }),
        footSignature(context.brand, SIGN_OFF_SIGNATURE_TOP, ink('on-deep')),
      ],
    });
  }

  return frame({
    ...base,
    background: solid(ink('paper')),
    children: [
      at(SIDE_X, LOGO.y, drawLogo(context.brand, LOGO.height, oneInk(ink('deep')))),
      ...explanation(context, ink, accent),
      footSignature(context.brand, BODY_SIGNATURE_TOP, ink('body-ink')),
      ...(last ? [] : [arrow(BODY_ARROW, ink('deep'))]),
    ],
  });
};

/* --------------------------------------------------------------------------- the cover -- */

/** The cover's numbers, the reference's. */
const COVER = {
  x: 114,
  leadCapTop: 194,
  leadSize: 47.11,
  /** A lead too long for one line wraps at this pitch, in em. */
  leadLineHeight: 1.2,
  /** From the lead's capitals to the title's, on one line of lead. */
  leadToTitle: 96,
  /** The reference's 94.23 px title lines are 113.62 px apart: the pitch keeps that ratio. */
  titleLineHeight: 113.62 / 94.23,
  /** From the cover's left words to the slide's right edge, less the same margin. */
  width: SLIDE_WIDTH - 2 * 114,
  /** 80 px over the button. */
  bottom: 1140 - 80,
  /** A capital's advance, in em, for when nothing can be measured. */
  estimatedAdvance: 0.62,
} as const;

/** The cover's lead and title: the first line of the slide, then the rest, in capitals. */
function cover(context: TemplateContext, onDeep: string, accent: string): NodeDraft[] {
  const [lead = '', ...rest] = slideRichLines(context).map((line) => capitals(plain(line).trim()));
  const draftAt = (size: number) =>
    textAt('chamada', lead, {
      x: COVER.x,
      capTop: COVER.leadCapTop,
      size,
      weight: BLACK,
      color: onDeep,
      lineHeight: COVER.leadLineHeight,
      width: COVER.width,
    });
  const linesAt = (size: number) =>
    measuredLines(context, draftAt(size), [lead], size, COVER.width, COVER.estimatedAdvance);
  // The largest size that keeps the lead on one line; at the floor it wraps.
  const sizes = sizesBetween(context, 'lead');
  const leadSize = sizes.find((size) => linesAt(size) === 1) ?? sizes[sizes.length - 1]!;
  const leadLines = linesAt(leadSize);
  const titleTop =
    COVER.leadCapTop + COVER.leadToTitle + (leadLines - 1) * leadSize * COVER.leadLineHeight;
  return [draftAt(leadSize), coverTitle(context, rest, titleTop, accent)];
}

/** Upper case as Portuguese writes it. */
function capitals(words: string): string {
  return words.toLocaleUpperCase('pt-BR');
}

/**
 * The cover's title at the largest size between `title-floor` and `title-ceiling` that keeps
 * it in its room: no word wider than the cover and no line under the button's margin. When not
 * even the floor fits, the floor, reported as an overflow.
 */
function coverTitle(
  context: TemplateContext,
  written: readonly string[],
  capTop: number,
  color: string,
): TextDraft {
  const sizes = sizesBetween(context, 'title');
  const floor = sizes[sizes.length - 1]!;
  const draftAt = (setting: Setting) => {
    const placed = {
      x: COVER.x,
      capTop,
      size: setting.size,
      weight: BLACK,
      color,
      lineHeight: COVER.titleLineHeight,
      width: COVER.width,
      letterSpacing: setting.letterSpacing,
    };
    return setting.runs === undefined
      ? textAt('titulo', written.join('\n'), placed)
      : textRuns('titulo', setting.runs, placed);
  };
  const draft = (size: number) => draftAt(plainSetting(size));
  const layout = (
    size: number,
    node: TextDraft = draft(size),
  ): { readonly lines: number; readonly width: number } => {
    const measured = context.measure(node);
    if (measured !== undefined) return measured;
    const perLine = Math.max(1, Math.floor(COVER.width / (size * COVER.estimatedAdvance)));
    const count = written.reduce(
      (sum, line) => sum + Math.max(1, Math.ceil([...line].length / perLine)),
      0,
    );
    const longest = Math.max(0, ...written.flatMap((line) => line.split(' ').map((w) => w.length)));
    return { lines: Math.max(1, count), width: longest * size * COVER.estimatedAdvance };
  };
  const foot = (size: number, count: number) =>
    capTop + (count - 1) * size * COVER.titleLineHeight + size * CAP_HEIGHT;
  const fits = (size: number, node?: TextDraft) => {
    const laid = layout(size, node);
    return laid.width <= COVER.width + 0.5 && foot(size, laid.lines) <= COVER.bottom;
  };
  const fitted = sizes.find((size) => fits(size));
  if (fitted !== undefined) {
    // In its room, never under the floor, and no word alone at the end (Tyto ADR 0167).
    const settled = settle({
      size: fitted,
      measure: context.measure,
      limits: orphanLimits(context),
      layout: (setting) => {
        const node = draftAt(setting);
        return { text: node, fits: setting.size >= floor && fits(setting.size, node), laid: node };
      },
    });
    reportOrphan(context.report, settled.orphan);
    return settled.laid;
  }
  reportOverflow(context.report, foot(floor, layout(floor).lines), COVER.bottom);
  return draft(floor);
}

/** The cover's button, the reference's: a pill, its word and an arrow, in the slide's pixels. */
export const BUTTON = {
  x: 679,
  y: 1140,
  w: 282,
  h: 73,
  wordX: 714,
  wordCapTop: 1162,
  wordSize: 38.91,
  arrow: { x: 861, y: 1161, w: 64, h: 34, shaft: 11 },
} as const;

/** The cover's "Confira" button: the pill in `fill`, its word and arrow in `ink`. */
export function coverButton(inks: { readonly fill: string; readonly ink: string }): NodeDraft[] {
  return [
    rect({
      name: 'botao',
      size: { w: BUTTON.w, h: BUTTON.h },
      radius: BUTTON.h / 2,
      fill: solid(inks.fill),
      transform: { x: BUTTON.x, y: BUTTON.y },
    }),
    textAt('botao-texto', BUTTON_WORD, {
      x: BUTTON.wordX,
      capTop: BUTTON.wordCapTop,
      size: BUTTON.wordSize,
      weight: BOLD,
      color: inks.ink,
    }),
    arrow(BUTTON.arrow, inks.ink),
  ];
}

/* --------------------------------------------------------------------- the explanation -- */

/** The explanation slide's numbers, the reference's. */
const BODY = {
  x: 158,
  width: 770,
  lineHeight: 1.5,
  /** From a paragraph's last line's capitals to the next one's first, in em: 92 px at 40. */
  paragraphPitch: 2.3,
  /** Over and under a picture. */
  pictureGap: 48,
  /**
   * The block is centred on this line: the reference's paragraphs stand 24 px over the middle
   * between the logo's foot and the footer, and the slide keeps that.
   */
  centre: 671,
  /** It never comes nearer than this to the logo's foot or the footer's top. */
  margin: 70,
  /** A `{titulo}`'s lines, at the cover title's pitch. */
  titleLineHeight: 113.62 / 94.23,
  /** From a `{titulo}`'s baseline to the first block under it, in em of the title. */
  titleGap: 1,
} as const;

/** The left edge of the logo on the explanation and the sign-off. */
const SIDE_X = 80;
/** The top of the footer on the explanation slides: the signature and the arrow. */
const FOOTER_TOP = 1255;
const ROOM = { top: LOGO.y + LOGO.height + BODY.margin, bottom: FOOTER_TOP - BODY.margin } as const;

/** The arrow to the next slide at an explanation's foot. */
const BODY_ARROW = { x: 857, y: 1256, w: 145, h: 34, shaft: 9 } as const;

/** One block of an explanation: how tall it is, and its nodes once its top is known. */
interface Piece {
  readonly kind: 'title' | 'paragraph' | 'picture';
  readonly height: number;
  readonly place: (top: number) => NodeDraft[];
}

/**
 * The explanation's paragraphs and pictures in the order written, centred as the reference's,
 * at the largest size between `body-floor` and `body-ceiling` at which they fit between the
 * logo and the footer. When not even the floor fits, the floor, reported as an overflow.
 */
function explanation(context: TemplateContext, ink: Ink, accent: string): NodeDraft[] {
  const { title, parts } = titled(context, slideParts(context));
  const heading = title === undefined ? undefined : slideTitle(context, title, accent);
  /** Each paragraph's spacing and rebroken runs, by its index among the paragraphs. */
  type Settings = ReadonlyMap<number, Omit<Setting, 'size'>>;
  const paragraphTexts: TextDraft[] = [];
  const piecesAt = (size: number, settings: Settings = new Map()): Piece[] => {
    let count = 0;
    paragraphTexts.length = 0;
    const head: Piece[] = heading === undefined ? [] : [heading];
    return head.concat(
      parts.flatMap((part): Piece[] => {
        if (part.kind === 'picture') {
          return [part.framed ? picturePiece(part.asset, ink) : barePiece(part.asset)];
        }
        return part.lines.map((line) => {
          const setting = settings.get(count);
          count += 1;
          const name = `paragrafo-${count}`;
          const draftAt = (capTop: number) =>
            paragraph(context, name, line, capTop, size, ink, setting);
          paragraphTexts.push(draftAt(0));
          const lineCount = measuredLines(context, draftAt(0), [line], size, BODY.width);
          return {
            kind: 'paragraph',
            height: (lineCount - 1) * size * BODY.lineHeight + size * CAP_HEIGHT,
            place: (top) => [draftAt(top)],
          };
        });
      }),
    );
  };
  const gapBetween = (above: Piece, below: Piece, size: number): number =>
    above.kind === 'title'
      ? (heading?.gap ?? 0)
      : above.kind === 'picture' || below.kind === 'picture'
        ? BODY.pictureGap
        : size * (BODY.paragraphPitch - CAP_HEIGHT);
  const total = (pieces: readonly Piece[], size: number): number =>
    pieces.reduce(
      (sum, piece, index) =>
        sum + piece.height + (index === 0 ? 0 : gapBetween(pieces[index - 1]!, piece, size)),
      0,
    );

  const sizes = sizesBetween(context, 'body');
  const room = ROOM.bottom - ROOM.top;
  const size =
    sizes.find((tried) => total(piecesAt(tried), tried) <= room) ?? sizes[sizes.length - 1]!;
  // No paragraph ends on one word (Tyto ADR 0167): each by a word moved down or its letter
  // spacing, at the size they share, as long as the block still fits; a word nothing within
  // the limits clears is reported.
  let settings: Settings = new Map();
  const fitsAtSize = total(piecesAt(size), size) <= room;
  const { tracking } = orphanLimits(context);
  for (let index = 0; index < paragraphTexts.length; index += 1) {
    const settled = settle({
      size,
      measure: context.measure,
      limits: { shrink: 0, tracking },
      layout: (setting) => {
        const tried = new Map(settings);
        tried.set(index, {
          letterSpacing: setting.letterSpacing,
          ...(setting.runs === undefined ? {} : { runs: setting.runs }),
        });
        const height = total(piecesAt(size, tried), size);
        const text = paragraphTexts[index]!;
        return { text, fits: !fitsAtSize || height <= room, laid: tried as Settings };
      },
    });
    settings = settled.laid;
    reportOrphan(context.report, settled.orphan);
  }
  const pieces = piecesAt(size, settings);
  const height = total(pieces, size);
  if (height > ROOM.bottom - ROOM.top)
    reportOverflow(context.report, ROOM.top + height, ROOM.bottom);
  // Centred on the reference's line, then held inside the room.
  const top = Math.max(ROOM.top, Math.min(BODY.centre - height / 2, ROOM.bottom - height));
  let y = top;
  return pieces.flatMap((piece, index) => {
    if (index > 0) y += gapBetween(pieces[index - 1]!, piece, size);
    const nodes = piece.place(y);
    y += piece.height;
    return nodes;
  });
}

/**
 * With `{titulo}`, the slide's first written line is its title, drawn over the rest; without
 * it, every line is a paragraph.
 */
function titled(
  context: TemplateContext,
  parts: readonly Part[],
): { readonly title?: string; readonly parts: readonly Part[] } {
  const first = parts[0];
  if (context.adjustments['titulo'] !== true || first?.kind !== 'lines') return { parts };
  const [line, ...rest] = first.lines;
  const title = line === undefined ? '' : plain(line).trim();
  const after: Part[] =
    rest.length === 0 ? parts.slice(1) : [{ kind: 'lines', lines: rest }, ...parts.slice(1)];
  return { title, parts: after };
}

/**
 * A `{titulo}`, set as the cover's title (the maintainer, 2026-11-04): Black, in capitals, in
 * the accent, at the largest size between `slide-title-floor` and `slide-title-ceiling` at
 * which no word runs past the paragraphs' width.
 */
function slideTitle(
  context: TemplateContext,
  written: string,
  color: string,
): Piece & { readonly gap: number } {
  const words = capitals(written);
  const draftAt = (setting: Setting, capTop: number) => {
    const placed = {
      x: BODY.x,
      capTop,
      size: setting.size,
      weight: BLACK,
      color,
      lineHeight: BODY.titleLineHeight,
      width: BODY.width,
      letterSpacing: setting.letterSpacing,
    };
    return setting.runs === undefined
      ? textAt('titulo-lamina', words, placed)
      : textRuns('titulo-lamina', setting.runs, placed);
  };
  const widest = (setting: Setting): number => {
    const measured = context.measure(draftAt(setting, 0));
    if (measured !== undefined) return measured.width;
    const longest = Math.max(0, ...words.split(' ').map((word) => [...word].length));
    return longest * setting.size * COVER.estimatedAdvance;
  };
  const sizes = sizesBetween(context, 'slide-title');
  const floor = sizes[sizes.length - 1]!;
  const fitted = sizes.find((each) => widest(plainSetting(each)) <= BODY.width + 0.5) ?? floor;
  // No word past the paragraphs' width, never under the floor, and no word alone at the end.
  const settled = settle({
    size: fitted,
    measure: context.measure,
    limits: orphanLimits(context),
    layout: (setting) => ({
      text: draftAt(setting, 0),
      fits: setting.size >= floor && widest(setting) <= BODY.width + 0.5,
      laid: setting,
    }),
  });
  reportOrphan(context.report, settled.orphan);
  const setting = settled.laid;
  const size = setting.size;
  const count = measuredLines(
    context,
    draftAt(setting, 0),
    [words],
    size,
    BODY.width,
    COVER.estimatedAdvance,
  );
  return {
    kind: 'title',
    height: (count - 1) * size * BODY.titleLineHeight + size * CAP_HEIGHT,
    place: (top) => [draftAt(setting, top)],
    gap: size * BODY.titleGap,
  };
}

/**
 * One paragraph: Light, with `**x**` in the highlight's colour and `{cor:…}` in its own, both
 * at the highlight's weight. Math is the brief's Unicode: a glyph CircularXX lacks is drawn in
 * Tyto's symbol chain (Tyto ADR 0168), which the manifest lists under `faces:`.
 */
function paragraph(
  context: TemplateContext,
  name: string,
  line: RichText,
  capTop: number,
  size: number,
  ink: Ink,
  setting: Omit<Setting, 'size'> = { letterSpacing: 0 },
): TextDraft {
  const style = { font: FACE, size, weight: LIGHT, color: ink('body-ink') };
  // The kit reads `highlight-weight` as written; the template sets it at the nearest face it
  // lists, so a configuration cannot ask for a weight nothing measures.
  const marks = highlightsFromValues(context, HIGHLIGHT_SPEC).with({
    bold: { weight: highlightWeight(context) },
  });
  const runs = setting.runs ?? runsOf(line, style, marks.options);
  return textRuns(name, runs, {
    x: BODY.x,
    capTop,
    size,
    lineHeight: BODY.lineHeight,
    width: BODY.width,
    letterSpacing: setting.letterSpacing,
  });
}

/** The configured highlight weight, at the nearest face the manifest lists. */
export function highlightWeight(context: TemplateContext): number {
  const asked = numberValue(context, 'highlight-weight', NUMBER_DEFAULTS['highlight-weight']);
  return WEIGHTS.reduce((best, each) =>
    Math.abs(each - asked) < Math.abs(best - asked) ? each : best,
  );
}

/**
 * The shapes a picture may take, as width over height: from a 3:1 band to a square, as
 * questao-estrategica's frame. A taller picture is fitted whole into a square.
 */
export const PICTURE_SHAPES = { widest: 3, tallest: 1 } as const;

/**
 * questao-estrategica's frame (the maintainer, 2026-11-04: the same frame, its border in the
 * cover's colour), scaled to these paragraphs: its left bar 8 px left of the words and 25 px
 * wider than them, as questao's stands to its 810 px statement.
 */
export const FRAME = {
  x: BODY.x - 8,
  w: BODY.width + 25,
  /** The border on the top, the right and the foot. */
  border: 4,
  /** The bar down the left side, border included. */
  side: 29,
  /** The radius of the white area's two left corners, where it meets the bar. */
  radius: 32,
} as const;

/**
 * The frame's shadow, questao-estrategica's: 16 % dark, cast down and right by a frame 20 px
 * narrower on every side (`spread`), so it shows under the frame and not above it.
 */
const SHADOW = {
  kind: 'shadow',
  x: 17,
  y: 47,
  blur: 12,
  spread: -20,
  color: { r: 0, g: 0, b: 0, a: 0.16 },
} as const;

/**
 * A picture in the frame: a border in `border` on the top, the right and the foot, a bar down
 * the left, and the inside's two left corners rounded where they meet the bar. The inside is as
 * tall as the picture's own shape makes it at the inside's width (Tyto ADR 0158), held between
 * `PICTURE_SHAPES`, and the picture is fitted whole on `paper`. The rounding is drawn over the
 * picture, as two corner pieces in the border's colour, so a photo that fills the inside is cut
 * to the same corners.
 */
export function framedPicture(
  asset: AssetRef,
  y: number,
  inks: { readonly border: string; readonly paper: string },
): { readonly nodes: NodeDraft[]; readonly height: number } {
  const width = FRAME.w - FRAME.side - FRAME.border;
  const natural = imageHeight(asset, width, width / 2);
  const clamped = Math.min(
    width / PICTURE_SHAPES.tallest,
    Math.max(width / PICTURE_SHAPES.widest, natural),
  );
  const size = { w: width, h: Math.round(clamped) };
  const height = size.h + 2 * FRAME.border;
  const inside = { x: FRAME.x + FRAME.side, y: y + FRAME.border };
  const r = FRAME.radius;
  const corner = (name: string, d: string, top: number): NodeDraft =>
    vector({
      name,
      geometry: { kind: 'path', d, fillRule: 'nonzero' },
      size: { w: r, h: r },
      fill: solid(inks.border),
      transform: { x: inside.x, y: top },
    });
  return {
    nodes: [
      rect({
        name: 'moldura',
        size: { w: FRAME.w, h: height },
        fill: solid(inks.border),
        effects: [SHADOW],
        transform: { x: FRAME.x, y },
      }),
      rect({ name: 'fundo-imagem', size, fill: solid(inks.paper), transform: inside }),
      image({ name: 'imagem', asset, size, fit: 'contain', transform: inside }),
      corner('canto-superior', `M0 0H${r}A${r} ${r} 0 0 0 0 ${r}Z`, inside.y),
      corner('canto-inferior', `M0 0A${r} ${r} 0 0 0 ${r} ${r}H0Z`, inside.y + size.h - r),
    ],
    height,
  };
}

/** A framed picture as a block of the explanation, from its frame's top. */
function picturePiece(asset: AssetRef, ink: Ink): Piece {
  const inks = { border: ink('deep'), paper: ink('paper') };
  return {
    kind: 'picture',
    height: framedPicture(asset, 0, inks).height,
    // On a whole pixel: at a fractional top the border's and the corners' edges are blended,
    // and a 1 px line of the paper under them shows through the corner (measured 2026-11-04).
    place: (y) => framedPicture(asset, Math.round(y), inks).nodes,
  };
}

/**
 * A picture without the frame, `::imagem {sem-quadro} ./foto.png` (the maintainer,
 * 2026-11-04): at the paragraphs' place and width, as tall as its shape makes it between the
 * same 3:1 and square, fitted whole, with nothing drawn around it.
 */
function barePiece(asset: AssetRef): Piece {
  const natural = imageHeight(asset, BODY.width, BODY.width / 2);
  const height = Math.round(
    Math.min(
      BODY.width / PICTURE_SHAPES.tallest,
      Math.max(BODY.width / PICTURE_SHAPES.widest, natural),
    ),
  );
  return {
    kind: 'picture',
    height,
    place: (y) => [
      image({
        name: 'imagem',
        asset,
        size: { w: BODY.width, h: height },
        fit: 'contain',
        transform: { x: BODY.x, y: Math.round(y) },
      }),
    ],
  };
}

/** The mark on an `::imagem` line that draws it without the frame. */
const UNFRAMED = 'sem-quadro';

/** An explanation as written: runs of lines and the pictures among them. */
type Part =
  | { readonly kind: 'lines'; readonly lines: readonly RichText[] }
  | { readonly kind: 'picture'; readonly asset: AssetRef; readonly framed: boolean };

/**
 * The slide's lines and pictures in the order the brief wrote them (Tyto ADR 0160): each
 * `::imagem` after a `::lamina` adds a picture where it stands, and the lines under it go on
 * with the slide. Empty lines are dropped.
 */
function slideParts(context: TemplateContext): Part[] {
  const slide = context.slots['lamina'];
  const parts: Part[] = [];
  const addLines = (written: RichText): void => {
    const kept = lines(written).filter((line) => plain(line).trim() !== '');
    if (kept.length > 0) parts.push({ kind: 'lines', lines: kept });
  };
  const addPicture = (slot: ResolvedSlot | undefined): void => {
    if (slot?.value.kind !== 'image') return;
    const framed = !slot.adjustments.some((adjustment) => adjustment.name === UNFRAMED);
    parts.push({ kind: 'picture', asset: slot.value.asset, framed });
  };
  // A host that hands no order has the slide's text and its first picture, after it.
  if (slide?.blocks === undefined) {
    if (slide?.value.kind === 'rich-text') addLines(slide.value.text);
    addPicture(context.slots['imagem']);
    return parts;
  }
  for (const block of slide.blocks) {
    if (block.kind === 'text') addLines(block.text);
    else addPicture(block.slot);
  }
  return parts;
}

/* ------------------------------------------------------------------------ the sign-off -- */

/** The sign-off's title, the reference's: centred, its capitals 343 px down. */
const SIGN_OFF_TITLE = { capTop: 343.5, size: 84.6 } as const;

/** The sign-off's title: the slide's one line, or the default. */
function signOffTitle(context: TemplateContext, color: string): TextDraft {
  const [written] = slideRichLines(context);
  const words = written === undefined ? DEFAULT_SIGN_OFF_TITLE : plain(written).trim();
  return textAt('fecho-titulo', words, {
    x: 0,
    capTop: SIGN_OFF_TITLE.capTop,
    size: SIGN_OFF_TITLE.size,
    weight: BOLD,
    color,
    width: SLIDE_WIDTH,
    align: 'center',
  });
}

/** One row of the sign-off: an outlined icon, then its words, as the reference places them. */
interface IconRow {
  readonly name: string;
  readonly icon: { readonly x: number; readonly y: number; readonly w: number; readonly h: number };
  readonly d: string;
  readonly words: string;
  readonly weight: number;
  /** The top of the first line's capitals. */
  readonly capTop: number;
}

/** The sign-off's rows, measured on the reference: icon boxes, words and their capitals. */
export const ICON_ROWS: readonly IconRow[] = [
  {
    name: 'curtir',
    icon: { x: 299, y: 553, w: 69, h: 60 },
    d: 'M34.5 56.5L7 30C0 23 1.5 8 13 4.5C22 2 30 6 34.5 13C39 6 47 2 56 4.5C67.5 8 69 23 62 30Z',
    words: 'Deixe um like',
    weight: REGULAR,
    capTop: 573.7,
  },
  {
    name: 'marcar',
    icon: { x: 302, y: 667, w: 66, h: 61 },
    d: 'M45 49.5C41.5 51 37.5 51.5 33 51.5C16 51.5 2.5 41 2.5 27C2.5 13 16 2.5 33 2.5C50 2.5 63.5 13 63.5 27C63.5 35.5 58.5 42.5 51 46.5L55.5 58.5Z',
    words: 'Marque alguém que\npossa gostar do conteúdo.',
    weight: REGULAR,
    capTop: 663.7,
  },
  {
    name: 'salvar',
    icon: { x: 313, y: 798, w: 47, h: 63 },
    d: 'M2.5 2.5H44.5V60.5L23.5 43.5L2.5 60.5Z',
    words: 'Salve para fixar\no conteúdo',
    weight: BOLD,
    capTop: 797.7,
  },
  {
    name: 'compartilhar',
    icon: { x: 308, y: 927, w: 54, h: 54 },
    d: 'M51.5 2.5L2.5 21L24 30L33 51.5Z M24 30L51.5 2.5',
    words: 'Compartilhe com\nos amigos.',
    weight: REGULAR,
    capTop: 919.7,
  },
];

/** The rows' words: Regular 30 px, 38.68 px apart, letter spacing 0.02 em, from x = 443. */
const ROW_TEXT = { x: 443, size: 29.98, lineHeight: 38.68 / 29.98, letterSpacing: 0.6 } as const;
/** The icons' outline. */
const ICON_STROKE = 4.5;

/**
 * The sign-off's four rows: like, tag, save and share, each an outlined icon in `ink` (filled
 * with `inside`, the colour under it, since a shape with no fill paints its inside black) and
 * its words.
 */
export function iconSignOff(inks: { readonly ink: string; readonly inside: string }): NodeDraft[] {
  return ICON_ROWS.flatMap((row) => [
    vector({
      name: row.name,
      geometry: { kind: 'path', d: row.d, fillRule: 'nonzero' },
      size: { w: row.icon.w, h: row.icon.h },
      fill: solid(inks.inside),
      stroke: { paint: solid(inks.ink), width: ICON_STROKE, align: 'center' },
      transform: { x: row.icon.x, y: row.icon.y },
    }),
    textAt(`${row.name}-texto`, row.words, {
      x: ROW_TEXT.x,
      capTop: row.capTop,
      size: ROW_TEXT.size,
      weight: row.weight,
      color: inks.ink,
      lineHeight: ROW_TEXT.lineHeight,
      letterSpacing: ROW_TEXT.letterSpacing,
    }),
  ]);
}

/* -------------------------------------------------------------------------- the shared -- */

/** The signature's capitals on the explanation slides and on the sign-off. */
const BODY_SIGNATURE_TOP = 1262.5;
const SIGN_OFF_SIGNATURE_TOP = 1229.5;

/** The signature at the foot: Light 25.66 px, centred, letter spacing 0.2 em. */
export const SIGNATURE = { size: 25.66, letterSpacing: 25.66 * 0.2 } as const;

/** The brand kit's signature, centred on the slide with its capitals at `capTop`. */
export function footSignature(brand: BrandKit, capTop: number, color: string): TextDraft {
  return textAt('assinatura', signatureOf(brand), {
    x: 0,
    capTop,
    size: SIGNATURE.size,
    weight: LIGHT,
    color,
    width: SLIDE_WIDTH,
    align: 'center',
    letterSpacing: SIGNATURE.letterSpacing,
  });
}

interface ArrowBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  /** The head's height; the shaft is centred on it. */
  readonly h: number;
  readonly shaft: number;
}

/** An arrow pointing on: a shaft and a triangular head 0.64 of its height long. */
function arrow(box: ArrowBox, color: string): NodeDraft {
  const head = Math.round(box.h * 0.64);
  const top = (box.h - box.shaft) / 2;
  const neck = box.w - head;
  const d = `M0 ${top}H${neck}V0L${box.w} ${box.h / 2}L${neck} ${box.h}V${top + box.shaft}H0Z`;
  return vector({
    name: 'seta',
    geometry: { kind: 'path', d, fillRule: 'nonzero' },
    size: { w: box.w, h: box.h },
    fill: solid(color),
    transform: { x: box.x, y: box.y },
  });
}

interface Box {
  readonly x: number;
  /** Where the capitals start, in the slide's pixels. */
  readonly capTop: number;
  readonly lineHeight?: number;
  readonly width?: number;
  readonly align?: 'left' | 'center';
  readonly letterSpacing?: number;
}

interface Placed extends Box {
  readonly size: number;
  readonly weight: number;
  readonly color: string;
}

/** A plain text, one run per line, placed by the top of its capitals. */
function textAt(name: string, words: string, placed: Placed): TextDraft {
  const style = { font: FACE, size: placed.size, weight: placed.weight, color: placed.color };
  const [first = '', ...others] = words.split('\n');
  return textRuns(
    name,
    [run(first, style), ...others.flatMap((line) => [lineBreak(), run(line, style)])],
    placed,
  );
}

function textRuns(
  name: string,
  runs: readonly TextRun[],
  placed: Box & { readonly size: number },
): TextDraft {
  const lineHeight = placed.lineHeight ?? 1;
  const [head, ...tail] = runs;
  const empty = run('', { font: FACE, size: placed.size, weight: LIGHT, color: '#000000' });
  return text({
    name,
    runs: [head ?? empty, ...tail],
    ...(placed.width === undefined ? {} : { box: { w: placed.width } }),
    align: placed.align ?? 'left',
    lineHeight,
    letterSpacing: placed.letterSpacing ?? 0,
    transform: { x: placed.x, y: placed.capTop - capOffset(placed.size, lineHeight) },
  });
}

/**
 * How many lines a text wraps to: measured when the context can, estimated otherwise from the
 * characters a line of `width` holds, each line written counted apart.
 */
function measuredLines(
  context: TemplateContext,
  node: NodeDraft,
  written: readonly (RichText | string)[],
  size: number,
  width: number,
  advance: number = ESTIMATED_ADVANCE,
): number {
  const measured = node.kind === 'text' ? context.measure(node) : undefined;
  if (measured !== undefined) return Math.max(1, measured.lines);
  const perLine = Math.max(1, Math.floor(width / (size * advance)));
  const count = written.reduce<number>((sum, line) => {
    const characters = [...(typeof line === 'string' ? line : plain(line))].length;
    return sum + Math.max(1, Math.ceil(characters / perLine));
  }, 0);
  return Math.max(1, count);
}

/** This slide's written lines as rich text, the empty ones dropped. */
function slideRichLines(context: TemplateContext): RichText[] {
  const value = context.slots['lamina']?.value;
  if (value?.kind !== 'rich-text') return [];
  return lines(value.text).filter((line) => plain(line).trim() !== '');
}
