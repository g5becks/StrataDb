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
    neverBundle: ["bun:sqlite", /^node:/],
    onlyBundle: ["type-fest", "tagged-tag"],
  },
})
