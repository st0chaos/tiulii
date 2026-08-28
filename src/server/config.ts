import fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { SERVER_NAME } from "@tiulii/shared";
import { z } from "zod";

export const configSchema = z.object({
  port: z.int().default(0),
  css: z
    .string()
    .optional()
    .transform(async (path, ctx) => {
      if (!path || !userDirectory) return undefined;
      try {
        return await fs.readFile(join(userDirectory, path), "utf-8");
      } catch (err) {
        ctx.addIssue({
          code: "custom",
          message: `Failed to read file: ${err}`,
        });
        return z.NEVER;
      }
    }),
  katex: z.record(z.string(), z.any()).default({}),
});

type Config = z.infer<typeof configSchema>;

const possibleUserDirectories: (string | undefined)[] = [
  env[`${SERVER_NAME.toUpperCase()}_HOME`],
  env["XDG_CONFIG_NAME"]
    ? join(env["XDG_CONFIG_NAME"], SERVER_NAME)
    : undefined,
  env["HOME"] ? join(env["HOME"], ".config", SERVER_NAME) : undefined,
  join(homedir(), `.${SERVER_NAME}`),
];

const userDirectory: string | undefined = (
  await Promise.all(
    possibleUserDirectories
      .filter((path) => path !== undefined)
      .map(async (path) => {
        const stat = await fs.stat(path).catch(() => undefined);
        if (stat === undefined) return undefined;
        if (!stat.isDirectory()) return undefined;
        return path;
      }),
  )
).find((result) => result !== undefined);

async function parseConfig() {
  if (userDirectory === undefined) return await configSchema.parseAsync({});
  const path = join(userDirectory, "config.js");
  const module = await import(path);
  return await configSchema.parseAsync(module.default);
}

export const config: Config = await parseConfig();
