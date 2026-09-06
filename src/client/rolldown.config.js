import { defineConfig } from "rolldown";

export default defineConfig({
  input: "index.ts",
  output: {
    format: "iife",
    minify: true,
    dir: "../server/dist",
  },
  transform: {
    target: "es2015",
  },
});
