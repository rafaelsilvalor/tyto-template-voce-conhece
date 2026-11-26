import { describe, expect, it } from 'vitest';

import { BUTTON, ICON_ROWS, coverButton, iconSignOff } from './template.js';

import type { NodeDraft } from '@tyto/core/template';

/**
 * The cover's button and the sign-off's icon rows, drawn by the kit's `buttonRow` and `table`
 * (TYTO-881), pinned and read at their places on the slide.
 *
 * Both used to place every shape at the reference's pixels by hand. A probe compared every leaf
 * of the old and new drawings at its absolute place and found them the same; the renders were
 * byte-identical. These tests pin the new drawing and check, at the slide's pixels, that each
 * piece still lands where the reference puts it, so a change in the kit's pieces shows here.
 */

const INKS = { fill: '#112233', ink: '#ffffff', inside: '#445566' };

interface Placed {
  readonly name: string | undefined;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
}

/** Every node at its place on the slide: a group's offset summed into what it holds. */
function placed(nodes: readonly NodeDraft[], x = 0, y = 0): Placed[] {
  return nodes.flatMap((node) => {
    const at = { x: x + node.transform.x, y: y + node.transform.y };
    const children = node.kind === 'group' ? node.children : [];
    return [{ name: node.name, kind: node.kind, ...at }, ...placed(children, at.x, at.y)];
  });
}

const find = (nodes: readonly NodeDraft[], name: string): Placed => {
  const found = placed(nodes).find((node) => node.name === name);
  if (found === undefined) throw new Error(`no node named ${name}`);
  return found;
};

/** One line per node, indented by depth: its kind, its name, and everything else it carries. */
function outline(node: NodeDraft, depth = 0): string[] {
  const { kind, name, ...rest } = node as NodeDraft & { readonly name?: string };
  const { children, ...own } = rest as { children?: NodeDraft[] };
  const line = `${'  '.repeat(depth)}${kind} ${name ?? '-'} ${JSON.stringify(own)}`;
  return [line, ...(children ?? []).flatMap((child) => outline(child, depth + 1))];
}

/** CircularXX's capitals start this far below a line's top (template.ts's metrics). */
const capOffset = (size: number, lineHeight: number) =>
  size * ((lineHeight - 1) / 2 + (0.75 - 0.709));

describe('the cover button', () => {
  const drawn = coverButton(INKS);

  it('is drawn as pinned', async () => {
    await expect(`${drawn.flatMap((node) => outline(node)).join('\n')}\n`).toMatchFileSnapshot(
      './__snapshots__/voce-conhece-cover-button.txt',
    );
  });

  it('puts the pill, the word and the arrow where the reference does', () => {
    const pill = placed(drawn).find((node) => node.kind === 'rect');
    expect(pill).toMatchObject({ x: BUTTON.x, y: BUTTON.y });
    const word = find(drawn, 'botao-texto');
    expect(word.x).toBeCloseTo(BUTTON.wordX, 9);
    expect(word.y).toBeCloseTo(BUTTON.wordCapTop - capOffset(BUTTON.wordSize, 1), 9);
    const arrow = find(drawn, 'seta');
    expect(arrow.x).toBeCloseTo(BUTTON.arrow.x, 9);
    expect(arrow.y).toBeCloseTo(BUTTON.arrow.y, 9);
  });
});

describe('the sign-off’s icon rows', () => {
  const drawn = iconSignOff(INKS);

  it('are drawn as pinned', async () => {
    await expect(`${drawn.flatMap((node) => outline(node)).join('\n')}\n`).toMatchFileSnapshot(
      './__snapshots__/voce-conhece-icon-rows.txt',
    );
  });

  it.each(ICON_ROWS.map((row) => [row.name, row] as const))(
    'puts the %s icon and its words where the reference does',
    (name, row) => {
      const icon = find(drawn, name);
      expect(icon.x).toBeCloseTo(row.icon.x, 9);
      expect(icon.y).toBeCloseTo(row.icon.y, 9);
      const words = find(drawn, `${name}-texto`);
      expect(words.x).toBeCloseTo(443, 9);
      expect(words.y).toBeCloseTo(row.capTop - capOffset(29.98, 38.68 / 29.98), 9);
    },
  );
});
