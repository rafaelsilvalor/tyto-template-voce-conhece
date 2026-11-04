import { readFileSync } from 'node:fs';

import { type FaceCache, defineTemplate, formatCatalogue, parseManifest } from '@tyto/core';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from './template.js';

import type { Frame, SceneNode, SuppliedValues, TextNode } from '@tyto/core';

/**
 * No title or paragraph ends on one word (Tyto ADR 0167, TYTO-612): the kit's `settle` moves a
 * word down from the line above, spaces the letters or sets the text a little smaller, within
 * the `orphan-*` values and the text's own floor, and `W_TEMPLATE_ORPHAN` names a word nothing
 * within them clears.
 *
 * Measured against a face whose every character is half an em wide, standing in for
 * CircularXX, which CI does not have: the line breaks are then known and can be read off the
 * scene. What CircularXX itself does is looked at in a render, outside this repository.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
const manifest = parseManifest(read('../templates/voce-conhece/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const formats = formatCatalogue({ grid: { w: 1080, h: 1350, kind: 'grid' } });

const faces: FaceCache = {
  get: (face) =>
    face.family === 'CircularXX'
      ? { advance: (characters: string) => characters.length * 0.5, contentHeight: 1 }
      : undefined,
};

/** Size and letter spacing off: only a word moved down from the line above may clear one. */
const MOVE_ONLY = {
  'orphan-shrink': { value: 0 },
  'orphan-tracking': { value: 0 },
} as const;

/** At 40 px a 770 px line holds 38 characters: "sala." stands alone today. */
const PARAGRAPH = 'Cada peça leva sete dias para secar bem e cada lote leva oito dias até a sala.';
/**
 * The line above holds one word, so none can move down; with size and spacing off, nothing
 * clears "fim.".
 */
const STUCK_PARAGRAPH = 'Otorrinolaringologistasprofissionais fim.';

/** In capitals at 56 px a 770 px line holds 27 characters: "NOVO" stands alone today. */
const SLIDE_TITLE = 'Quando a peça fica pronta para a seca total do lote novo';
const STUCK_SLIDE_TITLE = 'Otorrinolaringologistas sempre';

/** In capitals at 94.23 px an 852 px line holds 18 characters: "LADO" stands alone today. */
const COVER_TITLE = 'Peça seca ou peça molhada de lado a lado';
const STUCK_COVER_TITLE = 'Termorregulação total';
const LEAD = 'Você sabe a diferença entre';

async function compiled(slides: string, values?: SuppliedValues) {
  const result = await compileTemplate({
    brief: `---\ntemplate: voce-conhece\nformats: [grid]\n---\n${slides}`,
    template,
    formats,
    faces,
    ...(values === undefined ? {} : { values }),
  });
  if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
  return result;
}

function nodes(node: Frame | SceneNode): SceneNode[] {
  const children = 'children' in node ? node.children : [];
  return [
    ...('kind' in node && node.kind !== undefined ? [node as SceneNode] : []),
    ...children.flatMap(nodes),
  ];
}

async function slideText(slides: string, name: string, values?: SuppliedValues) {
  const result = await compiled(slides, values);
  const frame = result.value.scene.artworks[0]?.frames[0];
  if (frame === undefined) throw new Error('no frame');
  const found = nodes(frame).find((node) => node.name === name);
  if (found?.kind !== 'text') throw new Error(`no text ${name}`);
  return { node: found, frame, orphans: orphanWords(result.diagnostics) };
}

/** The words of a text's last laid line. */
function lastLineWords(node: TextNode): string[] {
  const lines: string[] = [''];
  for (const run of node.runs) {
    if (run.kind === 'break') lines.push('');
    else lines[lines.length - 1] += run.text;
  }
  return (lines.at(-1) ?? '').split(/\s+/u).filter((word) => word !== '');
}

function orphanWords(diagnostics: readonly { code: string; message: string }[]): string[] {
  return diagnostics
    .filter((item) => item.code === 'W_TEMPLATE_ORPHAN')
    .map((item) => /word '([^']+)'/u.exec(item.message)?.[1] ?? item.message);
}

