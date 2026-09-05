import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = 'src';
const LOCALES = 'src/locales';
const NAMESPACE = 'ext.json';

const LITERAL_KEY = /\bt\(\s*'([a-z0-9_]+)'/g;
const TEMPLATE_KEY = /\bt\(\s*`([a-z0-9_]*)\$\{/g;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return entry === 'locales' ? [] : sourceFiles(path);
    return /\.(ts|vue)$/.test(entry) && !entry.endsWith('.test.ts') ? [path] : [];
  });
}

function collectUsage(): { keys: Set<string>; prefixes: string[] } {
  const keys = new Set<string>();
  const prefixes: string[] = [];
  for (const file of sourceFiles(ROOT)) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(LITERAL_KEY)) keys.add(match[1]!);
    for (const match of source.matchAll(TEMPLATE_KEY)) {
      if (match[1]!.length > 0) prefixes.push(match[1]!);
    }
  }
  return { keys, prefixes };
}

function messagesFor(locale: string): Record<string, string> {
  return JSON.parse(readFileSync(join(LOCALES, locale, NAMESPACE), 'utf8')) as Record<
    string,
    string
  >;
}

const locales = readdirSync(LOCALES).filter((entry) => statSync(join(LOCALES, entry)).isDirectory());
const base = messagesFor('en-US');

describe('translations', () => {
  it('has every key the interface asks for', () => {
    const { keys } = collectUsage();
    const known = Object.keys(base);
    const missing = [...keys]
      .filter(
        (key) =>
          base[key] === undefined &&
          !known.some((candidate) => candidate.startsWith(`${key}_`)),
      )
      .sort();
    expect(missing).toEqual([]);
  });

  it('covers every dynamic key prefix', () => {
    const { prefixes } = collectUsage();
    const known = Object.keys(base);
    const orphans = [...new Set(prefixes)]
      .filter((prefix) => !known.some((key) => key.startsWith(prefix)))
      .sort();
    expect(orphans).toEqual([]);
  });

  it('keeps other locales in step with en-US', () => {
    for (const locale of locales.filter((entry) => entry !== 'en-US')) {
      const messages = messagesFor(locale);
      const unknown = Object.keys(messages).filter((key) => base[key] === undefined);
      expect({ locale, unknown }).toEqual({ locale, unknown: [] });
    }
  });

  it('interpolates the same variables in every locale', () => {
    const variables = (value: string) => [...value.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]!);
    for (const locale of locales.filter((entry) => entry !== 'en-US')) {
      const messages = messagesFor(locale);
      for (const [key, value] of Object.entries(messages)) {
        const expected = variables(base[key] ?? '').sort();
        const actual = variables(value).sort();
        expect({ locale, key, actual }).toEqual({ locale, key, actual: expected });
      }
    }
  });
});
