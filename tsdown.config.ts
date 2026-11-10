import { defineConfig } from "tsdown"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: { generator: "oxc" },
  clean: true,
  platform: "neutral",
  target: "esnext",
  fixedExtension: true,
  sourcemap: true,
  deps: {
    neverBundle: ["bun:sqlite", /^node:/u],
    onlyBundle: ["type-fest", "tagged-tag"],
  },
})