function sizeOf(node: TextNode): number | undefined {
  const first = node.runs.find((run) => run.kind === 'text');
  return first?.kind === 'text' ? first.size : undefined;
}

describe('a paragraph', () => {
  it('ends on two words, at the size the other paragraphs keep', async () => {
    const { node, frame, orphans } = await slideText(
      `::lamina\n  ${PARAGRAPH}\n  Uma linha curta.\n`,
      'paragrafo-1',
    );

    expect(lastLineWords(node).length).toBeGreaterThan(1);
    const other = nodes(frame).find((each) => each.name === 'paragrafo-2');
    expect(other?.kind === 'text' ? sizeOf(other) : undefined).toBe(sizeOf(node));
    expect(orphans).toEqual([]);
  });

  it('is cleared by a word moved down alone, letter spacing and size off', async () => {
    const { node, orphans } = await slideText(
      `::lamina\n  ${PARAGRAPH}\n`,
      'paragrafo-1',
      MOVE_ONLY,
    );

    expect(lastLineWords(node).length).toBeGreaterThan(1);
    expect(node.letterSpacing).toBe(0);
    expect(orphans).toEqual([]);
  });

  it('keeps the word and names it when nothing within the limits clears it', async () => {
    const { node, orphans } = await slideText(
      `::lamina\n  ${STUCK_PARAGRAPH}\n`,
      'paragrafo-1',
      MOVE_ONLY,
    );

    expect(lastLineWords(node)).toEqual(['fim.']);
    expect(orphans).toEqual(['fim.']);
  });
});

describe('a slide title', () => {
  it('ends on two words', async () => {
    const { node, orphans } = await slideText(
      `::lamina {titulo}\n  ${SLIDE_TITLE}\n  Uma linha curta.\n`,
      'titulo-lamina',
    );

    expect(lastLineWords(node).length).toBeGreaterThan(1);
    expect(orphans).toEqual([]);
  });

  it('keeps the word and names it when nothing within the limits clears it', async () => {
    const { node, orphans } = await slideText(
      `::lamina {titulo}\n  ${STUCK_SLIDE_TITLE}\n  Uma linha curta.\n`,
      'titulo-lamina',
      MOVE_ONLY,
    );

    expect(lastLineWords(node)).toEqual(['SEMPRE']);
    expect(orphans).toEqual(['SEMPRE']);
  });
});

describe('the cover title', () => {
  it('ends on two words', async () => {
    const { node, orphans } = await slideText(
      `::lamina {capa}\n  ${LEAD}\n  ${COVER_TITLE}\n`,
      'titulo',
    );

    expect(lastLineWords(node).length).toBeGreaterThan(1);
    expect(orphans).toEqual([]);
  });

  it('never goes under its floor to clear one', async () => {
    // Nineteen characters: a few pixels smaller they fit one line, clearing "SIM" — unless
    // the floor is the ceiling, when the word stays and is named.
    const title = 'Termorregulação sim';
    const shrunk = await slideText(`::lamina {capa}\n  ${LEAD}\n  ${title}\n`, 'titulo');
    const floored = await slideText(`::lamina {capa}\n  ${LEAD}\n  ${title}\n`, 'titulo', {
      'title-floor': { value: 94.23 },
    });

    expect(sizeOf(shrunk.node)).toBeLessThan(94.23);
    expect(shrunk.orphans).toEqual([]);
    expect(sizeOf(floored.node)).toBe(94.23);
    expect(floored.orphans).toEqual(['SIM']);
  });

  it('keeps the word and names it when nothing within the limits clears it', async () => {
    const { node, orphans } = await slideText(
      `::lamina {capa}\n  ${LEAD}\n  ${STUCK_COVER_TITLE}\n`,
      'titulo',
      MOVE_ONLY,
    );

    expect(lastLineWords(node)).toEqual(['TOTAL']);
    expect(orphans).toEqual(['TOTAL']);
  });
});
