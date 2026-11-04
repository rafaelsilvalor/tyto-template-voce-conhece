import { readFileSync } from 'node:fs';

import { defineTemplate, parseFormats, parseManifest } from '@tyto/core';
import { fallbackChain } from '@tyto/core/template';
import { compileTemplate } from '@tyto/template-kit/testing';
import { describe, expect, it } from 'vitest';

import { build } from '../src/template.js';

/**
 * The faces the manifest declares are the ones the composition draws (Tyto ADR 0048).
 *
 * In a plugin's process `context.measure` answers only from the faces the manifest lists, and
 * a face left out measures as nothing. So every (family, weight) a frame of the example draws
 * must be declared, and a declared face nothing draws is a stale line.
 */

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');

const manifest = parseManifest(read('../templates/voce-conhece/manifest.yaml'), 'manifest.yaml');
if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));
const template = defineTemplate(manifest.value, build);
const parsedFormats = parseFormats(read('../templates/formats.yaml'), 'formats.yaml');
if (!parsedFormats.ok) throw new Error(parsedFormats.error.map((item) => item.message).join('\n'));
const formats = parsedFormats.value;

/** Every `family weight` a scene's text runs draw, found wherever a run carries a font. */
function facesIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) facesIn(item, found);
  } else if (typeof node === 'object' && node !== null) {
    const record = node as Record<string, unknown>;
    const font = record['font'] as { family?: unknown } | undefined;
    if (typeof font?.family === 'string' && typeof record['weight'] === 'number') {
      found.add(`${font.family} ${String(record['weight'])}`);
    }
    for (const value of Object.values(record)) facesIn(value, found);
  }
  return found;
}

/** The examples a test compiles: every one the repository ships. */
const EXAMPLES = ['diferenca', 'formula'] as const;

/** Tyto's symbol chain for a run of this weight (Tyto ADR 0168), as `family weight`. */
function symbolChain(weight: number): readonly string[] {
  return fallbackChain({ weight, style: 'normal' }).map(
    (face) => `${face.family} ${String(face.weight)}`,
  );
}

/** The `family weight` of every face the manifest lists. */
const declared = (manifest.value.faces ?? []).map(
  (face) => `${face.family} ${String(face.weight)}`,
);

async function drawnFaces(): Promise<Set<string>> {
  const drawn = new Set<string>();
  for (const example of EXAMPLES) {
    const result = await compileTemplate({
      brief: read(`../templates/voce-conhece/examples/${example}.brief`),
      template,
      formats,
    });
    if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
    facesIn(result.value.scene, drawn);
  }
  return drawn;
}

describe('the declared faces', () => {
  it('list exactly the faces the examples draw, on every slide', async () => {
    const drawn = await drawnFaces();
    const chainFamilies = new Set(['Noto Sans Math', 'Source Sans 3']);
    const own = declared.filter(
      (face) => ![...chainFamilies].some((f) => face.startsWith(`${f} `)),
    );

    expect(drawn.size).toBeGreaterThan(0);
    expect([...drawn].sort()).toEqual([...own].sort());
  });

  it("list Tyto's symbol chain at every weight the examples draw, and nothing more", async () => {
    // Without these the plugin's own measure would take a formula at `.notdef` widths while the
    // host draws it in the chain, and the boxes it sized would disagree with what is drawn.
    const drawn = await drawnFaces();
    const weights = [...drawn].map((face) => Number(face.split(' ').at(-1)));
    const chain = new Set(weights.flatMap(symbolChain));
    const listed = declared.filter((face) => !drawn.has(face));

    expect(listed.sort()).toEqual([...chain].sort());
  });
});
