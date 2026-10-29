import { common } from './strings/common.js'
import { dashboard } from './strings/dashboard.js'
import { entries } from './strings/entries.js'
import { gateIn } from './strings/gateIn.js'
import { gateOut } from './strings/gateOut.js'
import { grn } from './strings/grn.js'
import { login } from './strings/login.js'
import { passes } from './strings/passes.js'
import { quality } from './strings/quality.js'
import { shell } from './strings/shell.js'
import { users } from './strings/users.js'
import { weighbridge } from './strings/weighbridge.js'

// One module per screen area so screens can be translated in parallel without
// editing the same file. Keys share one namespace: a key must live in exactly
// one module (the key-parity check fails the build on duplicates).
// Imports keep the `.js` extension so the Node check script can load them too.
export const STRING_MODULES = {
  common,
  shell,
  login,
  entries,
  users,
  weighbridge,
  gateIn,
  gateOut,
  quality,
  grn,
  dashboard,
  passes,
}

function mergeLanguage(code) {
  return Object.assign({}, ...Object.values(STRING_MODULES).map((module) => module[code]))
}

export const translations = {
  en: mergeLanguage('en'),
  hi: mergeLanguage('hi'),
  mr: mergeLanguage('mr'),
}
