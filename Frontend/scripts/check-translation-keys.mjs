// Fails (exit code 1) when the English, Hindi and Marathi dictionaries drift
// apart, so a screen can never show a raw key or a silent English fallback.
// Checks, per string module: every language has exactly the same keys and no
// empty values. Across modules: no key is defined in two modules, because the
// merged dictionary would silently keep only one of them.
// Runs automatically before `npm run build` (prebuild) and via `npm run check:i18n`.
import { STRING_MODULES } from '../src/i18n/translations.js'
import { LANGUAGES } from '../src/i18n/languages.js'

const LANGUAGE_CODES = LANGUAGES.map(({ code }) => code)
const [REFERENCE_LANGUAGE] = LANGUAGE_CODES

function missingKeys(fromKeys, inDictionary) {
  return fromKeys.filter((key) => !(key in inDictionary))
}

function checkModuleParity(moduleName, module) {
  const problems = []
  const referenceKeys = Object.keys(module[REFERENCE_LANGUAGE] ?? {})

  for (const code of LANGUAGE_CODES) {
    const dictionary = module[code]
    if (!dictionary) {
      problems.push(`${moduleName}: language "${code}" is missing`)
      continue
    }
    missingKeys(referenceKeys, dictionary).forEach((key) => problems.push(`${moduleName}.${code}: missing "${key}"`))
    missingKeys(Object.keys(dictionary), module[REFERENCE_LANGUAGE]).forEach((key) =>
      problems.push(`${moduleName}.${code}: extra "${key}" (not in ${REFERENCE_LANGUAGE})`),
    )
    Object.entries(dictionary)
      .filter(([, value]) => typeof value !== 'string' || value.trim() === '')
      .forEach(([key]) => problems.push(`${moduleName}.${code}: "${key}" is empty or not text`))
  }
  return problems
}

function checkDuplicateKeys() {
  const ownerByKey = new Map()
  const problems = []
  for (const [moduleName, module] of Object.entries(STRING_MODULES)) {
    for (const key of Object.keys(module[REFERENCE_LANGUAGE] ?? {})) {
      if (ownerByKey.has(key)) problems.push(`"${key}" is defined in both ${ownerByKey.get(key)} and ${moduleName}`)
      else ownerByKey.set(key, moduleName)
    }
  }
  return { problems, keyCount: ownerByKey.size }
}

const parityProblems = Object.entries(STRING_MODULES).flatMap(([name, module]) => checkModuleParity(name, module))
const { problems: duplicateProblems, keyCount } = checkDuplicateKeys()
const problems = [...parityProblems, ...duplicateProblems]

if (problems.length > 0) {
  process.stderr.write(`Translation key check failed (${problems.length} problems):\n  ${problems.join('\n  ')}\n`)
  process.exit(1)
}

process.stdout.write(`Translation keys OK: ${keyCount} keys in ${LANGUAGE_CODES.join(', ')}.\n`)
