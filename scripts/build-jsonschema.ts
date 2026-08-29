import { writeFile } from "node:fs/promises";
import { configSchema } from "../src/server/config";
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

await writeFile(values.output, JSON.stringify(schema), "utf-8");
