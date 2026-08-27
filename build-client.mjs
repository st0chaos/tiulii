import * as esbuild from "esbuild";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const result = await esbuild.build({
  entryPoints: [join("src", "client", "index.ts")],
  bundle: true,
  platform: "browser",
  target: ["chrome58", "firefox57", "safari11", "edge16"],
  format: "iife",
  minify: true,
  write: false,
});

const code = result.outputFiles[0].text;

await writeFile(
  join("src", "server", "client.bundle.ts"),
  `export default ${JSON.stringify(code)}`,
);
