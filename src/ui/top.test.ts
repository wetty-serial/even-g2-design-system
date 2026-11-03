import { TextContainerProperty } from '@evenrealities/even_hub_sdk'
import { describe, expect, it } from 'vitest'
import { pixelWidth, truncateByPixelWidth } from '../text/index.ts'
import { WORDS } from './tokens.ts'
import { position, progressBar } from './progress.ts'
import { fillGap, topBar, topLayout, type TopBarInput } from './top.ts'

const base = { left: 'ブックマーク', offline: false, clock: '14:32' }
const one = (o: Partial<TopBarInput> = {}) => topBar({ ...base, layout: 'one', ...o })
const two = (o: Partial<TopBarInput> = {}) => topBar({ ...base, layout: 'two', ...o })
type Bar = { containers: TextContainerProperty[] }
const byId = (t: Bar, id: number) => t.containers.find((c) => c.containerID === id)!
const header = (t: Bar) => byId(t, 2)
const right = (t: Bar) => byId(t, 8)

/** 旧版 topBar の出力 (ID と isEventCapture 以外) を写したもの。'two' の見た目は旧版と同じでなければならない */
function legacyTwo(o: Omit<TopBarInput, 'layout'>) {
  const lang = o.lang ?? 'ja'
  const content =
    (o.offline ? WORDS[lang].offline + '　' : '') +
    (o.bar ? progressBar(o.bar.done, o.bar.total) + ' ' : '') +
    (o.pos ? position(o.pos.index, o.pos.total) + '　' : '') +
    o.clock
  const rightW = Math.ceil(pixelWidth(content.replace(/\d/g, '4'))) + 4
  const rightX = 564 - rightW
  const headerW = rightX - 12 - 8
  return {
    header: {
      xPosition: 12, yPosition: 0, width: headerW, height: 28, borderWidth: 0, borderColor: 0, paddingLength: 0,
      textColor: o.textColor ?? 3, content: truncateByPixelWidth(o.left, headerW),
    },
    right: {
      xPosition: rightX, yPosition: 0, width: rightW, height: 28, borderWidth: 0, borderColor: 0, paddingLength: 0,
      textColor: o.textColor ?? 3, content,
    },
  }
}

describe('topBar: containers と入力受け', () => {
  it("'one' は [overlay 1, header 2]、入力受けは overlay だけ", () => {
    const t = one()
    expect(t.containers.map((c) => [c.containerID, c.isEventCapture])).toEqual([[1, 1], [2, 0]])
    expect(t.containers[0]).toMatchObject({
      containerName: 'overlay', xPosition: 0, yPosition: 0, width: 576, height: 288,
      borderWidth: 0, paddingLength: 0, content: '',
    })
    expect(t.containers[1]).toMatchObject({
      containerName: 'header', xPosition: 12, yPosition: 0, width: 564, height: 28, borderWidth: 0, paddingLength: 0,
    })
  })

  it("'two' は [overlay 1, header 2, right 8]、入力受けは overlay だけ", () => {
    const t = two()
    expect(t.containers.map((c) => [c.containerID, c.isEventCapture])).toEqual([[1, 1], [2, 0], [8, 0]])
    expect(right(t).containerName).toBe('right')
  })

  it("'two' の header・right は旧版の出力と ID・isEventCapture 以外すべて一致する", () => {
    const cases: Omit<TopBarInput, 'layout'>[] = [
      base,
      { ...base, offline: true },
      { ...base, pos: { index: 3, total: 24 }, bar: { done: 3, total: 24 } },
      { ...base, offline: true, pos: { index: 4, total: 240 }, bar: { done: 1, total: 240 }, clock: '01:11' },
      { ...base, left: 'あ'.repeat(100) },
      { ...base, textColor: 1 },
      { ...base, lang: 'en', offline: true },
    ]
    for (const c of cases) {
      const t = topBar({ ...c, layout: 'two' })
      const e = legacyTwo(c)
      expect(header(t)).toMatchObject(e.header)
      expect(right(t)).toMatchObject(e.right)
    }
  })
})

