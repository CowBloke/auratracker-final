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
    const offenders: string[] = [];
    for (const file of [...walk('pages'), ...walk('components')]) {
      if (!/\.tsx$/.test(file) || file.startsWith('components/ui')) continue;
      read(file)
        .split('\n')
        .forEach((line, index) => {
          const trimmed = line.trim();
          if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('${')) return;
          // `$` littéral dans le JSX (aucun gabarit de chaîne avant) ou gabarit `$${...}`
          const jsxDollar = /\$\{/.test(line) && !line.slice(0, line.search(/\$\{/)).includes('`');
          if (jsxDollar || /\$\$\{/.test(line)) offenders.push(`${file}:${index + 1}`);
        });
    }
    expect(offenders).toEqual([]);
  });

  it('aucun montant écrit avec « $ » dans les textes (ex. « 500 $ », « 20$ »)', () => {
    const offenders = [...walk('pages'), ...walk('components'), ...walk('lib'), ...walk('features')]
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts') && !file.startsWith('components/ui'))
      .filter((file) => /\d[\s\u00a0]?\$(?![\w{(/])|\(\$\)/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('aucun dialogue natif du navigateur (confirm / alert / prompt)', () => {
    const offenders = [...walk('pages'), ...walk('components')]
      .filter((file) => /\.tsx?$/.test(file) && !file.endsWith('.test.ts') && !file.startsWith('components/ui'))
      .filter((file) => /(^|[^.\w])(confirm|alert|prompt)\(/.test(read(file)) && !/useAppDialog|\bconfirm[,:]/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it('les textes visibles tutoient le joueur (pas de « votre », « vos », « veuillez »)', () => {
    const literal = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\\n$]|\\.)*)`|>([^<>{}\n]+)</g;
    const vouvoiement = /(?<!\p{L})(votre|vos|vôtre|veuillez|voulez-vous|[a-zé]+ez-vous)(?!\p{L})/iu;
    const offenders: string[] = [];
    for (const file of [...walk('pages'), ...walk('components'), ...walk('lib'), ...walk('config')]) {
      if (!/\.tsx?$/.test(file) || file.endsWith('.test.ts') || file.startsWith('components/ui') || file.startsWith('lib/tutorials')) continue;
      if (file === 'pages/Games.tsx') continue;
      read(file)
        .split('\n')
        .forEach((line, index) => {
          if (/^\s*(import |\/\/|\*)/.test(line)) return;
          for (const match of line.matchAll(literal)) {
            const text = match[1] ?? match[2] ?? match[3] ?? match[4] ?? '';
            if (text.includes(' ') && vouvoiement.test(text)) offenders.push(`${file}:${index + 1} ${text.slice(0, 60)}`);
          }
        });
    }
    expect(offenders).toEqual([]);
  });

  it('les titres de section suivent l’échelle h2 = text-lg, h3 = text-base (hors scènes de jeu thématiques)', () => {
    const themed = new Set(['pages/Casino.tsx', 'pages/HorseRace.tsx', 'pages/BlockBlast.tsx']);
    const offenders: string[] = [];
    for (const file of [...walk('pages'), ...walk('components'), ...walk('features')]) {
      if (!file.endsWith('.tsx') || file.startsWith('components/ui') || themed.has(file)) continue;
      for (const [, tag, classes] of read(file).matchAll(/<(h2|h3) className="([^"]*)"/g)) {
        const tokens = classes.split(/\s+/);
        if (tokens.some((token) => /^(text-(xl|2xl|3xl)|sm:text-2xl|font-(bold|extrabold|black))$/.test(token))) {
          offenders.push(`${file}: <${tag} className="${classes}">`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
