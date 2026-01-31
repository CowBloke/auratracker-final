import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_BOMBPARTY_LANGUAGE_FILE = 'dictionary.txt';

const DATA_DIR = path.join(__dirname, '../../data');

export type BombPartyLanguageOption = {
  fileName: string;
  label: string;
};

export function listBombPartyLanguageFiles(): BombPartyLanguageOption[] {
  if (!fs.existsSync(DATA_DIR)) return [];

  const entries = fs.readdirSync(DATA_DIR, { withFileTypes: true });
  const languages = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
    .map((entry) => ({
      fileName: entry.name,
      label: entry.name.replace(/\.txt$/i, ''),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return languages;
}

export function resolveBombPartyLanguageFile(requested?: string | null): string {
  const languages = listBombPartyLanguageFiles();
  const requestedNormalized = requested?.trim();

  if (requestedNormalized) {
    const match = languages.find((lang) => lang.fileName === requestedNormalized);
    if (match) return match.fileName;
  }

  if (languages.length === 0) {
    return requestedNormalized || DEFAULT_BOMBPARTY_LANGUAGE_FILE;
  }

  const defaultMatch = languages.find(
    (lang) => lang.fileName.toLowerCase() === DEFAULT_BOMBPARTY_LANGUAGE_FILE
  );
  return defaultMatch?.fileName ?? languages[0].fileName;
}

export function getBombPartyDictionaryPath(languageFile: string): string {
  return path.join(DATA_DIR, languageFile);
}

export function readBombPartyDictionaryWords(languageFile: string): string[] {
  const dictionaryPath = getBombPartyDictionaryPath(languageFile);

  if (!fs.existsSync(dictionaryPath)) {
    throw new Error(`Dictionary file not found at: ${dictionaryPath}`);
  }

  const content = fs.readFileSync(dictionaryPath, 'utf-8');
  return content
    .split('\n')
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length >= 2);
}
