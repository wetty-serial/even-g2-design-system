import type { EventKind } from '../events/index.ts'
import { createScrollGate } from '../events/index.ts'
import { GLASS } from './tokens.ts'

export type InputPolicyOptions = {
  /** 上下反転の設定 (既定オフはアプリ側の設定値) */
  invert: () => boolean
  /** スワイプの間引き時間 (ms)。毎回呼ぶ。既定 GLASS.TIMING.swipeGate */
  swipeGateMs?: () => number
}

/** 捨てた理由。`tap-guard` = タップ以外の操作の直後のタップ / `swipe-gate` = 間引いたスワイプ */
export type DropReason = 'tap-guard' | 'swipe-gate'

export type InputPolicy = {
  /**
   * `events.classify` の kind を受け、標準の入力規則を通した kind を返す。捨てるなら null。
   * - 上下は 350ms 間引き (捨てた分も「操作」として扱う)
   * - タップ以外の操作の直後 200ms のタップを捨てる (タップの後のタップは捨てない)
   * - 反転オンなら up / down を入れ替える
   */
  accept(kind: EventKind, now: number): EventKind | null
  /** `accept` と同じ判定 (状態も共有)。捨てたときは理由も返す。通したときの `dropped` は null */
  acceptWithReason(kind: EventKind, now: number): { kind: EventKind | null; dropped: DropReason | null }
}

/**
 * タップ以外の操作 (これらの直後のタップが誤タップになる)。
 * `fg_enter` / `fg_exit` は OS メニューの開閉 (開くと enter、閉じると exit)。メニューを閉じる操作の直後のタップを捨てる
 */
const NON_TAP_OPERATIONS: ReadonlySet<EventKind> = new Set<EventKind>([
  'up',
  'down',
  'double',
  'hold',
  'release',
  'menu',
  'fg_enter',
  'fg_exit',
])

export function createInputPolicy(o: InputPolicyOptions): InputPolicy {
  const gate = createScrollGate(o.swipeGateMs ?? (() => GLASS.TIMING.swipeGate))
  let lastOperationAt = -Infinity
  const acceptWithReason: InputPolicy['acceptWithReason'] = (kind, now) => {
    if (kind === 'tap') {
      return now - lastOperationAt < GLASS.TIMING.tapGuard
        ? { kind: null, dropped: 'tap-guard' }
        : { kind: 'tap', dropped: null }
    }
    if (NON_TAP_OPERATIONS.has(kind)) lastOperationAt = now
    if (kind === 'up' || kind === 'down') {
      if (!gate.allow(now)) return { kind: null, dropped: 'swipe-gate' }
      if (o.invert()) return { kind: kind === 'up' ? 'down' : 'up', dropped: null }
    }
    return { kind, dropped: null }
  }
  return {
    accept: (kind, now) => acceptWithReason(kind, now).kind,
    acceptWithReason,
  }
}
