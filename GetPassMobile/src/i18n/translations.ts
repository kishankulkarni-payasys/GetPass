import { common } from './strings/common';
import { dashboard } from './strings/dashboard';
import { entries } from './strings/entries';
import { gateIn } from './strings/gateIn';
import { gateOut } from './strings/gateOut';
import { grn } from './strings/grn';
import { login } from './strings/login';
import { mobile } from './strings/mobile';
import { passes } from './strings/passes';
import { quality } from './strings/quality';
import { shell } from './strings/shell';
import { users } from './strings/users';
import { weighbridge } from './strings/weighbridge';

export type LanguageCode = 'en' | 'hi' | 'mr';
type Catalog = Record<LanguageCode, Record<string, string>>;

const modules = [common, dashboard, entries, gateIn, gateOut, grn, login, mobile, passes, quality, shell, users, weighbridge];

function mergeLanguage(language: LanguageCode): Record<string, string> {
  return Object.assign({}, ...modules.map(module => module[language]));
}

export const translations: Catalog = {
  en: mergeLanguage('en'),
  hi: mergeLanguage('hi'),
  mr: mergeLanguage('mr'),
};

const englishKeys = new Map<string, string>();
const englishKeysLowercase = new Map<string, string>();
const placeholderPatterns: Array<{ key: string; names: string[]; pattern: RegExp }> = [];

for (const [key, english] of Object.entries(translations.en)) {
  if (!englishKeys.has(english)) englishKeys.set(english, key);
  if (!englishKeysLowercase.has(english.toLocaleLowerCase())) englishKeysLowercase.set(english.toLocaleLowerCase(), key);
  if (!english.includes('{')) continue;

  const names: string[] = [];
  const expression = english
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\{(\w+)\\\}/g, (_match, name: string) => {
      names.push(name);
      return '(.+?)';
    });
  placeholderPatterns.push({ key, names, pattern: new RegExp(`^${expression}$`) });
}

placeholderPatterns.sort((first, second) => second.pattern.source.length - first.pattern.source.length);

export function translateText(value: string, language: LanguageCode): string {
  const leadingWhitespace = value.match(/^\s*/)?.[0] ?? '';
  const trailingWhitespace = value.match(/\s*$/)?.[0] ?? '';
  const core = value.slice(leadingWhitespace.length, value.length - trailingWhitespace.length);
  if (!core) return value;

  const exactKey = englishKeys.get(core) ?? englishKeysLowercase.get(core.toLocaleLowerCase());
  if (exactKey) return `${leadingWhitespace}${translations[language][exactKey] ?? core}${trailingWhitespace}`;

  for (const item of placeholderPatterns) {
    const match = item.pattern.exec(core);
    if (!match) continue;
    const translated = item.names.reduce(
      (result, name, index) => result.replace(`{${name}}`, match[index + 1]),
      translations[language][item.key] ?? core,
    );
    return `${leadingWhitespace}${translated}${trailingWhitespace}`;
  }

  return value;
}

export const LANGUAGES: ReadonlyArray<{ code: LanguageCode; label: string; locale: string }> = [
  { code: 'en', label: 'English', locale: 'en-IN' },
  { code: 'hi', label: 'हिंदी', locale: 'hi-IN' },
  { code: 'mr', label: 'मराठी', locale: 'mr-IN' },
];
