import { readdirSync, readFileSync } from 'node:fs';

import { checkSlotVocabulary, parseManifest } from '@tyto/core';
import { describe, expect, it } from 'vitest';

/**
 * Every manifest here held to Tyto's shared slot vocabulary (`docs/slot-vocabulary.md`,
 * TYTO-812): the check `tyto template check` runs, called through the `@tyto/core` this
 * repository already installs, so CI needs no CLI.
 *
 * Tyto reports a finding as a warning, because a render cannot act on a template's naming.
 * This repository can, so here a finding fails: a slot named off the vocabulary is caught
 * before any brief writes it. A name that predates the vocabulary and that briefs already
 * use goes in `ALLOWED`, with the reason, and an entry that stops firing fails too, so the
 * list only shrinks.
 */

/** Template name → slot → why the name stays. Empty: every manifest here is on the vocabulary. */
const ALLOWED: Readonly<Record<string, Readonly<Record<string, string>>>> = {};

const root = new URL('../templates/', import.meta.url);
const templates = readdirSync(root, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

/** The slot a `W_SLOT_VOCABULARY` message names: "Slot 'foto' is a known synonym…". */
const slotOf = (message: string): string => /^Slot '([^']+)'/.exec(message)?.[1] ?? message;

describe('slot vocabulary', () => {
  it('finds the templates', () => {
    expect(templates.length).toBeGreaterThan(0);
  });

  for (const name of templates) {
    it(`${name} names its slots by the vocabulary`, () => {
      const path = new URL(`${name}/manifest.yaml`, root);
      const source = readFileSync(path, 'utf8');
      const manifest = parseManifest(source, `templates/${name}/manifest.yaml`);
      if (!manifest.ok) throw new Error(manifest.error.map((item) => item.message).join('\n'));

      const allowed = ALLOWED[name] ?? {};
      const findings = checkSlotVocabulary(manifest.value, source);
      const unexpected = findings
        .filter((finding) => !(slotOf(finding.message) in allowed))
        .map((finding) => finding.message);
      const stale = Object.keys(allowed).filter(
        (slot) => !findings.some((finding) => slotOf(finding.message) === slot),
      );

      expect(unexpected, 'slots named off the vocabulary').toEqual([]);
      expect(stale, 'ALLOWED entries that no longer fire: delete them').toEqual([]);
    });
  }
});
