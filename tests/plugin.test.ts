import { readFileSync } from 'node:fs';

import { noBrandKit } from '@tyto/core';
import { NO_SHIPPED_FILES, PLUGIN_API_VERSION, satisfiesEngine } from '@tyto/plugin-api';
import { testPlugin } from '@tyto/plugin-api/testing';
import { afterAll, describe, expect, it } from 'vitest';

import type { SlotValue, TemplateCall } from '@tyto/core';
import type { IsolatedPackBuild } from '@tyto/plugin-api';
import type { PluginHarness } from '@tyto/plugin-api/testing';

/**
 * The built bundle, loaded the way Tyto loads an installed plugin (Tyto ADR 0150): the
 * manifest checked as `tyto plugin install` checks it, against the contract installed here,
 * and `dist/index.js` activated through the same `tryActivate`. Run after `pnpm build`.
 *
 * The pack's `build` is the host's proxy of it, as in the app: the call crosses the isolation
 * protocol as data, without `measure` and `report`, which the plugin's side rebuilds.
 */

const manifest = readFileSync(new URL('../tyto-plugin.json', import.meta.url), 'utf8');

// A URL rather than a literal path: the bundle has no types, and the test loads it as data.
const entry = new URL('../dist/index.js', import.meta.url).href;

const opened = await testPlugin({ manifest, load: () => import(entry) });
if (!opened.ok) throw new Error(opened.error.map((item) => item.message).join('\n'));
const harness: PluginHarness = opened.value;
afterAll(() => harness.close());

const rich = (value: string): SlotValue => ({
  kind: 'rich-text',
  text: [{ kind: 'text', value, range: { start: 0, end: value.length } }],
});

const call: TemplateCall = {
  format: 'grid',
  size: { w: 1080, h: 1350 },
  idPrefix: 'artwork-0-grid',
  artwork: { id: 'artwork-0', index: 0, count: 1 },
  slots: {
    lamina: { name: 'lamina', value: rich('Paragrafo inventado'), adjustments: [] },
  },
  adjustments: {},
  brand: noBrandKit,
};

/** The pack's `build` as the host holds it: the proxy over the isolation protocol. */
const build = (): IsolatedPackBuild =>
  harness.host.registry.templatePacks()[0]!.build as unknown as IsolatedPackBuild;

describe('the plugin', () => {
  it('declares an engine the contract it is built against satisfies', () => {
    expect(satisfiesEngine(JSON.parse(manifest).engine, PLUGIN_API_VERSION)).toBe(true);
  });

  it('asks for CircularXX, the licensed face its slides set, and nothing else', () => {
    expect(harness.manifest.permissions).toEqual(['font:CircularXX']);
  });

  it('registers one pack, read from templates/, that draws its templates itself', () => {
    const packs = harness.host.registry.templatePacks();

    expect(packs.map((pack) => [pack.id, pack.directory])).toEqual([['voce-conhece', 'templates']]);
    expect(typeof packs[0]?.build).toBe('function');
  });

  it('draws voce-conhece from the bundle, a 1080×1350 frame, across the isolation protocol', async () => {
    const answer = await build()('voce-conhece', call, [], NO_SHIPPED_FILES);
    if (!answer.ok) throw new Error(answer.error.map((item) => item.message).join('\n'));

    expect(answer.value.frame.size).toEqual({ w: 1080, h: 1350 });
    expect(answer.value.frame.children.length).toBeGreaterThan(0);
  });

  it('refuses a template name it does not draw, rather than drawing voce-conhece under it', async () => {
    const answer = await build()('voce-conhece-azul', call, [], NO_SHIPPED_FILES);

    expect(answer.ok).toBe(false);
    expect(answer.ok ? '' : answer.error.map((item) => item.message).join('\n')).toContain(
      "voce-conhece draws no template named 'voce-conhece-azul'.",
    );
  });
});
