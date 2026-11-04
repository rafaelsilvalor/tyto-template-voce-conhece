import { noBrandKit } from '@tyto/core';
import { describe, expect, it } from 'vitest';

import { DEFAULT_SIGN_OFF_TITLE, FRAME, NUMBER_DEFAULTS, build, roleOf } from './template.js';

import type { AssetRef, RichText, SlotValue, TemplateContext } from '@tyto/core';

/**
 * The composition's rules on the `Scene`, without Tyto: a slide's context built by hand, with
 * nothing measured unless a test hands in a `measure`, so line counts and widths come from the
 * template's own estimate.
 */

interface Options {
  readonly adjustments?: Record<string, boolean>;
  readonly values?: Record<string, unknown>;
  readonly blocks?: readonly unknown[];
  readonly fundo?: AssetRef;
  readonly index?: number;
  readonly count?: number;
  readonly measure?: (node: unknown) => { lines: number; width: number } | undefined;
  readonly report?: (item: unknown) => void;
}

function contextOf(text: RichText, options: Options = {}): TemplateContext {
  const value: SlotValue = { kind: 'rich-text', text };
  return {
    format: 'grid',
    size: { w: 1080, h: 1350 },
    idPrefix: 'artwork-0-grid',
    artwork: { id: 'artwork-0', index: options.index ?? 0, count: options.count ?? 2 },
    slots: {
      lamina: {
        name: 'lamina',
        value,
        adjustments: [],
        ...(options.blocks === undefined ? {} : { blocks: options.blocks }),
      },
      ...(options.fundo === undefined
        ? {}
        : { fundo: { name: 'fundo', value: { kind: 'image', asset: options.fundo } } }),
    },
    adjustments: options.adjustments ?? {},
    values: options.values ?? {},
    brand: noBrandKit,
    measure: options.measure ?? (() => undefined),
    report: options.report ?? (() => undefined),
  } as unknown as TemplateContext;
}

const range = { start: 0, end: 1 };
const words = (value: string): RichText => [{ kind: 'text', value, range }];
const brk = { kind: 'break', range } as const;
const asset = (id: string, w: number, h: number): AssetRef => ({
  id,
  source: 'file',
  path: `${id}.png`,
  hash: id,
  size: { w, h },
});

interface Run {
  readonly text?: string;
  readonly weight?: number;
  readonly size?: number;
  readonly color?: { readonly color?: { r: number; g: number; b: number } };
}
interface Node {
  readonly kind: string;
  readonly name?: string;
  readonly runs?: readonly Run[];
  readonly size?: { readonly w: number; readonly h: number };
  readonly transform?: { readonly x: number; readonly y: number };
}

const drawn = (context: TemplateContext): Node[] =>
  (build(context) as unknown as { children: Node[] }).children;
const named = (context: TemplateContext, name: string): Node | undefined =>
  drawn(context).find((child) => child.name === name);
