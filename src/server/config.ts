import fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { SERVER_NAME } from "@tiulii/shared";
import { z } from "zod";

export const markdownConfigSchema = z
  .object({
    table: z
      .boolean()
      .default(true)
      .describe("Whether to enable table support."),
    strikethrough: z
      .boolean()
      .default(false)
      .describe("Whether to enable strikethrough text formatting."),
    math: z
      .boolean()
      .default(false)
      .describe("Whether to enable math rendering."),
    highlight: z
      .boolean()
      .default(false)
      .describe("Whether to enable text highlighting."),
    frontMatter: z
      .boolean()
      .default(true)
      .describe("Whether to parse front matter."),
    attribute: z
      .boolean()
      .default(false)
      .describe("Whether to parse attributes in curly brackets."),
  })
  .prefault({})
  .describe("Configuration options for Markdown extensions.");

export const shikiConfigSchema = z
  .object({
    theme: z
      .string()
      .default("min-light")
      .describe("Theme for highlighting. See <https://shiki.style/themes>."),
  })
  .prefault({})
  .describe("Configuration options for Shiki.");

export const configSchema = z
  .object({
    port: z
      .int()
      .min(0)
      .max(65535)
      .default(0)
      .describe("Port on which the HTTP server listens."),
    cssFile: z
      .string()
      .transform(async (path, ctx) => {
        if (!userDirectory) return undefined;
        try {
          return await fs.readFile(join(userDirectory, path), "utf-8");
        } catch (err) {
          ctx.addIssue({
            code: "custom",
            message: `Failed to read file: ${err}`,
          });
          return z.NEVER;
        }
      })
      .optional()
      .describe("Path to the custom CSS file relative to the user directory."),
    markdown: markdownConfigSchema,
    shiki: shikiConfigSchema,
    katex: z
      .record(z.string(), z.any())
      .default({})
      .describe(
        "KaTeX configuration options. See <https://katex.org/docs/options>.",
      ),
  })
  .describe("Configuration options for tiulii.");

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
