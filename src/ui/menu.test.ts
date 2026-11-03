import { describe, expect, it } from 'vitest'
import { buildMenu, MENU_MAX } from './menu.ts'

describe('buildMenu', () => {
  it('共通が先頭、画面固有が後ろ', () => {
    const m = buildMenu({
      common: [{ id: 1, name: '設定' }, { id: 2, name: '再読み込み' }],
      screen: [{ id: 10, name: 'Likeする' }],
    })
    expect(m.map((i) => i.itemID)).toEqual([1, 2, 10])
    expect(m.map((i) => i.itemName)).toEqual(['設定', '再読み込み', 'Likeする'])
  })

  it('重複 ID は throw', () => {
    expect(() =>
      buildMenu({ common: [{ id: 1, name: 'a' }], screen: [{ id: 1, name: 'b' }] }),
    ).toThrow(/重複/)
  })

  it('ID 0 は throw', () => {
    expect(() => buildMenu({ common: [{ id: 0, name: 'a' }], screen: [] })).toThrow()
  })

  it('項目名 32 byte 超は throw (日本語 11 文字 = 33 byte)', () => {
    expect(() => buildMenu({ common: [{ id: 1, name: 'あ'.repeat(11) }], screen: [] })).toThrow(RangeError)
    expect(() => buildMenu({ common: [{ id: 1, name: 'あ'.repeat(10) }], screen: [] })).not.toThrow()
  })

  it('上限は 10 (simulator 0.9.1 は 10 項目を受け付けた)', () => {
    expect(MENU_MAX).toBe(10)
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `m${i}` }))
    expect(buildMenu({ common: mk(10), screen: [] })).toHaveLength(10)
    expect(() => buildMenu({ common: mk(11), screen: [] })).toThrow(RangeError)
  })

  it('MENU_MAX 超は throw', () => {
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `m${i}` }))
    expect(() => buildMenu({ common: mk(MENU_MAX), screen: [] })).not.toThrow()
    expect(() => buildMenu({ common: mk(MENU_MAX + 1), screen: [] })).toThrow(RangeError)
  })
})
