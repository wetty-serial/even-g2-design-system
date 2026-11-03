import { GLASS } from './tokens.ts'

export type RetryState = 'idle' | 'waiting' | 'running'

export type Retry = {
  /** 取得に失敗したとき呼ぶ。30 秒後に自動で run する (待機中なら何もしない) */
  fail(): void
  /** タップ。待機中なら即時に run する */
  tap(): void
  /** 画面を離れるとき。待機・実行結果の反映を捨てる */
  stop(): void
}

/**
 * エラーからの再試行 (失敗後 30 秒ごと + タップで即時)。
 * `run` は成功で true。false / throw なら 30 秒後にもう一度。
 * 状態 (waiting / running / idle) が変わるたびに onState。
 */
export function createRetry(o: {
  run: () => Promise<boolean>
  onState: (s: RetryState) => void
}): Retry {
  let state: RetryState = 'idle'
  let timer: ReturnType<typeof setTimeout> | null = null
  let gen = 0

  const set = (s: RetryState): void => {
    if (s === state) return
    state = s
    o.onState(s)
  }
  const clearTimer = (): void => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const schedule = (): void => {
    clearTimer()
    set('waiting')
    timer = setTimeout(() => void attempt(), GLASS.TIMING.retry)
  }
  const attempt = async (): Promise<void> => {
    clearTimer()
    const g = ++gen
    set('running')
    let ok = false
    try {
      ok = await o.run()
    } catch {
      ok = false
    }
    if (g !== gen) return
    if (ok) set('idle')
    else schedule()
  }

  return {
    fail() {
      if (state === 'idle') schedule()
    },
    tap() {
      if (state === 'waiting') void attempt()
    },
    stop() {
      gen++
      clearTimer()
      set('idle')
    },
  }
}
