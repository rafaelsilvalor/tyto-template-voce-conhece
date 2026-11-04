import { readFileSync } from 'node:fs';

import { defineTemplate, parseFormats, parseManifest } from '@tyto/core';
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

describe('the declared faces', () => {
  it('are exactly the faces the example draws, on every slide', async () => {
    const result = await compileTemplate({
      brief: read('../templates/voce-conhece/examples/diferenca.brief'),
      template,
      formats,
    });
    if (!result.ok) throw new Error(result.error.map((item) => item.message).join('\n'));
    const drawn = facesIn(result.value.scene);
    const declared = (manifest.value.faces ?? []).map(
      (face) => `${face.family} ${String(face.weight)}`,
    );

    expect(drawn.size).toBeGreaterThan(0);
    expect([...drawn].sort()).toEqual([...declared].sort());
  });
});
