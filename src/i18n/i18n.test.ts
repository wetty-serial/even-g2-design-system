/**
 * characterization: 既存の自作アプリの `t()` と同じ引き方になること。
 * 元の本体は `TRANSLATIONS[state.lang][key] ?? TRANSLATIONS.ja[key] ?? key`。
 */
import { describe, expect, it } from 'vitest'
import { createT, type Lang } from './index.ts'

type Key = 'status_loading' | 'now_none' | 'only_ja'

// TRANSLATIONS の例 3 件 (en に 1 件だけ欠けを作ってある)
const TRANSLATIONS: Record<Lang, Record<Key, string>> = {
  ja: { status_loading: '取得中', now_none: '再生中のメディアなし', only_ja: '日本語だけ' },
  en: { status_loading: 'loading', now_none: 'nothing playing' } as Record<Key, string>,
}

describe('createT', () => {
  it('現在の言語で引く', () => {
    let lang: Lang = 'ja'
    const t = createT(TRANSLATIONS, () => lang, 'ja')
    expect(t('status_loading')).toBe('取得中')
    lang = 'en'
    expect(t('status_loading')).toBe('loading')
  })

  it('getLang は毎回読む (言語を変えたら次の呼び出しから効く)', () => {
    const calls: number[] = []
    let lang: Lang = 'ja'
    const t = createT(TRANSLATIONS, () => { calls.push(1); return lang }, 'ja')
    t('now_none')
    lang = 'en'
    expect(t('now_none')).toBe('nothing playing')
    expect(calls.length).toBe(2)
  })

  it('現在の言語に無ければ fallback を引く', () => {
    const t = createT(TRANSLATIONS, () => 'en', 'ja')
    expect(t('only_ja')).toBe('日本語だけ')
  })

  it('fallback にも無ければ key をそのまま返す', () => {
    const t = createT(TRANSLATIONS, () => 'en', 'ja')
    expect(t('missing' as Key)).toBe('missing')
  })

  it('fallback は引数 (en 側にもできる)', () => {
    const t = createT(TRANSLATIONS, () => 'en', 'en')
    expect(t('only_ja')).toBe('only_ja') // en fallback では拾えない
  })
})
