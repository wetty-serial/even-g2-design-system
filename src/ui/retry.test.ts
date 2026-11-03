import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRetry, type RetryState } from './retry.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createRetry', () => {
  it('失敗の 30 秒後に run し、失敗なら 30 秒ごとに繰り返す', async () => {
    const run = vi.fn(async () => false)
    const r = createRetry({ run, onState: () => {} })
    r.fail()
    await vi.advanceTimersByTimeAsync(29_999)
    expect(run).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(run).toHaveBeenCalledTimes(2)
    r.stop()
  })

  it('成功したら止まる', async () => {
    const states: RetryState[] = []
    const run = vi.fn(async () => true)
    const r = createRetry({ run, onState: (s) => states.push(s) })
    r.fail()
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(90_000)
    expect(run).toHaveBeenCalledTimes(1)
    expect(states).toEqual(['waiting', 'running', 'idle'])
  })

  it('タップで即時に run し、待機タイマーは捨てる', async () => {
    const run = vi.fn(async () => true)
    const r = createRetry({ run, onState: () => {} })
    r.fail()
    await vi.advanceTimersByTimeAsync(5000)
    r.tap()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(60_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('idle のタップは何もしない / throw は失敗扱い', async () => {
    const run = vi.fn(async () => { throw new Error('x') })
    const r = createRetry({ run, onState: () => {} })
    r.tap()
    expect(run).toHaveBeenCalledTimes(0)
    r.fail()
    r.tap()
    await vi.advanceTimersByTimeAsync(0)
    expect(run).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(30_000)
    expect(run).toHaveBeenCalledTimes(2)
    r.stop()
  })

  it('stop で全部止まる', async () => {
    const run = vi.fn(async () => false)
    const r = createRetry({ run, onState: () => {} })
    r.fail()
    r.stop()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(run).toHaveBeenCalledTimes(0)
  })
})
