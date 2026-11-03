import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createToast } from './toast.ts'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('createToast', () => {
  it('show で出て 1.5 秒で消える (onChange は両方で呼ぶ)', () => {
    const onChange = vi.fn()
    const t = createToast({ onChange })
    expect(t.current()).toBeNull()
    t.show('これ以上ありません')
    expect(t.current()).toBe('これ以上ありません')
    expect(onChange).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1499)
    expect(t.current()).toBe('これ以上ありません')
    vi.advanceTimersByTime(1)
    expect(t.current()).toBeNull()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('続けて show すると寿命は後の show から数える', () => {
    const t = createToast({ onChange: () => {} })
    t.show('a')
    vi.advanceTimersByTime(1000)
    t.show('b')
    vi.advanceTimersByTime(1000)
    expect(t.current()).toBe('b')
    vi.advanceTimersByTime(500)
    expect(t.current()).toBeNull()
  })
})
