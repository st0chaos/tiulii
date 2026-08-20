import * as esbuild from "esbuild";
import { cpSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { staticDirectory, entryScript } from "#root/server/base.ts";

const runtimeDir = "./dist";
const staticDir = join(runtimeDir, staticDirectory);

rmSync(runtimeDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: ["./server/index.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: join(runtimeDir, "cli.mjs"),
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});

await esbuild.build({
  entryPoints: ["./client/main.ts"],
  bundle: true,
  platform: "browser",
  target: ["chrome58", "firefox57", "safari11", "edge16"],
  format: "iife",
  outfile: join(staticDir, entryScript),
  minify: true,
  sourcemap: true,
});

if (existsSync("public")) {
  cpSync("public", staticDir, {
    recursive: true,
  });
}
