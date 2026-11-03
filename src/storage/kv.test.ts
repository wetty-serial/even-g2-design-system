/**
 * 薄い Kv (`createKvStore`)。移植元の自作アプリ 4 本にはこの層のテストが無かったので、
 * 「bridge が 1.5 s で来ないとき lsShim に落ちる」を含めてここで固定する。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const sdk = vi.hoisted(() => ({ waitForEvenAppBridge: vi.fn() }))
vi.mock('@evenrealities/even_hub_sdk', () => ({
  waitForEvenAppBridge: (): unknown => sdk.waitForEvenAppBridge(),
}))

import { createKvStore } from './index.ts'
import type { Kv } from './index.ts'

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, v) }
  removeItem(k: string): void { this.map.delete(k) }
}

function fakeBridge(): Kv & { calls: string[] } {
  const map = new Map<string, string>()
  const calls: string[] = []
  return {
    calls,
    async getLocalStorage(key: string): Promise<string> { calls.push(`get:${key}`); return map.get(key) ?? '' },
    async setLocalStorage(key: string, value: string): Promise<boolean> { calls.push(`set:${key}`); map.set(key, value); return true },
  }
}

const WARN = '[state] SDK bridge unavailable within 1.5s; using window.localStorage (dev only)'

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
  sdk.waitForEvenAppBridge.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('createKvStore', () => {
  it('bridge が時間内に来れば bridge に読み書きする', async () => {
    const b = fakeBridge()
    sdk.waitForEvenAppBridge.mockImplementation(async () => b)
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })

    expect(await kv.set('x.k', 'v')).toBe(true)
    expect(await kv.get('x.k')).toBe('v')
    expect(b.calls).toEqual(['set:x.k', 'get:x.k'])
    expect(localStorage.getItem('x.k')).toBe(null) // browser には書かない
  })

  it('bridge が来なければ timeout 後に window.localStorage へ縮退し、警告を 1 行出す', async () => {
    vi.useFakeTimers()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sdk.waitForEvenAppBridge.mockImplementation(() => new Promise(() => { /* 解決しない */ }))
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })

    const p = kv.set('x.k', 'v')
    await vi.advanceTimersByTimeAsync(1500)
    expect(await p).toBe(true)

    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledWith(WARN)
    expect(localStorage.getItem('x.k')).toBe('v')
  })

  it('未設定 key は空文字を返す (null ではない)', async () => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    sdk.waitForEvenAppBridge.mockImplementation(() => new Promise(() => { /* 解決しない */ }))
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })

    const p = kv.get('x.missing')
    await vi.advanceTimersByTimeAsync(1500)
    expect(await p).toBe('')
  })

  it('waitForEvenAppBridge が投げても shim に落ちる', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sdk.waitForEvenAppBridge.mockImplementation(async () => { throw new Error('no bridge') })
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })

    await kv.set('x.k', 'v')
    expect(localStorage.getItem('x.k')).toBe('v')
    expect(warn).toHaveBeenCalledWith(WARN)
  })

  it('shim に縮退した後でも setBridge で以降の読み書きが bridge に戻る', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    sdk.waitForEvenAppBridge.mockImplementation(async () => { throw new Error('no bridge') })
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })
    await kv.set('x.k', 'shim')
    expect(warn).toHaveBeenCalled()

    const b = fakeBridge()
    kv.setBridge(b as never)
    await kv.set('x.k', 'bridge')
    expect(await kv.get('x.k')).toBe('bridge')
    expect(localStorage.getItem('x.k')).toBe('shim') // 縮退中の値はそのまま残る
  })

  it('setBridge した bridge を getBridge が返す', () => {
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })
    expect(kv.getBridge()).toBe(null)
    const b = fakeBridge()
    kv.setBridge(b as never)
    expect(kv.getBridge()).toBe(b)
  })

  it('bridge の待機は 1 回だけ (getStore を何度呼んでも同じ Promise)', async () => {
    const b = fakeBridge()
    sdk.waitForEvenAppBridge.mockImplementation(async () => b)
    const kv = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })

    await Promise.all([kv.get('a'), kv.get('b'), kv.getStore()])
    expect(sdk.waitForEvenAppBridge).toHaveBeenCalledTimes(1)
  })

  it('インスタンスごとに独立している (アプリを跨いで縮退状態を共有しない)', async () => {
    const b = fakeBridge()
    const a1 = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })
    const a2 = createKvStore({ bridgeTimeoutMs: 1500, fallbackWarning: WARN })
    a1.setBridge(b as never)
    expect(a1.getBridge()).toBe(b)
    expect(a2.getBridge()).toBe(null)
  })
})
