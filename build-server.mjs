import * as esbuild from "esbuild";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { SERVER_NAME } from "@tiulii/shared";

const outDir = "dist";

await rm(outDir, { recursive: true, force: true });

await esbuild.build({
  entryPoints: [join("src", "server", "main.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  banner: {
    js: `import { createRequire } from 'module';\nconst require = createRequire(import.meta.url);`,
  },
  outfile: join(outDir, SERVER_NAME),
});
