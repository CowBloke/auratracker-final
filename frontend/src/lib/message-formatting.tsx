import type { ReactNode } from 'react';

const FORMAT_STYLES: Record<string, string> = {
  g: 'text-emerald-500',
  green: 'text-emerald-500',
  r: 'text-red-500',
  red: 'text-red-500',
  bl: 'text-sky-500',
  blue: 'text-sky-500',
  y: 'text-yellow-500',
  yellow: 'text-yellow-500',
  p: 'text-purple-500',
  purple: 'text-purple-500',
  pink: 'text-pink-500',
  o: 'text-orange-500',
  orange: 'text-orange-500',
  c: 'text-cyan-500',
  cyan: 'text-cyan-500',
  bold: 'font-bold',
  b: 'font-bold',
  u: 'underline underline-offset-2',
  underline: 'underline underline-offset-2',
  rainbow: 'animated-message-rainbow font-semibold',
  multi: 'animated-message-rainbow font-semibold',
};

function findMatchingClose(text: string, code: string, contentStart: number) {
  const open = `#${code}[`;
  const close = `]#${code}`;
  let depth = 1;
  let cursor = contentStart;

  while (cursor < text.length) {
    const nextOpen = text.indexOf(open, cursor);
    const nextClose = text.indexOf(close, cursor);

    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + open.length;
      continue;
    }

    depth -= 1;
    if (depth === 0) return nextClose;
    cursor = nextClose + close.length;
  }

  return -1;
}

function parseFormattedMessage(text: string, keyPrefix = 'fmt'): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let key = 0;

  while (cursor < text.length) {
    const openMatch = text.slice(cursor).match(/#([a-z]+)\[/i);
    if (!openMatch || openMatch.index === undefined) {
      nodes.push(text.slice(cursor));
      break;
    }

    const openIndex = cursor + openMatch.index;
    const code = openMatch[1].toLowerCase();
    const className = FORMAT_STYLES[code];

    if (!className) {
      nodes.push(text.slice(cursor, openIndex + openMatch[0].length));
      cursor = openIndex + openMatch[0].length;
      continue;
    }

    if (openIndex > cursor) {
      nodes.push(text.slice(cursor, openIndex));
    }

    const contentStart = openIndex + openMatch[0].length;
    const closeIndex = findMatchingClose(text, code, contentStart);

    if (closeIndex === -1) {
      nodes.push(text.slice(openIndex));
      break;
    }

    nodes.push(
      <span key={`${keyPrefix}-${key++}`} className={className}>
        {parseFormattedMessage(text.slice(contentStart, closeIndex), `${keyPrefix}-${key}`)}
      </span>,
    );
    cursor = closeIndex + code.length + 2;
  }

  return nodes;
}

export function FormattedMessageText({ text }: { text: string }) {
  return <>{parseFormattedMessage(text)}</>;
}

export function hasMessageFormatting(text: string) {
  return /#([a-z]+)\[/i.test(text);
}
