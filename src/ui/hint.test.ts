import { describe, expect, it } from 'vitest'
import { createFirstRunHint } from './hint.ts'

function fakeKv(init: Record<string, string> = {}) {
  const m = { ...init }
  return {
    m,
    async getLocalStorage(k: string) { return m[k] ?? '' },
    async setLocalStorage(k: string, v: string) { m[k] = v; return true },
  }
}

describe('createFirstRunHint', () => {
  it('画面ごとに 3 回まで true、4 回目から false', async () => {
    const h = createFirstRunHint({ kv: fakeKv(), appKey: 'app' })
    for (let i = 0; i < 3; i++) {
      expect(h.shouldShow('detail')).toBe(true)
      await h.seen('detail')
    }
    expect(h.shouldShow('detail')).toBe(false)
    expect(h.shouldShow('home')).toBe(true)
  })

  it('resetAll で戻る', async () => {
    const h = createFirstRunHint({ kv: fakeKv(), appKey: 'app' })
    for (let i = 0; i < 3; i++) await h.seen('detail')
    await h.resetAll()
    expect(h.shouldShow('detail')).toBe(true)
  })

  it('<appKey>.hintCount に保存し、load で復元する', async () => {
    const kv = fakeKv()
    const a = createFirstRunHint({ kv, appKey: 'pn' })
    await a.seen('detail')
    await a.seen('detail')
    await a.seen('detail')
    expect(JSON.parse(kv.m['pn.hintCount']!)).toEqual({ detail: 3 })
    const b = createFirstRunHint({ kv, appKey: 'pn' })
    expect(b.shouldShow('detail')).toBe(true) // load 前
    await b.load()
    expect(b.shouldShow('detail')).toBe(false)
  })

  it('壊れた保存値は 0 回扱い', async () => {
    const h = createFirstRunHint({ kv: fakeKv({ 'a.hintCount': '{oops' }), appKey: 'a' })
    await h.load()
    expect(h.shouldShow('x')).toBe(true)
  })
})
