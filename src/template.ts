/**
 * `voce-conhece` — a "do you know the difference" carousel of 1080×1350 slides.
 *
 * | slide       | the brief writes          | drawn                                  |
 * | ----------- | ------------------------- | -------------------------------------- |
 * | cover       | `::lamina {capa}`         | the lead line, then the title          |
 * | explanation | `::lamina` with its lines | one paragraph per line, highlights     |
 * | sign-off    | `::lamina {fecho}`        | the sign-off's title                   |
 *
 * This first cut only places each slide's words in its box; the reference art's composition
 * comes next.
 */

import {
  colorValue,
  frame,
  lineBreak,
  numberValue,
  run,
  runsOf,
  solid,
  text,
} from '@tyto/core/template';
import { accentOf } from '@tyto/house-style';
import { lines, plain } from '@tyto/template-kit';

import type { RichText, TemplateBuild, TemplateContext, TextRun } from '@tyto/core';
import type { NodeDraft, TextDraft } from '@tyto/core/template';

/* ------------------------------------------------------------------------- the tokens -- */

/** The colours a configuration may change, by declared value name. */
export const COLOR_DEFAULTS = {
  deep: '#204e72',
  accent: '#1d9ad5',
  'on-deep': '#ffffff',
  paper: '#ffffff',
  'body-ink': '#4d4d4d',
  'highlight-ink': '#4d4d4d',
  'highlight-azul': '#2f628a',
  'highlight-vermelho': '#873131',
  'highlight-verde': '#39902e',
  'highlight-ocre': '#8a662d',
} as const;

/** The numbers a configuration may change, by declared value name. */
export const NUMBER_DEFAULTS = {
  'highlight-weight': 500,
} as const;

type ColorName = keyof typeof COLOR_DEFAULTS;
type Ink = (name: ColorName) => string;

const FACE = { family: 'CircularXX', source: 'system' } as const;
const LIGHT = 300;
const BOLD = 700;
const BLACK = 900;

/** The sign-off's title when the brief writes none. */
export const DEFAULT_SIGN_OFF_TITLE = 'Gostou do conteúdo?';

/** The `{cor:…}` names the brief may write, each a declared colour. */
const HIGHLIGHTS = {
  azul: 'highlight-azul',
  vermelho: 'highlight-vermelho',
  verde: 'highlight-verde',
  ocre: 'highlight-ocre',
} as const satisfies Record<string, ColorName>;

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
  const written = slideLines(context);
  const deep = role !== 'explicacao';

  const children: NodeDraft[] =
    role === 'capa'
      ? [
          textAt(
            'chamada',
            plain(written[0] ?? []).toUpperCase(),
            120,
            192,
            47,
            BLACK,
            ink('on-deep'),
          ),
          textAt(
            'titulo',
            written
              .slice(1)
              .map((line) => plain(line).toUpperCase())
              .join('\n'),
            120,
            288,
            94,
            BLACK,
            accent,
          ),
        ]
      : role === 'fecho'
        ? [
            textAt(
              'fecho-titulo',
              written.length > 0 ? plain(written[0] ?? []) : DEFAULT_SIGN_OFF_TITLE,
              116,
              343,
              84.6,
              BOLD,
              accent,
            ),
          ]
        : written.map((line, index) =>
            paragraph(context, `paragrafo-${index + 1}`, line, 158, 461 + index * 200, ink),
          );

  return frame({
    format: context.format,
    size: context.size,
    idPrefix: context.idPrefix,
    background: solid(deep ? ink('deep') : ink('paper')),
    children,
  });
};

/* -------------------------------------------------------------------------- the shared -- */

/** One paragraph of an explanation: Light, `**x**` and `{cor:…}` at the highlight's weight. */
function paragraph(
  context: TemplateContext,
  name: string,
  line: RichText,
  x: number,
  y: number,
  ink: Ink,
): TextDraft {
  const weight = numberValue(context, 'highlight-weight', NUMBER_DEFAULTS['highlight-weight']);
  const style = { font: FACE, size: 40, weight: LIGHT, color: ink('body-ink') };
  const runs = runsOf(line, style, {
    bold: weight,
    mark: (key, value) =>
      key === 'cor' && value in HIGHLIGHTS
        ? { color: ink(HIGHLIGHTS[value as keyof typeof HIGHLIGHTS]), weight }
        : undefined,
  });
  return draw(name, runs, x, y, 40, 770);
}

function textAt(
  name: string,
  words: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  color: string,
): TextDraft {
  const style = { font: FACE, size, weight, color };
  const [first = '', ...others] = words.split('\n');
  const runs = [run(first, style), ...others.flatMap((line) => [lineBreak(), run(line, style)])];
  return draw(name, runs, x, y, size, 1080 - 2 * x);
}

function draw(
  name: string,
  runs: readonly TextRun[],
  x: number,
  y: number,
  size: number,
  width: number,
): TextDraft {
  const [head, ...tail] = runs;
  const empty = run('', { font: FACE, size, weight: LIGHT, color: '#000000' });
  return text({
    name,
    runs: [head ?? empty, ...tail],
    box: { w: width },
    align: 'left',
    lineHeight: 1.5,
    letterSpacing: 0,
    transform: { x, y },
  });
}

/** This slide's written lines as rich text, the empty ones dropped. */
function slideLines(context: TemplateContext): RichText[] {
  const value = context.slots['lamina']?.value;
  if (value?.kind !== 'rich-text') return [];
  return lines(value.text).filter((line) => plain(line).trim() !== '');
}
