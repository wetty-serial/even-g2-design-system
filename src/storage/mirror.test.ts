/**
 * SDK localStorage mirror の失敗系 (B1-B4)。
 * 移植元のアプリのテスト B1〜B4 をそのまま持ってきて、
 * アプリ固有の key / load* / persist* を呼び側が渡す key に置き換えたもの。
 *
 * - B1: getLocalStorage 失敗 (未設定と混同しない) → browser 上書きも migrate もしない
 * - B2: setLocalStorage が false / 例外 → dedup baseline に残さず次回再送させる
 * - B3: rehydrate 完了前の書き込み (companion 操作窓) は SDK の古い値で上書きされない
 * - B4: BLE hang (timeout) は「読み取り失敗」として扱われ、rehydrate 自体はハングしない
 *
 * 旧実装はモジュール単位の状態を持っていたので毎回 `vi.resetModules()` が要ったが、
 * `createMirrorStore` は呼ぶたびに新しい閉包を作るのでその必要が無い。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { createMirrorStore } from './index.ts'

const KEY_LANG = 'app.lang'
const KEYS = [KEY_LANG, 'app.sessions.v1'] as const

class MemoryStorage {
  private map = new Map<string, string>()
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null }
  setItem(k: string, v: string): void { this.map.set(k, v) }
  removeItem(k: string): void { this.map.delete(k) }
}

function mockBridge(overrides: {
  setLocalStorage?: (k: string, v: string) => Promise<boolean>
  getLocalStorage?: (k: string) => Promise<string>
} = {}): EvenAppBridge {
  return {
    setLocalStorage: vi.fn(overrides.setLocalStorage ?? (async () => true)),
    getLocalStorage: vi.fn(overrides.getLocalStorage ?? (async () => '')),
  } as unknown as EvenAppBridge
}

function freshStore() {
  return createMirrorStore({ keys: KEYS, sdkTimeoutMs: 5000 })
}

beforeEach(() => {
  ;(globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage()
})

describe('B1: sdkGet 失敗は「未設定」と区別される', () => {
  it('getLocalStorage が reject した key は browser を上書きしない', async () => {
    const storage = freshStore()
    localStorage.setItem(KEY_LANG, 'en')
    const bridge = mockBridge({ getLocalStorage: async () => { throw new Error('BLE fail') } })
    storage.setBridge(bridge)
    await storage.rehydrate()
    expect(storage.get(KEY_LANG)).toBe('en')
  })

  it('getLocalStorage が reject した key は migrate (SDK へのアップロード) もしない', async () => {
    const storage = freshStore()
    localStorage.setItem(KEY_LANG, 'en')
    const bridge = mockBridge({ getLocalStorage: async () => { throw new Error('BLE fail') } })
    storage.setBridge(bridge)
    await storage.rehydrate()
    await storage.flush()
    expect(bridge.setLocalStorage).not.toHaveBeenCalled()
  })
})

describe('B2: setLocalStorage の戻り値/例外を dedup に反映する', () => {
  it('false を返した書き込みは次回の保存で再送される (dedup で潰されない)', async () => {
    const storage = freshStore()
    const bridge = mockBridge({ setLocalStorage: async () => false })
    storage.setBridge(bridge)
    await storage.rehydrate() // _rehydrated = true 化

    storage.set(KEY_LANG, 'en')
    await storage.flush()
    expect(bridge.setLocalStorage).toHaveBeenCalledTimes(1)

    storage.set(KEY_LANG, 'en') // 同値の再保存
    await storage.flush()
    expect(bridge.setLocalStorage).toHaveBeenCalledTimes(2) // 前回失敗のため dedup されず再送
  })

  it('例外を投げた書き込みも同様に再送される', async () => {
    const storage = freshStore()
    const bridge = mockBridge({ setLocalStorage: async () => { throw new Error('write fail') } })
    storage.setBridge(bridge)
    await storage.rehydrate()

    storage.set(KEY_LANG, 'en')
    await storage.flush()
    storage.set(KEY_LANG, 'en')
    await storage.flush()
    expect(bridge.setLocalStorage).toHaveBeenCalledTimes(2)
  })

  it('成功した書き込みは同値の再保存で dedup され再送されない', async () => {
    const storage = freshStore()
    const bridge = mockBridge({ setLocalStorage: async () => true })
    storage.setBridge(bridge)
    await storage.rehydrate()

    storage.set(KEY_LANG, 'en')
    await storage.flush()
    storage.set(KEY_LANG, 'en')
    await storage.flush()
    expect(bridge.setLocalStorage).toHaveBeenCalledTimes(1)
  })
})

describe('B3: rehydrate 完了前の companion 操作窓', () => {
  it('窓中に書いた値は rehydrate の SDK 古値で上書きされず、その後 SDK へアップロードされる', async () => {
    const storage = freshStore()
    // bridge 未取得 (mountAdminUi が先に走る窓) でユーザーが設定変更
    storage.set(KEY_LANG, 'en')
    expect(storage.get(KEY_LANG)).toBe('en')

    const bridge = mockBridge({ getLocalStorage: async () => 'ja' }) // SDK 側は窓の前の古い値
    storage.setBridge(bridge)
    await storage.rehydrate()

    expect(storage.get(KEY_LANG)).toBe('en') // 上書きされていない
    await storage.flush()
    expect(bridge.setLocalStorage).toHaveBeenCalledWith(KEY_LANG, 'en')
  })
})

describe('B4: BLE hang は timeout で失敗扱いになる', () => {
  it('getLocalStorage が応答しなくても rehydrate は timeout 後に完了する', async () => {
    vi.useFakeTimers()
    try {
      const storage = freshStore()
      const hang = new Promise<string>(() => { /* 永久に解決しない */ })
      const bridge = mockBridge({ getLocalStorage: () => hang })
      storage.setBridge(bridge)

      const p = storage.rehydrate()
      await vi.advanceTimersByTimeAsync(5001)
      await p

      // timeout = 失敗扱いなので browser は触られない (未設定のまま)
      expect(storage.get(KEY_LANG)).toBe(null)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('kit 追加: key 名と timeout は呼び側のもの', () => {
  it('rehydrate は渡した key だけを読む (kit は key 名を持たない)', async () => {
    const storage = freshStore()
    const bridge = mockBridge()
    storage.setBridge(bridge)
    await storage.rehydrate()
    const read = (bridge.getLocalStorage as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => c[0])
    expect(read).toEqual([...KEYS])
  })

  it('SDK 未設定 かつ browser に旧値がある key は一回きり SDK へ上げる', async () => {
    const storage = freshStore()
    localStorage.setItem(KEY_LANG, 'en')
    const bridge = mockBridge({ getLocalStorage: async () => '' })
    storage.setBridge(bridge)
    await storage.rehydrate()
    await storage.flush()
    expect(bridge.setLocalStorage).toHaveBeenCalledWith(KEY_LANG, 'en')
  })

  it('SDK に値があれば browser に写す', async () => {
    const storage = freshStore()
    const bridge = mockBridge({ getLocalStorage: async (k) => (k === KEY_LANG ? 'en' : '') })
    storage.setBridge(bridge)
    await storage.rehydrate()
    expect(storage.get(KEY_LANG)).toBe('en')
  })

  it('remove は browser から消して SDK には空文字を送る', async () => {
    const storage = freshStore()
    const bridge = mockBridge()
    storage.setBridge(bridge)
    await storage.rehydrate()
    storage.set(KEY_LANG, 'en')
    storage.remove(KEY_LANG)
    await storage.flush()
    expect(storage.get(KEY_LANG)).toBe(null)
    expect(bridge.setLocalStorage).toHaveBeenCalledWith(KEY_LANG, '')
  })

  it('sdkTimeoutMs は呼び側の値が効く', async () => {
    vi.useFakeTimers()
    try {
      const storage = createMirrorStore({ keys: KEYS, sdkTimeoutMs: 1000 })
      const bridge = mockBridge({ getLocalStorage: () => new Promise<string>(() => {}) })
      storage.setBridge(bridge)
      const p = storage.rehydrate()
      await vi.advanceTimersByTimeAsync(1001)
      await p
      expect(storage.get(KEY_LANG)).toBe(null)
    } finally {
      vi.useRealTimers()
    }
  })
})
