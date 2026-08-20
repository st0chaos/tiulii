import fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { serverName } from "./base.js";
import { z } from "zod";

const ConfigSchema = z.object({
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
  katex: z
    .record(z.string(), z.any())
    .default({})
    // To make things like \gdef work, ensure the "macros" property exists
    .transform(
      (katex) => ({ ...{ macros: {} }, ...katex }) as Record<string, any>,
    ),
});

type Config = z.infer<typeof ConfigSchema>;

const possibleUserDirectories: (string | undefined)[] = [
  env[`${serverName.toUpperCase()}_HOME`],
  env["XDG_CONFIG_NAME"] ? join(env["XDG_CONFIG_NAME"], serverName) : undefined,
  env["HOME"] ? join(env["HOME"], `.config/${serverName}`) : undefined,
  join(homedir(), `.${serverName}`),
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
  if (userDirectory === undefined) return await ConfigSchema.parseAsync({});
  const path = join(userDirectory, "config.js");
  const module = await import(path);
  return await ConfigSchema.parseAsync(module);
}

export const config: Config = await parseConfig();
