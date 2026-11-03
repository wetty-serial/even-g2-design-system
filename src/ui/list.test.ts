import { describe, expect, it } from 'vitest'
import { pixelWidth } from '../text/index.ts'
import { layoutList, type ListInput } from './list.ts'
import { GLASS } from './tokens.ts'

type Item = { t: string; extra?: number }
const mk = (n: number): Item[] => Array.from({ length: n }, (_, i) => ({ t: `項目${i}` }))
const args = (items: Item[], cursor: number, pageStart: number, extra = 1): ListInput<Item> => ({
  items,
  cursor,
  pageStart,
  renderSelected: (it) => [it.t, ...Array.from({ length: extra }, (_, i) => `meta${i}`)],
  renderRow: (it) => it.t,
})

function check(l: ReturnType<typeof layoutList>) {
  expect(l.faces.length).toBeLessThanOrEqual(6)
  for (const f of l.faces) expect(f.yPosition! + f.height!).toBeLessThanOrEqual(284)
  for (let i = 1; i < l.faces.length; i++) {
    const p = l.faces[i - 1]!
    expect(l.faces[i]!.yPosition).toBe(p.yPosition! + p.height! + 3)
  }
}

describe('layoutList: 幅の安全余白', () => {
  it('選択行も他の行も内寸 548 − 12 = 536 以内に切る (540px の行は切られて … が付く)', () => {
    const wide = 'あ'.repeat(27) // 540px。548 には収まるが 536 には収まらない
    const l = layoutList({
      items: mk(3),
      cursor: 1,
      pageStart: 0,
      renderSelected: () => [wide, wide],
      renderRow: () => wide,
    })
    expect(l.faces).toHaveLength(3)
    const limit = GLASS.FACE.INNER_W - GLASS.TEXT_SAFE_MARGIN
    for (const f of l.faces) {
      for (const line of f.content!.split('\n')) {
        expect(pixelWidth(line)).toBeLessThanOrEqual(limit)
        expect(line.endsWith('…')).toBe(true)
      }
    }
  })
})

describe('layoutList', () => {
  it('空', () => {
    expect(layoutList(args([], 0, 0))).toEqual({ faces: [], pageStart: 0, pageEnd: 0 })
  })

  it('1 件: 選択行の見た目と高さ', () => {
    const l = layoutList(args(mk(1), 0, 0))
    expect(l.faces).toHaveLength(1)
    expect(l.faces[0]).toMatchObject({ borderColor: 15, textColor: 4, height: 62, yPosition: 32, content: '項目0\nmeta0' })
    check(l)
  })

  it('非選択行は 1 行・枠 5・文字 2。行頭の印なし', () => {
    const l = layoutList(args(mk(10), 1, 0))
    expect(l.faces[0]).toMatchObject({ borderColor: 5, textColor: 2, height: 35, content: '項目0' })
    expect(l.faces[1]).toMatchObject({ borderColor: 15, textColor: 4 })
    expect(l.faces.map((f) => f.content).join('')).not.toContain('▶')
  })

  it('100 件: 全カーソル位置で収まる', () => {
    const items = mk(100)
    let start = 0
    for (let c = 0; c < 100; c++) {
      const l = layoutList(args(items, c, start, c % 4))
      check(l)
      expect(l.pageStart).toBeLessThanOrEqual(c)
      expect(l.pageEnd).toBeGreaterThan(c)
      start = l.pageStart
    }
  })

  it('下へ出たら選択行が先頭 / 上へ出たら選択行が末尾', () => {
    const items = mk(100)
    let l = layoutList(args(items, 0, 0, 0))
    expect(l.pageEnd).toBe(6)
    // 5 → 6 で下へ出る
    l = layoutList(args(items, 6, l.pageStart, 0))
    expect(l.pageStart).toBe(6)
    expect(l.faces[0]!.borderColor).toBe(15)
    // 6 → 5 で上へ出る
    l = layoutList(args(items, 5, l.pageStart, 0))
    expect(l.faces[l.faces.length - 1]!.borderColor).toBe(15)
    expect(l.pageEnd).toBe(6)
    expect(l.pageStart).toBe(0)
  })

  it('ページ内の移動では pageStart を変えない', () => {
    const items = mk(100)
    for (const c of [5, 6, 7, 8, 9]) expect(layoutList(args(items, c, 5, 0)).pageStart).toBe(5)
    for (const c of [9, 8, 7, 6, 5]) expect(layoutList(args(items, c, 5, 0)).pageStart).toBe(5)
  })

  // 項目ごとに選択時の行数が違う一覧
  const tall = (at: number, lines: number): ListInput<Item> => ({
    ...args(mk(12), 0, 0),
    renderSelected: (it) => [it.t, ...Array.from({ length: it.t === `項目${at}` ? lines - 1 : 0 }, (_, i) => `m${i}`)],
  })

  it('選択行が高くて今のページに収まらなくなったら、その行を先頭にしたページへ切り替える (1 行だけ流れない)', () => {
    const o = tall(4, 4) // 項目4 だけ選択時 4 行 (120px)。項目0〜3 の 168px と併せると 284 を超える
    const before = layoutList({ ...o, cursor: 3, pageStart: 0 })
    expect(before.pageStart).toBe(0)
    const after = layoutList({ ...o, cursor: 4, pageStart: before.pageStart })
    expect(after.pageStart).toBe(4)
    expect(after.faces[0]!.borderColor).toBe(15)
    check(after)
  })

  it('選択行が窓に収まるなら、他の行の高さが違っても動かさない', () => {
    const o = tall(2, 3)
    for (const c of [0, 1, 2, 3, 4]) expect(layoutList({ ...o, cursor: c, pageStart: 0 }).pageStart).toBe(0)
  })

  it('上へ窓の外に出たら、その行を末尾にして後ろから詰める', () => {
    const o = tall(4, 4)
    const l = layoutList({ ...o, cursor: 4, pageStart: 5 })
    expect(l.faces[l.faces.length - 1]!.borderColor).toBe(15)
    expect(l.pageEnd).toBe(5)
    check(l)
  })

  it('選択行が高くて収まらないときは先頭を送って詰める', () => {
    const l = layoutList(args(mk(20), 3, 0, 7)) // 選択 8 行 = 224
    check(l)
    expect(l.pageStart).toBe(3)
    expect(l.faces[0]!.height).toBe(224)
  })

  it('選択行が 9 行以上なら上から 8 行に削る', () => {
    const o = args(mk(3), 0, 0)
    o.renderSelected = () => Array.from({ length: 12 }, (_, i) => `行${i}`)
    const l = layoutList(o)
    const lines = l.faces[0]!.content!.split('\n')
    expect(lines).toEqual(Array.from({ length: 8 }, (_, i) => `行${i}`))
    expect(l.faces[0]!.height).toBe(224)
    check(l)
  })

  it('長い行は幅で切る', () => {
    const o = args(mk(2), 0, 0)
    o.renderRow = () => 'あ'.repeat(100)
    const l = layoutList(o)
    expect(l.faces[1]!.content!.endsWith('…')).toBe(true)
  })
})

