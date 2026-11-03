import { describe, expect, it } from 'vitest'
import { createInputPolicy } from './input.ts'

const mk = (invert = false) => createInputPolicy({ invert: () => invert })

describe('createInputPolicy', () => {
  it('スワイプを 350ms で間引く', () => {
    const p = mk()
    expect(p.accept('down', 1000)).toBe('down')
    expect(p.accept('down', 1349)).toBeNull()
    expect(p.accept('down', 1351)).toBe('down')
  })

  it('スワイプ後 199ms のタップは捨て、201ms は通す', () => {
    const p = mk()
    p.accept('up', 1000)
    expect(p.accept('tap', 1199)).toBeNull()
    expect(p.accept('tap', 1201)).toBe('tap')
  })

  it('間引きで捨てたスワイプも誤タップの起点になる', () => {
    const p = mk()
    p.accept('up', 1000)
    expect(p.accept('up', 1300)).toBeNull()
    expect(p.accept('tap', 1450)).toBeNull()
    expect(p.accept('tap', 1501)).toBe('tap')
  })

  it('ダブル・長押し・離す・OS メニューの直後のタップも捨てる', () => {
    for (const k of ['double', 'hold', 'release', 'menu'] as const) {
      const p = mk()
      expect(p.accept(k, 5000)).toBe(k)
      expect(p.accept('tap', 5100)).toBeNull()
    }
  })

  it('タップの後のタップは捨てない', () => {
    const p = mk()
    expect(p.accept('tap', 1000)).toBe('tap')
    expect(p.accept('tap', 1050)).toBe('tap')
  })

  it('OS メニューの開閉 (fg_enter / fg_exit) は素通しで、直後のタップを捨てる起点になる', () => {
    for (const k of ['fg_enter', 'fg_exit'] as const) {
      const p = mk()
      expect(p.accept(k, 1000)).toBe(k)
      expect(p.accept('tap', 1100)).toBeNull()
      expect(p.accept('tap', 1201)).toBe('tap')
    }
  })

  it('離脱系 (abnormal / system_exit) は素通しで、誤タップの起点にならない', () => {
    for (const k of ['abnormal', 'system_exit'] as const) {
      const p = mk()
      expect(p.accept(k, 1000)).toBe(k)
      expect(p.accept('tap', 1010)).toBe('tap')
    }
  })

  it('反転で上下が入れ替わる (設定は毎回読む)', () => {
    let inv = true
    const p = createInputPolicy({ invert: () => inv })
    expect(p.accept('up', 1000)).toBe('down')
    expect(p.accept('down', 2000)).toBe('up')
    inv = false
    expect(p.accept('up', 3000)).toBe('up')
  })

  it('反転しても tap / double は変わらない', () => {
    const p = mk(true)
    expect(p.accept('double', 1000)).toBe('double')
  })
})

describe('createInputPolicy: acceptWithReason', () => {
  it('通ったら dropped は null、kind は accept と同じ (反転後)', () => {
    const p = mk(true)
    expect(p.acceptWithReason('up', 1000)).toEqual({ kind: 'down', dropped: null })
    expect(p.acceptWithReason('double', 2000)).toEqual({ kind: 'double', dropped: null })
  })

  it('間引いたスワイプは swipe-gate、誤タップとして捨てたタップは tap-guard', () => {
    const p = mk()
    p.acceptWithReason('down', 1000)
    expect(p.acceptWithReason('down', 1100)).toEqual({ kind: null, dropped: 'swipe-gate' })
    expect(p.acceptWithReason('tap', 1150)).toEqual({ kind: null, dropped: 'tap-guard' })
    expect(p.acceptWithReason('tap', 1400)).toEqual({ kind: 'tap', dropped: null })
  })

  it('accept と同じ判定を共有する (どちらで呼んでも同じ状態が進む)', () => {
    const p = mk()
    expect(p.accept('down', 1000)).toBe('down')
    expect(p.acceptWithReason('down', 1100).dropped).toBe('swipe-gate')
    expect(p.accept('tap', 1150)).toBeNull()
  })
})

describe('createInputPolicy: swipeGateMs', () => {
  it('省略時は 350ms', () => {
    const p = createInputPolicy({ invert: () => false })
    expect(p.accept('down', 1000)).toBe('down')
    expect(p.accept('down', 1349)).toBeNull()
    expect(p.accept('down', 1351)).toBe('down')
  })

  it('指定すると毎回呼んだ値で間引く', () => {
    let ms = 100
    const p = createInputPolicy({ invert: () => false, swipeGateMs: () => ms })
    expect(p.accept('down', 1000)).toBe('down')
    expect(p.accept('down', 1099)).toBeNull()
    expect(p.accept('down', 1101)).toBe('down')
    ms = 1000
    expect(p.accept('down', 1600)).toBeNull()
    expect(p.accept('down', 2102)).toBe('down')
  })
})
