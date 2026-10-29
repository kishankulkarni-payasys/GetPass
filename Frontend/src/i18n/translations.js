import { common } from './strings/common.js'
import { entries } from './strings/entries.js'
import { login } from './strings/login.js'
import { shell } from './strings/shell.js'
import { users } from './strings/users.js'
import { weighbridge } from './strings/weighbridge.js'

// One module per screen area so screens can be translated in parallel without
// editing the same file. Keys share one namespace: a key must live in exactly
// one module (the key-parity check fails the build on duplicates).
// Imports keep the `.js` extension so the Node check script can load them too.
export const STRING_MODULES = { common, shell, login, entries, users, weighbridge }

function mergeLanguage(code) {
  return Object.assign({}, ...Object.values(STRING_MODULES).map((module) => module[code]))
}

export const translations = {
  en: mergeLanguage('en'),
  hi: mergeLanguage('hi'),
  mr: mergeLanguage('mr'),
}
