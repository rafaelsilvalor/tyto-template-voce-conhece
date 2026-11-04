/**
 * The plugin's entry: one template pack whose only template, `voce-conhece`, is a code template.
 *
 * Tyto reads the manifests from `templates/` itself (Tyto ADR 0046), so the pack lists none.
 * The folder holds no `template.ts`: the code is this bundle's, and Tyto calls `build` in the
 * plugin's own process by the template's manifest name (Tyto ADR 0048).
 */

import { build as buildCarousel } from './template.js';

import type { TemplateContext } from '@tyto/core';
import type { PluginHost } from '@tyto/plugin-api';

const BUILDS = { 'voce-conhece': buildCarousel } as const;

export function activate(host: PluginHost): void {
  host.registerTemplatePack({
    id: 'voce-conhece',
    templates: [],
    directory: 'templates',
    build: (template: string, context: TemplateContext) => {
      const build = BUILDS[template as keyof typeof BUILDS];
      if (build === undefined) {
        throw new Error(`voce-conhece draws no template named '${template}'.`);
      }
      return build(context);
    },
  });
}
