/**
 * 永続化 (`even-g2-design-system/storage`)。**性格の違う 2 つ**を並べて置く。
 *
 * - `createKvStore` — 薄い Kv (`Kv` + `lsShim` + `getStore()`)。bridge が来るのを
 *   `bridgeTimeoutMs` だけ待ち、来なければ `window.localStorage` に縮退する。
 *   出自は既存の自作アプリ 4 本の保存処理 (本体は 4 本とも同一。**差は console.warn の文言だけ**なので引数)
 * - `createMirrorStore` — SDK ⇔ browser の mirror。出自は別の自作アプリの保存処理
 *   (`sdkGet / sdkSet / withSdkTimeout / preRehydrateDirty / lastSentToSdk / rehydrate / flush`)
 *
 * **key 名は呼び側が渡す**。kit は `<app>.` の接頭辞も既定 key も持たない
 * (実機に保存済みの値を引き継ぐため。1 文字変えると設定が飛ぶ)。
 * 型付きの `load* / persist*` もアプリに残す。
 */
import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

// ───── 薄い Kv ─────

export type Kv = {
  getLocalStorage(key: string): Promise<string>
  setLocalStorage(key: string, value: string): Promise<boolean>
}

const lsShim: Kv = {
  async getLocalStorage(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? ''
    } catch {
      return ''
    }
  },
  async setLocalStorage(key, value) {
    try {
      globalThis.localStorage?.setItem(key, value)
      return true
    } catch {
      return false
    }
  },
}

export type KvStoreOptions = {
  /** bridge を待つ時間。4 本とも 1500 (kit に既定値は置かない) */
  bridgeTimeoutMs: number
  /** 縮退したときに `console.warn` に出す 1 行。アプリごとに接頭辞が違うので引数 */
  fallbackWarning: string
}

export type KvStore = {
  /** bridge が確定したら以降の読み書きを差し替える (shim に縮退したまま恒久化させない)。 */
  setBridge(b: EvenAppBridge): void
  getBridge(): EvenAppBridge | null
  getStore(): Promise<Kv>
  /** 未設定の key は **空文字**が返る。null ではない。 */
  get(key: string): Promise<string>
  set(key: string, value: string): Promise<boolean>
}

/**
 * `window.localStorage` 直使用は Even Hub WebView で永続保証されない。
 * bridge の `getLocalStorage` / `setLocalStorage` (スマホ側 storage) へ保存し、
 * bridge が居ない素ブラウザ dev だけ `bridgeTimeoutMs` で `window.localStorage` に縮退する。
 */
export function createKvStore(opts: KvStoreOptions): KvStore {
  let storePromise: Promise<Kv> | null = null
  let _bridge: EvenAppBridge | null = null

  function getStore(): Promise<Kv> {
    if (storePromise) return storePromise
    storePromise = (async () => {
      try {
        const b = await Promise.race([
          waitForEvenAppBridge(),
          new Promise<null>((r) => setTimeout(() => r(null), opts.bridgeTimeoutMs)),
        ])
        if (b) return b as unknown as Kv
      } catch {
        /* fall through to shim */
      }
      console.warn(opts.fallbackWarning)
      return lsShim
    })()
    return storePromise
  }

  return {
    setBridge(b: EvenAppBridge): void {
      _bridge = b
      // タイムアウトで shim に縮退した後でも、bridge 確定時点で差し替えて
      // 以降の読み書きが localStorage 固定のまま恒久化しないようにする
      storePromise = Promise.resolve(b as unknown as Kv)
    },
    getBridge: () => _bridge,
    getStore,
    async get(key: string): Promise<string> {
      return (await getStore()).getLocalStorage(key)
    },
    async set(key: string, value: string): Promise<boolean> {
      return (await getStore()).setLocalStorage(key, value)
    },
  }
}

// ───── SDK localStorage mirror (WebView の localStorage 対策) ─────

export type MirrorStoreOptions = {
  /** rehydrate で読み直す key の全量。**呼び側が渡す** (kit は key 名を持たない) */
  keys: readonly string[]
  /** getLocalStorage/setLocalStorage は BLE 中継で hang しうる。以前の自作アプリでは 5000 */
  sdkTimeoutMs: number
}

