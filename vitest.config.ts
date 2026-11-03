import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // 既定は node。DOM が要るテストはファイル冒頭に `// @vitest-environment happy-dom` を書く
    environment: 'node',
    passWithNoTests: true,
  },
})
