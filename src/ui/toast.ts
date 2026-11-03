import { GLASS } from './tokens.ts'

export type Toast = {
  /** header の文字を差し替える一時通知。1.5 秒で消えて onChange */
  show(text: string): void
  current(): string | null
}

export function createToast(o: { onChange: () => void }): Toast {
  let text: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    show(t) {
      if (timer !== null) clearTimeout(timer)
      text = t
      o.onChange()
      timer = setTimeout(() => {
        timer = null
        text = null
        o.onChange()
      }, GLASS.TIMING.toast)
    },
    current: () => text,
  }
}
