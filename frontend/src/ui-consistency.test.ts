import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { getSearchablePageEntries } from './lib/page-meta';

const SRC = __dirname;
const read = (file: string) => readFileSync(join(SRC, file), 'utf8');

function walk(dir: string): string[] {
  return readdirSync(join(SRC, dir)).flatMap((name) => {
    const relative = join(dir, name);
    return statSync(join(SRC, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

const EMOJI = /\p{Extended_Pictographic}/u;
const app = read('App.tsx');

/** Pages routées sous le Layout : { route, fichier } (hors redirections et routes à paramètres). */
function routedPages() {
  const imports = new Map<string, string>();
  for (const [, name, file] of app.matchAll(/const (\w+) = lazy\(\(\) => import\('\.\/(pages\/[\w/]+)'\)\)/g)) {
    imports.set(name, file);
  }
  const pages: { route: string; file: string }[] = [];
  for (const [, path, component] of app.matchAll(/<Route path="([^"]+)" element=\{<(\w+) \/>\}/g)) {
    if (path.includes(':') || path.includes('*') || path.startsWith('/')) continue;
    const file = imports.get(component);
    if (file) pages.push({ route: `/${path}`, file: `${file}.tsx` });
  }
  return pages;
}

describe('cohérence de l’interface', () => {
  const pages = routedPages();

  it('détecte bien les pages routées', () => {
    expect(pages.length).toBeGreaterThan(50);
  });

  it('chaque page routée a un titre et une description dans page-meta', () => {
    const known = new Map(getSearchablePageEntries().map((entry) => [entry.path, entry]));
    const missing = pages.map((page) => page.route).filter((route) => !known.get(route)?.description);
    expect(missing).toEqual([]);
  });

  it('chaque page routée utilise PageShell ou GameShell (ou délègue à un sous-dossier)', () => {
    const delegating = new Set(['pages/Admin.tsx', 'pages/Support.tsx', 'pages/You.tsx']);
    const offenders = pages
      .map((page) => page.file)
      .filter((file) => !delegating.has(file))
      .filter((file) => !/PageShell|GameShell|CryptoTradingTerminal/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('PageHeader / GameShell sont la seule source de h1 dans les pages applicatives', () => {
    // Exceptions assumées : nom du joueur sur le profil, h1 masqué de la carte, pages hors application.
    const allowed = new Set(['pages/Profile.tsx', 'pages/you/index.tsx', 'pages/NotFound.tsx']);
    const offenders = [...walk('pages'), ...walk('components/game')]
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => file.replaceAll('\\', '/'))
      .filter((file) => !allowed.has(file) && !/^pages\/(Login|Register|Banned|Maintenance|Blocked)\.tsx$/.test(file))
      .filter((file) => /<h1[\s>]/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('les largeurs et marges de page ne sont définies que dans PageShell / GameShell', () => {
    const offenders = walk('pages')
      .filter((file) => file.endsWith('.tsx'))
      .filter((file) => /<PageShell[^>]*(size=|max-w-|px-|p-\d)/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('aucun emoji dans les titres de page, de section ou de boîte de dialogue', () => {
    const heading = /<(h[1-3]|CardTitle|DialogTitle|EmptyTitle|SheetTitle)[^>]*>([^<]*)</g;
    const offenders: string[] = [];
    for (const file of walk('pages').concat(walk('components'))) {
      if (!file.endsWith('.tsx') || file.startsWith('components/ui')) continue;
      for (const [, , text] of read(file).matchAll(heading)) {
        if (EMOJI.test(text)) offenders.push(`${file}: ${text.trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('les titres de page-meta et de la sidebar ne contiennent ni emoji ni accent manquant courant', () => {
    const titles = getSearchablePageEntries().flatMap((entry) => [entry.title, entry.description ?? '']);
    expect(titles.filter((text) => EMOJI.test(text))).toEqual([]);
    expect(titles.filter((text) => /(?<!\p{L})(volatilite|reduite|serres|tres|Economie|Communaute)(?!\p{L})/u.test(text))).toEqual([]);
  });

  it('la monnaie s’affiche en euro, jamais en dollar', () => {
    const offenders = [...walk('pages'), ...walk('components')]
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts'))
      .filter((file) => /\$\$\{|`[+-]?\$\$\{/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('aucun dialogue natif du navigateur (confirm / alert / prompt)', () => {
    const offenders = [...walk('pages'), ...walk('components')]
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts') && !file.startsWith('components/ui'))
      .filter((file) => /(^|[^.\w])(confirm|alert|prompt)\(/.test(read(file)) && !/useAppDialog|\bconfirm[,:]/.test(read(file)));
    expect(offenders).toEqual([]);
  });
});
