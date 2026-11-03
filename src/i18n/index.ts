/**
 * グラス側の文言テーブル引き (`even-g2-design-system/i18n`)。
 *
 * 出自は既存の自作アプリ 2 本の `t()`
 * (2 本とも本体は `TRANSLATIONS[state.lang][key] ?? TRANSLATIONS.ja[key] ?? key`)。
 *
 * **TRANSLATIONS はアプリに残す** (画面の文言そのもの)。fallback も引数で受ける
 * (アプリによって `ja` も `en` もある)。
 * `Lang` 型だけを使い、TRANSLATIONS を持たないアプリは `t()` を作らなくてよい。
 */

export type Lang = 'ja' | 'en'

/**
 * `TRANSLATIONS` を閉じ込めた `t(key)` を作る。
 * 引く順は **現在の言語 → fallback → key そのもの** (key を返すのは翻訳漏れを画面で見つけるため)。
 */
export function createT<K extends string>(
  translations: Record<Lang, Record<K, string>>,
  getLang: () => Lang,
  fallback: Lang,
): (key: K) => string {
  return (key: K): string => translations[getLang()][key] ?? translations[fallback][key] ?? key
}
