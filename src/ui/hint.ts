import type { Kv } from '../storage/index.ts'
import { GLASS } from './tokens.ts'

export type FirstRunHint = {
  /** 起動時に 1 回。保存済みの表示回数を読む (読む前は全画面 0 回扱い) */
  load(): Promise<void>
  shouldShow(screen: string): boolean
  /** 最初の操作でヒントを消したとき呼ぶ。1 回数える */
  seen(screen: string): Promise<void>
  /** スマホ側の「もう一度出す」 */
  resetAll(): Promise<void>
}

/** 画面ごとの表示回数を `<appKey>.hintCount` (JSON) に保存し、3 回まで出す。 */
export function createFirstRunHint(o: { kv: Pick<Kv, 'getLocalStorage' | 'setLocalStorage'>; appKey: string }): FirstRunHint {
  const key = `${o.appKey}.hintCount`
  let counts: Record<string, number> = {}
  const persist = async (): Promise<void> => {
    await o.kv.setLocalStorage(key, JSON.stringify(counts))
  }
  return {
    async load() {
      try {
        const raw = await o.kv.getLocalStorage(key)
        const parsed: unknown = raw ? JSON.parse(raw) : {}
        const next: Record<string, number> = {}
        if (parsed && typeof parsed === 'object') {
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'number' && Number.isFinite(v)) next[k] = v
          }
        }
        counts = next
      } catch {
        counts = {}
      }
    },
    shouldShow: (screen) => (counts[screen] ?? 0) < GLASS.TIMING.hintCount,
    async seen(screen) {
      const c = counts[screen] ?? 0
      if (c >= GLASS.TIMING.hintCount) return
      counts[screen] = c + 1
      await persist()
    },
    async resetAll() {
      counts = {}
      await persist()
    },
  }
}