const hex = (run: Run | undefined): string => {
  const c = run?.color?.color;
  if (c === undefined) return '';
  const two = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${two(c.r)}${two(c.g)}${two(c.b)}`;
};

describe('the slides', () => {
  it('reads the role from the slide flags', () => {
    expect(roleOf(contextOf(words('x'), { adjustments: { capa: true } }))).toBe('capa');
    expect(roleOf(contextOf(words('x'), { adjustments: { fecho: true } }))).toBe('fecho');
    expect(roleOf(contextOf(words('x'), { adjustments: { titulo: true } }))).toBe('explicacao');
    expect(roleOf(contextOf(words('x')))).toBe('explicacao');
  });

  it('starts every text inside its slide', () => {
    const slides = [
      contextOf([...words('Você sabe'), brk, ...words('Tal e qual?')], {
        adjustments: { capa: true },
      }),
      contextOf([...words('Um título'), brk, ...words('Um parágrafo.')], {
        adjustments: { titulo: true },
      }),
      contextOf([], { adjustments: { fecho: true } }),
    ];
    for (const slide of slides) {
      for (const node of drawn(slide).filter((each) => each.kind === 'text')) {
        expect(node.transform?.x).toBeGreaterThanOrEqual(0);
        expect(node.transform?.y).toBeGreaterThan(0);
        expect(node.transform?.y).toBeLessThan(1350);
      }
    }
  });

  it('draws the arrow and the button on every slide but the last', () => {
    const cover = (index: number) =>
      contextOf(words('x'), { adjustments: { capa: true }, index, count: 2 });
    const body = (index: number) => contextOf(words('x'), { index, count: 2 });

    expect(named(cover(0), 'botao')).toBeDefined();
    expect(named(cover(1), 'botao')).toBeUndefined();
    expect(named(body(0), 'seta')).toBeDefined();
    expect(named(body(1), 'seta')).toBeUndefined();
  });
});

describe('the cover', () => {
  it('sets the lead and the title in capitals, as Portuguese writes them', () => {
    const context = contextOf([...words('Você sabe'), brk, ...words('Ação e reação?')], {
      adjustments: { capa: true },
    });

    expect(named(context, 'chamada')?.runs?.[0]?.text).toBe('VOCÊ SABE');
    expect(named(context, 'titulo')?.runs?.[0]?.text).toBe('AÇÃO E REAÇÃO?');
  });

  it('sets a short title at the ceiling and shrinks a long one, down to the floor', () => {
    const size = (title: string) =>
      named(
        contextOf([...words('Lead'), brk, ...words(title)], { adjustments: { capa: true } }),
        'titulo',
      )?.runs?.[0]?.size;

    expect(size('Curto')).toBe(NUMBER_DEFAULTS['title-ceiling']);
    expect(size('Termorregulação')).toBeLessThan(NUMBER_DEFAULTS['title-ceiling']);
    expect(size('Termorregulação')).toBeGreaterThanOrEqual(NUMBER_DEFAULTS['title-floor']);
  });

  it('reports an overflow when not even the floor holds the title', () => {
    const reported: unknown[] = [];
    const long = Array.from({ length: 40 }, () => 'palavra').join(' ');
    drawn(
      contextOf([...words('Lead'), brk, ...words(long)], {
        adjustments: { capa: true },
        report: (item) => reported.push(item),
      }),
    );

    expect(reported).toContainEqual(expect.objectContaining({ code: 'W_TEMPLATE_OVERFLOW' }));
  });

  it('shrinks the lead to stay on one line', () => {
    const measure = (node: unknown) => {
      const runs = (node as { runs: Run[] }).runs;
      const run = runs[0];
      // A stand-in face: the lead fits one line at 40 px or less. Its runs come back as they
      // went in, as a measurement's do when it decides no break.
      return { runs, lines: (run?.size ?? 0) > 40 ? 2 : 1, width: 100 };
    };
    const lead = named(
      contextOf([...words('Lead longo'), brk, ...words('T')], {
        adjustments: { capa: true },
        measure,
      }),
      'chamada',
    );

    // 47.11, 46.11 … 40.11 are over 40 px: 39.11 is the largest on one line.
    expect(lead?.runs?.[0]?.size).toBe(39.11);
  });

  it('draws the brief picture under the words, full bleed', () => {
    const picture = named(
      contextOf(words('x'), { adjustments: { capa: true }, fundo: asset('arte', 1080, 1350) }),
      'fundo',
    );

    expect(picture?.size).toEqual({ w: 1080, h: 1350 });
  });
});

describe('an explanation', () => {
  it('draws one paragraph per line', () => {
    const context = contextOf([...words('Um.'), brk, ...words('Dois.'), brk, ...words('Três.')]);
    const names = drawn(context)
      .map((node) => node.name)
      .filter((name) => name?.startsWith('paragrafo'));

    expect(names).toEqual(['paragrafo-1', 'paragrafo-2', 'paragrafo-3']);
  });

  it('sets a coloured highlight at the highlight weight, in its declared colour', () => {
    const marked: RichText = [
      ...words('a '),
      { kind: 'mark', key: 'cor', value: 'verde', children: words('b'), range },
      ...words(' '),
      { kind: 'bold', children: words('c'), range },
    ];
    const runs = named(contextOf(marked), 'paragrafo-1')?.runs ?? [];

    expect(runs.map((each) => [each.text, each.weight, hex(each)])).toEqual([
      ['a ', 300, '#4d4d4d'],
      ['b', 500, '#39902e'],
      [' ', 300, '#4d4d4d'],
      ['c', 500, '#4d4d4d'],
    ]);
  });

  it('paints `**x**` the configured highlight colour', () => {
    const runs =
      named(
        contextOf([{ kind: 'bold', children: words('c'), range }], {
          values: { 'highlight-color': '#123456' },
        }),
        'paragrafo-1',
      )?.runs ?? [];

    expect(hex(runs[0])).toBe('#123456');
  });

  it('paints a `{cor:…}` its configured `mark-cor-<name>` colour, at the highlight weight', () => {
    const runs =
      named(
        contextOf([{ kind: 'mark', key: 'cor', value: 'azul', children: words('b'), range }], {
          values: { 'mark-cor-azul': '#abcdef', 'highlight-weight': 650 },
        }),
        'paragrafo-1',
      )?.runs ?? [];

    expect([hex(runs[0]), runs[0]?.weight]).toEqual(['#abcdef', 700]);
  });

  it('draws a configured highlight weight at the nearest declared face, a tie to the heavier', () => {
    // The kit snaps it (TYTO-619) from the faces the template passes: 550 sits nearest 500, and
    // 600, halfway between 500 and 700, goes to 700 as CSS does.
    const boldWeight = (values?: Record<string, number>) =>
      named(
        contextOf(
          [{ kind: 'bold', children: words('c'), range }],
          values === undefined ? undefined : { values },
        ),
        'paragrafo-1',
      )?.runs?.[0]?.weight;

    expect(boldWeight({ 'highlight-weight': 550 })).toBe(500);
    expect(boldWeight({ 'highlight-weight': 600 })).toBe(700);
    expect(boldWeight({ 'highlight-weight': 650 })).toBe(700);
    expect(boldWeight()).toBe(500);
  });

  it('leaves a colour name it does not know as plain text', () => {
    const runs =
      named(
        contextOf([{ kind: 'mark', key: 'cor', value: 'roxo', children: words('b'), range }]),
        'paragrafo-1',
      )?.runs ?? [];

    expect(runs.map((each) => [each.weight, hex(each)])).toEqual([[300, '#4d4d4d']]);
  });

  it('with {titulo}, draws the first line as a title over the paragraphs', () => {
    const context = contextOf([...words('Na prática'), brk, ...words('Um parágrafo.')], {
      adjustments: { titulo: true },
    });
    const title = named(context, 'titulo-lamina');
    const first = named(context, 'paragrafo-1');

    expect(title?.runs?.[0]?.text).toBe('NA PRÁTICA');
    expect(title?.runs?.[0]?.weight).toBe(900);
    expect(first?.runs?.[0]?.text).toBe('Um parágrafo.');
    expect(first?.transform?.y).toBeGreaterThan(title?.transform?.y ?? Infinity);
  });

  it('draws the {titulo} in the deep colour, not the accent', () => {
    const context = contextOf([...words('Na prática'), brk, ...words('Um parágrafo.')], {
      adjustments: { titulo: true },
    });
    const runs = named(context, 'titulo-lamina')?.runs ?? [];

    expect(runs.map((each) => [each.text, each.weight, hex(each)])).toEqual([
      ['NA PRÁTICA', 900, '#204e72'],
    ]);
  });

  it("keeps a {cor:…} in the {titulo} in its colour and bold in the title's, all Black", () => {
    const title: RichText = [
      ...words('O '),
      { kind: 'mark', key: 'cor', value: 'verde', children: words('ciclo'), range },
      ...words(' e o '),
      { kind: 'bold', children: words('tempo'), range },
    ];
    const context = contextOf([...title, brk, ...words('Um parágrafo.')], {
      adjustments: { titulo: true },
    });
    const runs = named(context, 'titulo-lamina')?.runs ?? [];

    // The bold run merges into the words before it: the same face, the same colour.
    expect(runs.map((each) => [each.text, each.weight, hex(each)])).toEqual([
      ['O ', 900, '#204e72'],
      ['CICLO', 900, '#39902e'],
      [' E O TEMPO', 900, '#204e72'],
    ]);
  });

  it('without {titulo}, draws no title', () => {
    const context = contextOf([...words('Na prática'), brk, ...words('Um parágrafo.')]);

    expect(named(context, 'titulo-lamina')).toBeUndefined();
    expect(named(context, 'paragrafo-1')?.runs?.[0]?.text).toBe('Na prática');
  });

  it("sets the slide title between its floor and ceiling, and the body's the same way", () => {
    const short = contextOf([...words('Curto'), brk, ...words('Pouco.')], {
      adjustments: { titulo: true },
    });

    expect(named(short, 'titulo-lamina')?.runs?.[0]?.size).toBe(
      NUMBER_DEFAULTS['slide-title-ceiling'],
    );
    expect(named(short, 'paragrafo-1')?.runs?.[0]?.size).toBe(NUMBER_DEFAULTS['body-ceiling']);

    const long = Array.from({ length: 160 }, () => 'palavra').join(' ');
    const crowded = named(contextOf(words(long)), 'paragrafo-1')?.runs?.[0]?.size ?? 0;

    expect(crowded).toBeLessThan(NUMBER_DEFAULTS['body-ceiling']);
    expect(crowded).toBeGreaterThanOrEqual(NUMBER_DEFAULTS['body-floor']);
  });

  it('places pictures among the lines in the order written, as tall as their shape', () => {
    const blocks = [
      { kind: 'text', text: words('Antes.'), range },
      {
        kind: 'slot',
        slot: {
          name: 'imagem',
          adjustments: [],
          value: { kind: 'image', asset: asset('a', 1540, 770) },
        },
      },
      { kind: 'text', text: words('Depois.'), range },
    ];
    const nodes = drawn(contextOf(words('Antes.'), { blocks }));
    const order = nodes
      .filter((node) => node.name === 'imagem' || node.name?.startsWith('paragrafo'))
      .map((node) => node.name);
    const picture = nodes.find((node) => node.name === 'imagem');

    expect(order).toEqual(['paragrafo-1', 'imagem', 'paragrafo-2']);
    // 2:1 inside the frame: 770 + 25 wide, less its 29 px bar and 4 px border.
    expect(picture?.size).toEqual({ w: 762, h: 381 });
  });

  it("frames a picture as questao-estrategica's, its border in the deep colour", () => {
    const framed = (values?: Record<string, unknown>) =>
      drawn(
        contextOf(words('x'), {
          blocks: [
            {
              kind: 'slot',
              slot: {
                name: 'imagem',
                adjustments: [],
                value: { kind: 'image', asset: asset('p', 200, 100) },
              },
            },
          ],
          ...(values === undefined ? {} : { values }),
        }),
      );
    const border = (nodes: Node[]) => {
      const frame = nodes.find((node) => node.name === 'moldura') as { fill?: Run['color'] };
      return frame.fill === undefined ? '' : hex({ color: frame.fill });
    };
    const names = framed().map((node) => node.name);

    expect(names).toEqual(
      expect.arrayContaining(['moldura', 'fundo-imagem', 'imagem', 'contorno']),
    );
    expect(border(framed())).toBe('#204e72');
    expect(border(framed({ deep: '#123456' }))).toBe('#123456');
  });

  it('stands a frame on a whole pixel, so no seam shows under its corners', () => {
    const nodes = drawn(
      contextOf(words('Um parágrafo que deixa o topo fracionário.'), {
        blocks: [
          { kind: 'text', text: words('Um parágrafo que deixa o topo fracionário.'), range },
          {
            kind: 'slot',
            slot: {
              name: 'imagem',
              adjustments: [],
              value: { kind: 'image', asset: asset('p', 200, 100) },
            },
          },
        ],
      }),
    );
    const tops = nodes
      .filter((node) => ['moldura', 'contorno'].includes(node.name ?? ''))
      .map((node) => node.transform?.y ?? Number.NaN);

    expect(tops).toHaveLength(2);
    for (const top of tops) expect(Number.isInteger(top)).toBe(true);
  });

  it("draws the frame's ink as one outline whose inside is the paper, so no seam shows", () => {
    const nodes = drawn(
      contextOf(words('x'), {
        blocks: [
          {
            kind: 'slot',
            slot: {
              name: 'imagem',
              adjustments: [],
              value: { kind: 'image', asset: asset('p', 200, 100) },
            },
          },
        ],
      }),
    );
    const named = (name: string) =>
      nodes.find((node) => node.name === name) as Node & {
        geometry?: { kind: string; d: string; fillRule: string };
        fill?: unknown;
        size: { w: number; h: number };
      };
    const outline = named('contorno');
    const frame = named('moldura');
    const paper = named('fundo-imagem');
    // One piece of the frame's ink, over the paper and the picture: no corner pieces of their own.
    expect(nodes.map((node) => node.name).filter((name) => name?.startsWith('canto'))).toEqual([]);
    expect(nodes.indexOf(outline)).toBeGreaterThan(nodes.indexOf(named('imagem')));
    expect(outline.transform).toEqual(frame.transform);
    expect(outline.size).toEqual(frame.size);
    expect(outline.geometry?.fillRule).toBe('evenodd');
    expect(outline.fill).toEqual(frame.fill);
    // The outline's hole is exactly the paper: its edges, in the slide's coordinates.
    const d = outline.geometry?.d ?? '';
    const hole = d.slice(d.indexOf('M', 1));
    const numbers = [...hole.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
    const [startX, top, right, foot] = [numbers[0]!, numbers[1]!, numbers[2]!, numbers[3]!];
    const origin = { x: frame.transform!.x, y: frame.transform!.y };
    const r = FRAME.radius;
    expect(origin.x + startX - r).toBe(paper.transform!.x);
    expect(origin.y + top).toBe(paper.transform!.y);
    expect(origin.x + right).toBe(paper.transform!.x + paper.size.w);
    expect(origin.y + foot).toBe(paper.transform!.y + paper.size.h);
    expect(hole).toContain(`A${r} ${r} 0 0 1`);
  });

  it('draws a picture marked {sem-quadro} without the frame, at the paragraphs width', () => {
    const picture = (adjustments: readonly unknown[]) =>
      drawn(
        contextOf(words('x'), {
          blocks: [
            {
              kind: 'slot',
              slot: {
                name: 'imagem',
                adjustments,
                value: { kind: 'image', asset: asset('p', 1540, 770) },
              },
            },
          ],
        }),
      );
    const bare = picture([{ name: 'sem-quadro', range }]);
    const framed = picture([]);

    expect(bare.map((node) => node.name)).not.toContain('moldura');
    expect(bare.find((node) => node.name === 'imagem')?.size).toEqual({ w: 770, h: 385 });
    expect(bare.find((node) => node.name === 'imagem')?.transform?.x).toBe(158);
    expect(framed.map((node) => node.name)).toContain('moldura');
  });

  it('holds a picture between a 3:1 band and a square', () => {
    const height = (w: number, h: number) =>
      drawn(
        contextOf(words('x'), {
          blocks: [
            {
              kind: 'slot',
              slot: {
                name: 'imagem',
                adjustments: [],
                value: { kind: 'image', asset: asset('p', w, h) },
              },
            },
          ],
        }),
      ).find((node) => node.name === 'imagem')?.size?.h;

    expect(height(1000, 100)).toBe(254);
    expect(height(100, 1000)).toBe(762);
  });
});

describe('the sign-off', () => {
  it('draws the default title, or the one line the slide writes', () => {
    expect(
      named(contextOf([], { adjustments: { fecho: true } }), 'fecho-titulo')?.runs?.[0]?.text,
    ).toBe(DEFAULT_SIGN_OFF_TITLE);
    expect(
      named(contextOf(words('Curtiu?'), { adjustments: { fecho: true } }), 'fecho-titulo')
        ?.runs?.[0]?.text,
    ).toBe('Curtiu?');
  });

  it('draws the four icon rows and the signature', () => {
    const names = drawn(contextOf([], { adjustments: { fecho: true } })).map((node) => node.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'curtir',
        'marcar',
        'salvar',
        'compartilhar',
        'curtir-texto',
        'assinatura',
      ]),
    );
  });
});
