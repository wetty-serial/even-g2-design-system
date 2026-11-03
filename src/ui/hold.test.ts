import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHoldRepeat } from './hold.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createHoldRepeat', () => {
  it('押した瞬間は送らず、400ms ごとに送る', async () => {
    const step = vi.fn(() => true)
    const h = createHoldRepeat({ step })
    h.start('next')
    expect(step).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(399)
    expect(step).toHaveBeenCalledTimes(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(step).toHaveBeenCalledTimes(1)
    expect(step).toHaveBeenLastCalledWith('next')
    await vi.advanceTimersByTimeAsync(800)
    expect(step).toHaveBeenCalledTimes(3)
    h.stop()
  })

  it('60 回で止まる', async () => {
    const step = vi.fn(() => true)
    createHoldRepeat({ step }).start('prev')
    await vi.advanceTimersByTimeAsync(400 * 100)
    expect(step).toHaveBeenCalledTimes(60)
  })

  it('30 秒で止まる (回数上限を外して確認)', async () => {
    const step = vi.fn(() => true)
    createHoldRepeat({ step, maxCount: 10_000 }).start('next')
    await vi.advanceTimersByTimeAsync(60_000)
    expect(step).toHaveBeenCalledTimes(74) // 400ms * 74 = 29600。75 回目 (30000) は打ち切り
  })

  it('step が false (端) で止まる', async () => {
    let n = 0
    const step = vi.fn(() => ++n < 3)
    createHoldRepeat({ step }).start('next')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(step).toHaveBeenCalledTimes(3)
  })

  it('stop() で止まる / async step の途中で stop しても続かない', async () => {
    const step = vi.fn(async () => true)
    const h = createHoldRepeat({ step })
    h.start('next')
    await vi.advanceTimersByTimeAsync(400)
    h.stop()
    await vi.advanceTimersByTimeAsync(5000)
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('key が start 時と変わったら、次の 1 歩を送らずに止まる', async () => {
    let screen = 'detail'
    const step = vi.fn(() => true)
    const h = createHoldRepeat({ step, key: () => screen })
    h.start('next')
    await vi.advanceTimersByTimeAsync(800)
    expect(step).toHaveBeenCalledTimes(2)
    screen = 'home' // 端で別画面へ移った
    await vi.advanceTimersByTimeAsync(5000)
    expect(step).toHaveBeenCalledTimes(2)
  })

  it('key が変わらない間は続く / key 省略時は従来どおり', async () => {
    const step = vi.fn(() => true)
    createHoldRepeat({ step, key: () => 'detail:a' }).start('next')
    await vi.advanceTimersByTimeAsync(2000)
    expect(step).toHaveBeenCalledTimes(5)
  })

  it('start 後に key が変わっても、start し直せば新しい key で続く', async () => {
    let screen = 'a'
    const step = vi.fn(() => true)
    const h = createHoldRepeat({ step, key: () => screen })
    h.start('next')
    screen = 'b'
    h.start('next')
    await vi.advanceTimersByTimeAsync(800)
    expect(step).toHaveBeenCalledTimes(2)
    h.stop()
  })

  it('start し直すと前の繰り返しは捨てて数え直す', async () => {
    const step = vi.fn(() => true)
    const h = createHoldRepeat({ step })
    h.start('next')
    await vi.advanceTimersByTimeAsync(300)
    h.start('prev')
    await vi.advanceTimersByTimeAsync(400)
    expect(step).toHaveBeenCalledTimes(1)
    expect(step).toHaveBeenLastCalledWith('prev')
    h.stop()
  })
})
