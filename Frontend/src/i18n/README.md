# Translations (English, Hindi, Marathi)

Every screen, for every role, follows the language chosen on the device
(`localStorage['getpass:language']`, default `en`).

## Files

| File | What it holds |
|---|---|
| `languages.js` | The three languages, their own-script labels and date locales. |
| `languageStorage.js` | The storage key and safe read/write (works when storage is blocked). |
| `translations.js` | Merges the string modules below into one dictionary per language. |
| `strings/common.js` | Shared words: actions, roles, pass states, ERP / quality result pills, pass types, backend error texts. Reuse before adding. |
| `strings/shell.js` | Sidebar, header, mobile bars and More sheet, section names and descriptions, Account page, sign-out. |
| `strings/login.js` | Login page. |
| `strings/entries.js` | New Entry form, Entry Log. |
| `strings/users.js` | Users page. |
| `strings/weighbridge.js` | Weighbridge list, detail sheet, photo capture, QR scanner. |
| `strings/gateIn.js` | Gate-in screen (capture tiles, OCR review, challan lines, PO check, offline queue). |
| `strings/gateOut.js` | Gate-out screen (exit sheet, cancel pass) and the printable return out-pass. |
| `strings/quality.js` | Quality queue and result form. |
| `strings/grn.js` | Stores / GRN screen and GRN editor. |
| `strings/dashboard.js` | Control tower dashboard. |
| `strings/passes.js` | Pass detail page. |
| `apiErrors.js` | Maps known backend `detail` strings to keys in `common.js`. |

## Adding text to a screen

1. Add the key to the screen's module in **`en`, `hi` and `mr` at the same time**.
   Keys share one namespace: check `common.js` first and never define a key in two modules.
2. In the component: `const { t } = useLanguage()` then `t('yourKey')`.
3. Variables use placeholders, never string joining (word order differs):
   `roleFor: 'Role for {username}'` and `t('roleFor', { username })`.
4. Translate `aria-label`, `alt`, `title` and screen-reader text too.
5. Do not translate user data (names, vehicle numbers, project names),
   `kg` / `ton`, or the brand "GatePass". Mark brand text with `lang="en"`.
6. Uppercase labels: write the text in normal case and use a class that CSS
   uppercases for English only (`.page-kicker`). Never write capitals in a key.
7. Role names: `roleLabel(role, t)` from `navigation/navItems.js`.
8. Dates: `const { locale } = useLanguage()` then
   `formatCardDateTime(value, locale)` (cards) or `formatFullDateTime(value, locale)`
   (desktop tables) from `utils/formatDate.js`. Never call `toLocaleString()` directly.
9. Backend errors in a toast: `showToast(apiErrorMessage(err, t, 'fallbackKey'), 'error')`.
   For an error that stays on screen, store `apiErrorDetail(err)` in state and render
   `translateApiDetail(detail, t, 'fallbackKey')` so it follows a language switch.

## Check

`npm run check:i18n` (also runs automatically before `npm run build`) fails
when the three languages do not have identical keys, a value is empty, or a
key is defined in two modules.