describe("topBar: 'one' の content", () => {
  it("left' で始まり、pad は空白だけ、right の内容で終わる。left' は 'two' の header と同じ", () => {
    const cases: Partial<TopBarInput>[] = [
      {},
      { offline: true },
      { pos: { index: 3, total: 24 }, bar: { done: 3, total: 24 } },
      { left: 'あ'.repeat(100), pos: { index: 1, total: 9 } },
      { left: 'Settings', pos: { index: 1, total: 9 } },
    ]
    for (const c of cases) {
      const lp = header(two(c)).content!
      const rc = right(two(c)).content!
      const content = header(one(c)).content!
      expect(content.startsWith(lp), JSON.stringify(c)).toBe(true)
      expect(content.endsWith(rc)).toBe(true)
      const pad = content.slice(lp.length, content.length - rc.length)
      expect(pad).toMatch(/^[　]*[ ]*$/)
      expect(pad.length).toBeGreaterThan(0)
    }
  })

  it('pad が位置・時計を right の x に寄せる (誤差 1px 以内)', () => {
    const c = { pos: { index: 3, total: 24 } }
    const lp = header(two(c)).content!
    const rc = right(two(c))
    const content = header(one(c)).content!
    const pad = content.slice(lp.length, content.length - rc.content!.length)
    const f = [...pad].filter((ch) => ch === '　').length
    const h = pad.length - f
    expect(Math.abs(20 * f + (16 / 3) * h - (rc.xPosition! - 12 - pixelWidth(lp)))).toBeLessThanOrEqual(1)
  })
})

describe('topBar: shapeKey', () => {
  it("'one' は left・pos・clock・offline・bar が変わっても同じ", () => {
    const a = one({ pos: { index: 3, total: 24 }, bar: { done: 3, total: 24 } })
    const b = one({ left: 'ほか', clock: '01:11', offline: true, pos: { index: 24, total: 240 } })
    expect(b.shapeKey).toBe(a.shapeKey)
    expect(a.shapeKey).toBe('L1ja')
  })

  it("'two' の時刻・位置の数字が変わっても shapeKey と幅が同じ", () => {
    const a = two({ pos: { index: 3, total: 24 }, bar: { done: 3, total: 24 } })
    const b = two({ clock: '01:11', pos: { index: 24, total: 24 }, bar: { done: 24, total: 24 } })
    expect(b.shapeKey).toBe(a.shapeKey)
    expect(right(b).width).toBe(right(a).width)
    expect(right(b).xPosition).toBe(right(a).xPosition)
    expect(header(b).width).toBe(header(a).width)
  })

  it("'two' は未接続・総数の桁・バーの有無で shapeKey が変わる", () => {
    const k = (o: object) => two(o).shapeKey
    const plain = k({ pos: { index: 1, total: 24 } })
    expect(k({ pos: { index: 1, total: 24 }, offline: true })).not.toBe(plain)
    expect(k({ pos: { index: 1, total: 240 } })).not.toBe(plain)
    expect(k({ pos: { index: 1, total: 24 }, bar: { done: 1, total: 24 } })).not.toBe(plain)
    expect(k({})).not.toBe(plain)
  })

  it("'one' と 'two' の shapeKey は別", () => {
    expect(one().shapeKey).not.toBe(two().shapeKey)
    expect(two().shapeKey).toBe('L2o0b0p0lja')
  })
})

