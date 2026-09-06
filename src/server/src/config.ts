import fs from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { env } from "node:process";
import { SERVER_NAME, configSchema } from "@tiulii/shared";

const possibleUserDirectories: (string | undefined)[] = [
  env[`${SERVER_NAME.toUpperCase()}_HOME`],
  env["XDG_CONFIG_NAME"]
    ? join(env["XDG_CONFIG_NAME"], SERVER_NAME)
    : undefined,
  join(homedir(), ".config", SERVER_NAME),
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

export const config = configSchema.parse(
  userDirectory === undefined
    ? {}
    : (await import(join(userDirectory, "config.js"))).default,
);

export const cssFileContent = await (async () => {
  const path = config.cssFile;
  if (!userDirectory || !path) return undefined;
  return await fs.readFile(join(userDirectory, path), "utf-8");
})();