export type MirrorStore = {
  /** bootstrap で SDK bridge 取得後に呼ぶ。`rehydrate()` 完了までは SDK mirror は抑止される。 */
  setBridge(b: EvenAppBridge): void
  /**
   * setBridge 直後、**保存を誘発しうる処理より前**に呼ぶ。
   * SDK localStorage の値を browser localStorage に mirror する。
   */
  rehydrate(): Promise<void>
  /** 離脱イベント (FOREGROUND_EXIT 等) 前に呼ぶ。保留中の SDK 書き込みを await する。 */
  flush(): Promise<void>
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

/**
 * browser localStorage は install/relaunch で消えうる非 durable cache に降格。
 * SDK localStorage (getLocalStorage/setLocalStorage) を真の永続先として非同期 mirror する。
 *
 * rehydrate 前に発生する書き込み (companion が bridge 取得前に mount される窓) は
 * browser localStorage には即反映されるが、SDK へはまだ送らない (`preRehydrateDirty` に記録するのみ)。
 * rehydrate が SDK の (窓の前の) 古い値でその browser 値を上書きしないようにするため。
 */
export function createMirrorStore(opts: MirrorStoreOptions): MirrorStore {
  let _bridge: EvenAppBridge | null = null
  let _rehydrated = false
  const lastSentToSdk = new Map<string, string>() // dedup 用: SDK へ最後に **成功** 送信した値
  const preRehydrateDirty = new Set<string>()      // rehydrate 完了前に set された key (companion 操作窓対策)
  const pendingSdkWrites = new Set<Promise<void>>()

  function withSdkTimeout<T>(p: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('sdk storage timeout')), opts.sdkTimeoutMs)
      p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
    })
  }

  function sdkSet(key: string, value: string): void {
    if (!_rehydrated) { preRehydrateDirty.add(key); return } // 窓中の書き込みは browser のみ、rehydrate 後にアップロード
    if (!_bridge) return
    if (lastSentToSdk.get(key) === value) return // dedup: 前回成功と同値なら無送信 (30s polling 対策)
    lastSentToSdk.set(key, value)
    const b = _bridge
    const p = (async () => {
      try {
        const ok = await withSdkTimeout(b.setLocalStorage(key, value))
        if (!ok) { lastSentToSdk.delete(key); console.warn('[storage] sdkSet returned false', key) }
      } catch (e) {
        lastSentToSdk.delete(key) // 失敗/timeout: dedup baseline を戻し次回保存で再送させる
        console.warn('[storage] sdkSet fail', key, e)
      }
    })().finally(() => { pendingSdkWrites.delete(p) })
    pendingSdkWrites.add(p)
  }
  function sdkRemove(key: string): void { sdkSet(key, '') }

  /** 「値あり」「未設定」「読み取り失敗 (timeout 含む)」の 3 値を区別する。 */
  type SdkGetResult = { ok: true, value: string | null } | { ok: false }
  async function sdkGet(key: string): Promise<SdkGetResult> {
    if (!_bridge) return { ok: false }
    try {
      const v = await withSdkTimeout(_bridge.getLocalStorage(key))
      return { ok: true, value: typeof v === 'string' && v.length > 0 ? v : null }
    } catch (e) {
      console.warn('[storage] sdkGet fail', key, e)
      return { ok: false }
    }
  }

  function safeGet(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  }
  function safeSet(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* quota */ }
    sdkSet(key, value)
  }
  function safeRemove(key: string): void {
    try { localStorage.removeItem(key) } catch { /* ignore */ }
    sdkRemove(key)
  }

  return {
    setBridge(b: EvenAppBridge): void {
      _bridge = b
    },
    async flush(): Promise<void> {
      for (let i = 0; i < 3; i++) {
        if (pendingSdkWrites.size === 0) return
        await Promise.all(Array.from(pendingSdkWrites))
      }
    },
    /**
     * - 読み取り失敗 (BLE hang timeout 含む) の key は browser 上書きも migrate もしない (安全側、現状維持)
     * - rehydrate 完了前の companion 操作窓で書かれた key (`preRehydrateDirty`) は SDK 側の値を無視し
     *   browser の最新値を優先、rehydrate 完了後にその値を SDK へアップロードする
     * - SDK 未設定 かつ 旧 browser 値が残っている key は一回きり SDK へアップロード (旧バージョンからの移行)
     */
    async rehydrate(): Promise<void> {
      const results = await Promise.all(opts.keys.map((k) => sdkGet(k).then((r) => [k, r] as const)))
      const migrate: Array<[string, string]> = []
      for (const [k, r] of results) {
        if (!r.ok) continue // B1: 読み取り失敗は現状維持 (browser 上書きも migrate もしない)
        if (preRehydrateDirty.has(k)) {
          const existing = safeGet(k)
          if (existing !== null) migrate.push([k, existing])
          continue
        }
        if (r.value !== null) {
          try { localStorage.setItem(k, r.value) } catch { /* ignore */ }
          lastSentToSdk.set(k, r.value) // dedup baseline: rehydrate 直後の再保存で同値なら送信しない
        } else {
          const existing = safeGet(k)
          if (existing !== null) migrate.push([k, existing])
        }
      }
      preRehydrateDirty.clear()
      _rehydrated = true // これ以降の sdkSet が実際に SDK へ届く
      for (const [k, v] of migrate) sdkSet(k, v)
    },
    get: safeGet,
    set: safeSet,
    remove: safeRemove,
  }
}
