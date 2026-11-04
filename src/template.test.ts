import { noBrandKit } from '@tyto/core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SIGN_OFF_TITLE, build, roleOf } from './template.js';

import type { RichText, SlotValue, TemplateContext } from '@tyto/core';

/** A slide's context with nothing measured: the composition's rules, on the `Scene`. */
function contextOf(
  text: RichText,
  adjustments: Record<string, boolean> = {},
  values: Record<string, unknown> = {},
): TemplateContext {
  const value: SlotValue = { kind: 'rich-text', text };
  return {
    format: 'grid',
    size: { w: 1080, h: 1350 },
    idPrefix: 'artwork-0-grid',
    artwork: { id: 'artwork-0', index: 0, count: 1 },
    slots: { lamina: { name: 'lamina', value, adjustments: [] } },
    adjustments,
    values,
    brand: noBrandKit,
    measure: () => undefined,
    report: () => undefined,
  } as unknown as TemplateContext;
}

const range = { start: 0, end: 1 };
const words = (value: string): RichText => [{ kind: 'text', value, range }];
const brk = { kind: 'break', range } as const;

type Node = {
  kind: string;
  name?: string;
  runs?: { text?: string; weight?: number; color?: unknown }[];
};

function textNamed(context: TemplateContext, name: string): Node | undefined {
  const children = (build(context) as unknown as { children: Node[] }).children;
  return children.find((child) => child.name === name);
}

describe('the slides', () => {
  it('reads the role from the slide flags', () => {
    expect(roleOf(contextOf(words('x'), { capa: true }))).toBe('capa');
    expect(roleOf(contextOf(words('x'), { fecho: true }))).toBe('fecho');
    expect(roleOf(contextOf(words('x')))).toBe('explicacao');
  });

  it("sets the cover's lead and title in capitals", () => {
    const context = contextOf([...words('Você sabe'), brk, ...words('Tal e qual?')], {
      capa: true,
    });

    expect(textNamed(context, 'chamada')?.runs?.[0]?.text).toBe('VOCÊ SABE');
    expect(textNamed(context, 'titulo')?.runs?.[0]?.text).toBe('TAL E QUAL?');
  });

  it('draws the default sign-off title when the slide writes none', () => {
    expect(textNamed(contextOf([], { fecho: true }), 'fecho-titulo')?.runs?.[0]?.text).toBe(
      DEFAULT_SIGN_OFF_TITLE,
    );
  });

  it('sets a coloured highlight at the highlight weight, in its declared colour', () => {
    const marked: RichText = [
      ...words('a '),
      { kind: 'mark', key: 'cor', value: 'verde', children: words('b'), range },
    ];
    const runs = textNamed(contextOf(marked), 'paragrafo-1')?.runs ?? [];

    expect(runs.map((each) => [each.text, each.weight])).toEqual([
      ['a ', 300],
      ['b', 500],
    ]);
  });
});
