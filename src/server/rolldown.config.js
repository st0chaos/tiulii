import { defineConfig } from "rolldown";
import path from "node:path";

export default defineConfig({
  input: "src/cli.ts",
  output: {
    format: "esm",
  },
  transform: {
    target: "node18",
  },
  external: (id) =>
    !id.startsWith("@tiulii") && !id.startsWith(".") && !path.isAbsolute(id),
});