describe('layoutList: maxFaces / rowTextColor', () => {
  it('省略時は 6 枚まで (maxFaces: 6 と同じ)', () => {
    const a = layoutList(args(mk(20), 0, 0, 0))
    const b = layoutList({ ...args(mk(20), 0, 0, 0), maxFaces: 6 })
    expect(a.faces).toHaveLength(6)
    expect(b).toEqual(a)
  })

  it('maxFaces で 1 ページの枚数が減り、ページ送りもその上限で判定する', () => {
    const items = mk(20)
    let l = layoutList({ ...args(items, 0, 0, 0), maxFaces: 3 })
    expect(l.faces).toHaveLength(3)
    expect(l.pageEnd).toBe(3)
    l = layoutList({ ...args(items, 2, l.pageStart, 0), maxFaces: 3 })
    expect(l.pageStart).toBe(0)
    l = layoutList({ ...args(items, 3, l.pageStart, 0), maxFaces: 3 })
    expect(l.pageStart).toBe(3)
    l = layoutList({ ...args(items, 0, l.pageStart, 0), maxFaces: 3 })
    expect(l.pageStart).toBe(0)
    expect(l.pageEnd).toBe(3)
  })

  it('maxFaces が 1〜6 の整数以外は RangeError', () => {
    for (const m of [0, 7, -1, 2.5, NaN]) {
      expect(() => layoutList({ ...args(mk(3), 0, 0), maxFaces: m })).toThrow(RangeError)
    }
    expect(() => layoutList({ ...args(mk(3), 0, 0), maxFaces: 1 })).not.toThrow()
  })

  it('rowTextColor 省略時は非選択行 2', () => {
    const l = layoutList(args(mk(3), 1, 0))
    expect(l.faces.map((f) => f.textColor)).toEqual([2, 4, 2])
  })

  it('rowTextColor は非選択行だけ項目ごとに上書きし、選択行には効かない', () => {
    const l = layoutList({ ...args(mk(3), 1, 0), rowTextColor: (it) => (it.t === '項目0' ? 1 : 3) })
    expect(l.faces.map((f) => f.textColor)).toEqual([1, 4, 3])
    expect(l.faces.map((f) => f.borderColor)).toEqual([5, 15, 5])
  })

  it('rowTextColor が 0〜4 の整数以外なら RangeError', () => {
    for (const c of [-1, 5, 1.5, NaN]) {
      expect(() => layoutList({ ...args(mk(3), 1, 0), rowTextColor: () => c })).toThrow(RangeError)
    }
    expect(() => layoutList({ ...args(mk(3), 1, 0), rowTextColor: () => 0 })).not.toThrow()
  })
})
