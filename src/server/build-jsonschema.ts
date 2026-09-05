import { configSchema } from "./config.ts";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";

const schema = configSchema.toJSONSchema({
  io: "input",
  target: "draft-2020-12",
});

const { values } = parseArgs({
  options: {
    output: { type: "string" },
  },
});

if (!values.output) {
  throw new Error("Missing required option: --output");
}

await mkdir(dirname(values.output), { recursive: true });

await writeFile(values.output, JSON.stringify(schema), "utf-8");
