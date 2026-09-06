import { z } from "zod";

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
      .optional()
      .describe("Path to the custom CSS file relative to the user directory."),
    markdown: z
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
      .describe("Configuration options for Markdown extensions."),
    shiki: z
      .object({
        theme: z
          .string()
          .default("min-light")
          .describe(
            "Theme for highlighting. See <https://shiki.style/themes>.",
          ),
      })
      .prefault({})
      .describe("Configuration options for Shiki."),
    katex: z
      .record(z.string(), z.any())
      .default({})
      .describe(
        "KaTeX configuration options. See <https://katex.org/docs/options>.",
      ),
  })
  .describe("Configuration options for tiulii.");

export type Config = z.infer<typeof configSchema>;

export const INIT_URL = "/api/init";

export const SSE_URL = "/api/sse";

export const SERVER_NAME = "tiulii";

export const LINE_BEGIN_ATTR = "src-line-begin";

export const LINE_END_ATTR = "src-line-end";

export interface InitalizationParams {
  config: Config;
  customCSS?: string | undefined;
}

interface ServerMessageRender {
  method: "render";
  html: string;
}

interface ServerMessageScroll {
  method: "scroll";
  line: number;
}

export type ServerMessage = ServerMessageRender | ServerMessageScroll;

export type ServerMessageByMethod<M extends ServerMessage["method"]> = Extract<
  ServerMessage,
  { method: M }
>;

export type ServerMessageRegistry = {
  [M in ServerMessage["method"]]: (message: ServerMessageByMethod<M>) => void;
};
