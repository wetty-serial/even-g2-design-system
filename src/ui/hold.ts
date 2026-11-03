/**
 * 長押しの間、直前の上下を繰り返す。既存の自作アプリの長押し処理 (タイマー部分) を一般化したもの。
 *
 * 止まる条件 (離した合図に頼らず必ず止まる): `stop()` / 60 回 / 30 秒 / `step` が false (端) / `key` が start 時から変わった。
 * 最初の 1 歩は押してから 400ms 後 (押した瞬間は送らない)。
 * 向きの決め方 (直前の上下、無ければ next) と「本文の最終ページで next を送らない」はアプリ側の `step` が担う。
 */
import { GLASS } from './tokens.ts'

export type RepeatDir = 'prev' | 'next'

export type HoldRepeatOptions = {
  /** 1 歩ぶん進める。動けなかった (端) なら false。async でもよい */
  step: (dir: RepeatDir) => boolean | Promise<boolean>
  /** 以下はテスト用の上書き。既定は GLASS.TIMING */
  intervalMs?: number
  maxCount?: number
  timeoutMs?: number
  /**
   * 「今の画面と mode」を表す文字列。start 時の値と違う値になったら、次の 1 歩を送らずに止まる
   * (端で別画面へ移る遷移を越えて流れ続けない)。省略時は見ない
   */
  key?: () => string
}

export type HoldRepeat = {
  start(dir: RepeatDir): void
  stop(): void
}

export function createHoldRepeat(o: HoldRepeatOptions): HoldRepeat {
  const intervalMs = o.intervalMs ?? GLASS.TIMING.holdRepeat
  const maxCount = o.maxCount ?? GLASS.TIMING.holdRepeatMax
  const timeoutMs = o.timeoutMs ?? GLASS.TIMING.holdRepeatTimeout
  let timer: ReturnType<typeof setTimeout> | null = null
  let gen = 0

  const stop = (): void => {
    gen++
    if (timer !== null) clearTimeout(timer)
    timer = null
  }

  return {
    start(dir) {
      stop()
      const g = gen
      const startedAt = Date.now()
      const startKey = o.key?.()
      let sent = 0
      const schedule = (): void => {
        timer = setTimeout(() => void tick(), intervalMs)
      }
      const tick = async (): Promise<void> => {
        timer = null
        if (g !== gen) return
        if (sent >= maxCount || Date.now() - startedAt >= timeoutMs) return
        if (o.key && o.key() !== startKey) return
        const moved = await o.step(dir)
        sent += 1
        if (g !== gen || !moved) return
        schedule()
      }
      schedule()
    },
    stop,
  }
}