describe("topBar: 'two' の幅", () => {
  it('right の右端が 564、header と 8px 空く', () => {
    for (const o of [{}, { offline: true }, { pos: { index: 1, total: 240 }, bar: { done: 1, total: 240 } }]) {
      const t = two(o)
      expect(right(t).xPosition! + right(t).width!).toBe(564)
      expect(header(t).xPosition! + header(t).width! + 8).toBe(right(t).xPosition)
    }
  })

  it('幅に 00:44 / 44:44 が収まる', () => {
    const t = two({ clock: '00:00' })
    expect(pixelWidth('00:44')).toBeLessThanOrEqual(right(t).width!)
    expect(pixelWidth('44:44')).toBeLessThanOrEqual(right(t).width!)
  })

  it('実測幅が数字を 4 に置換した幅より広い並び (4/9 など) でも右に 2px 以上の余白が残る', () => {
    for (let i = 1; i <= 9; i++) {
      for (const clock of ['00:00', '04:09', '10:11', '14:32', '23:59']) {
        const t = two({ pos: { index: i, total: 9 }, clock })
        const slack = right(t).width! - pixelWidth(right(t).content!)
        expect(slack, `${i}/9 ${clock}`).toBeGreaterThanOrEqual(2)
      }
    }
    expect(right(two({ pos: { index: 4, total: 9 }, clock: '14:32' })).content).toBe('4/9　14:32')
  })

  it('最大形 (未接続 + バー + 位置 + 時計) の内容と収まり', () => {
    const t = two({ offline: true, pos: { index: 3, total: 24 }, bar: { done: 3, total: 24 } })
    expect(right(t).content).toBe('未接続　━━──────── 03/24　14:32')
    expect(pixelWidth('未接続　━━━━━━━━━━ 44/44　44:44')).toBeLessThanOrEqual(right(t).width!)
  })

  it('header は長い文字を幅で切る', () => {
    const t = two({ left: 'あ'.repeat(100) })
    expect(pixelWidth(header(t).content!)).toBeLessThanOrEqual(header(t).width!)
  })
})

describe('topBar: textColor', () => {
  it('省略時は header・right とも 3、shapeKey は L2 + 従来', () => {
    const t = two()
    expect(header(t).textColor).toBe(3)
    expect(right(t).textColor).toBe(3)
    expect(t.shapeKey).toBe('L2o0b0p0lja')
    expect(header(one()).textColor).toBe(3)
  })

  it('指定すると効き、shapeKey が変わる (textColor は upgrade で変えられない)', () => {
    for (const mk of [one, two]) {
      const t = mk({ textColor: 1 })
      expect(header(t).textColor).toBe(1)
      expect(t.shapeKey).not.toBe(mk().shapeKey)
      expect(t.shapeKey).not.toBe(mk({ textColor: 2 }).shapeKey)
      expect(mk({ textColor: 1, clock: '01:11' }).shapeKey).toBe(t.shapeKey)
    }
    expect(right(two({ textColor: 1 })).textColor).toBe(1)
  })

  it('0〜4 の整数以外は RangeError', () => {
    for (const mk of [one, two]) {
      for (const c of [-1, 5, 1.5, NaN]) expect(() => mk({ textColor: c })).toThrow(RangeError)
      expect(() => mk({ textColor: 0 })).not.toThrow()
    }
  })
})

describe('fillGap', () => {
  const w = (s: string) =>
    20 * [...s].filter((c) => c === '　').length + (16 / 3) * [...s].filter((c) => c === ' ').length

  // gap 44 だけは全角・半角の個数が非負の範囲で 1px 以内に届かない (最良 4/3)。設計は 40〜560 で ≤ 1 としていたが数学的に不可
  it('gap 40〜560 の全整数で誤差 1px 以内 (44 だけ 4/3 以内)、全角のあとに半角 (この順)', () => {
    for (let gap = 40; gap <= 560; gap++) {
      const pad = fillGap(gap)
      expect(pad).toMatch(/^[　]*[ ]*$/)
      expect(Math.abs(w(pad) - gap), `gap ${gap}`).toBeLessThanOrEqual(gap === 44 ? 4 / 3 + 1e-9 : 1)
    }
  })

  it('gap 0 以下は半角 1 個', () => {
    for (const g of [0, -1, -100]) expect(fillGap(g)).toBe(' ')
  })

  it('gap 101 は 全角 4 + 半角 4', () => {
    expect(fillGap(101)).toBe('　　　　    ')
  })
})

describe('topLayout', () => {
  it('表示面 6 以上で one、5 以下で two', () => {
    expect(topLayout(0)).toBe('two')
    expect(topLayout(5)).toBe('two')
    expect(topLayout(6)).toBe('one')
    expect(topLayout(20)).toBe('one')
  })
})
