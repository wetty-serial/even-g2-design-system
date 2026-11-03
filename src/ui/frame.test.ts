import { describe, expect, it } from 'vitest'
import { pixelWidth } from '../text/index.ts'
import { topBar } from './top.ts'
import { card, centeredLabel, hintLine, overlay, padToFixedSet } from './frame.ts'

describe('frame', () => {
  it('card の既定値', () => {
    const c = card(4, 'main', 'x')
    expect(c).toMatchObject({
      xPosition: 8, yPosition: 32, width: 560, height: 252,
      borderWidth: 2, borderColor: 15, borderRadius: 12, paddingLength: 4, isEventCapture: 0,
    })
    expect(card(4, 'main', 'x', { h: 220 }).height).toBe(220)
  })

  it('hintLine', () => {
    const h = hintLine(9, 'タップで再試行')
    expect(h).toMatchObject({ xPosition: 12, yPosition: 256, width: 552, height: 28, textColor: 2 })
  })

  it('centeredLabel: 実測幅ぴったりの container を box の中央に置く (空白でずらさない)', () => {
    const box = { x: 8, y: 32, w: 560, h: 252 }
    const l = centeredLabel(5, 'label', '読み込み中…', box)
    expect(l.content).toBe('読み込み中…')
    expect(l.content).not.toMatch(/^[\s　]/)
    const textW = pixelWidth('読み込み中…')
    expect(l.width!).toBeGreaterThanOrEqual(Math.ceil(textW))
    expect(l.width!).toBeLessThanOrEqual(Math.ceil(textW) + 4)
    expect(l.height).toBe(27)
    expect(l).toMatchObject({ borderWidth: 0, paddingLength: 0, isEventCapture: 0, containerID: 5 })
    // 左右・上下の余りが 1px 以内で等しい
    expect(Math.abs(l.xPosition! - box.x - (box.x + box.w - (l.xPosition! + l.width!)))).toBeLessThanOrEqual(1)
    expect(Math.abs(l.yPosition! - box.y - (box.y + box.h - (l.yPosition! + l.height!)))).toBeLessThanOrEqual(1)
  })

  it('centeredLabel: 幅は文字ごとに変わる', () => {
    const box = { x: 8, y: 32, w: 560, h: 252 }
    expect(centeredLabel(5, 'a', 'Loading…', box).width).not.toBe(centeredLabel(5, 'a', '読み込み中…', box).width)
  })
})

describe('overlay', () => {
  it('全面・枠 0・content 空・入力受け (ID 1)', () => {
    expect(overlay()).toMatchObject({
      containerID: 1, containerName: 'overlay', xPosition: 0, yPosition: 0, width: 576, height: 288,
      borderWidth: 0, borderColor: 0, paddingLength: 0, isEventCapture: 1, content: '',
    })
  })
})

describe('padToFixedSet', () => {
  const bar = (layout: 'one' | 'two') => topBar({ layout, left: 'h', offline: false, clock: '1:00' }).containers
  const ids = (cs: { containerID?: number }[]) => cs.map((c) => c.containerID)

  it('足りない ID を 1〜8 まで埋め草で埋める (ID 昇順)', () => {
    const out = padToFixedSet([card(4, 'body', 'x'), ...bar('two')])
    expect(ids(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(out).toHaveLength(8)
  })

  it('埋め草は x12 y0 w552 h28・content 半角空白・枠 0・入力を受けない。入力受けは overlay だけ', () => {
    const out = padToFixedSet(bar('one'))
    const f = out.find((c) => c.containerID === 6)!
    expect(f).toMatchObject({
      xPosition: 12, yPosition: 0, width: 552, height: 28,
      content: ' ', borderWidth: 0, borderColor: 0, isEventCapture: 0,
    })
    expect(out.filter((c) => c.isEventCapture === 1).map((c) => c.containerID)).toEqual([1])
  })

  it('8 枚そろっていれば何も足さない / 元の配列は変えない', () => {
    const full = Array.from({ length: 8 }, (_, i) => (i === 0 ? overlay() : card(i + 1, `c${i + 1}`, 'x')))
    expect(padToFixedSet(full)).toHaveLength(8)
    const src = bar('one')
    padToFixedSet(src)
    expect(src).toHaveLength(2)
  })

  it('ID が重複・範囲外なら RangeError', () => {
    expect(() => padToFixedSet([...bar('one'), card(4, 'a', 'x'), card(4, 'b', 'x')])).toThrow(RangeError)
    expect(() => padToFixedSet([...bar('one'), card(9, 'a', 'x')])).toThrow(RangeError)
  })

  it("'two' に ID 8 の表示面を混ぜると right と重複して RangeError ('one' なら通る)", () => {
    expect(() => padToFixedSet([...bar('two'), card(8, 'face5', 'x')])).toThrow(RangeError)
    expect(padToFixedSet([...bar('one'), card(8, 'face5', 'x')])).toHaveLength(8)
  })
})
