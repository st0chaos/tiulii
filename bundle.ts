import path from "node:path";
import { build } from "rolldown";

await build([
  {
    input: "./src/client/index.ts",
    output: {
      format: "iife",
      minify: true,
    },
    transform: {
      target: "es2015",
    },
  },
  {
    input: "./src/server/cli.ts",
    output: {
      format: "esm",
    },
    transform: {
      target: "node18",
    },
    external: (id) =>
      !id.startsWith("@tiulii") && !id.startsWith(".") && !path.isAbsolute(id),
  },
]);
