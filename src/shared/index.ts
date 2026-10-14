import { z } from 'zod';

export const configSchema = z
  .object({
    port: z
      .int()
      .min(0)
      .max(65535)
      .default(0)
      .describe('Port on which the HTTP server listens.'),
    cssFile: z
      .string()
      .optional()
      .describe('Path to the custom CSS file relative to the user directory.'),
    debounceTime: z.number().min(0).default(300)
      .describe(`The specific period of time (in millisecond)
during which no editing to the document will trigger rendering.`),
    markdown: z
      .object({
        table: z
          .boolean()
          .default(true)
          .describe('Whether to enable table support.'),
        strikethrough: z
          .boolean()
          .default(true)
          .describe('Whether to enable strikethrough text formatting.'),
        math: z
          .boolean()
          .default(true)
          .describe('Whether to enable math rendering.'),
        highlight: z
          .boolean()
          .default(true)
          .describe('Whether to enable text highlighting.'),
        frontMatter: z
          .boolean()
          .default(true)
          .describe('Whether to parse front matter.'),
        attribute: z
          .boolean()
          .default(false)
          .describe('Whether to parse attributes in curly brackets.'),
        mermaid: z
          .boolean()
          .default(true)
          .describe('Whether to enable mermaid fenced code block.'),
      })
      .prefault({})
      .describe('Configuration options for Markdown extensions.'),
    rmarkdown: z
      .object({
        attribute: z
          .boolean()
          .default(false)
          .describe('Whether to parse attributes in curly brackets.'),
        mermaid: z
          .boolean()
          .default(false)
          .describe('Whether to enable mermaid fenced code block.'),
      })
      .prefault({})
      .describe('Configuration options for R Markdown.'),
    scroll: z
      .object({
        threshold: z
          .int()
          .default(20)
          .describe(
            `Threshold for enabling proportional scrolling.
If the number of lines exceeds this value,
it will scroll to the proportional position of the current line within the total line height.`
          ),
        top: z
          .number()
          .default(0.1)
          .describe(
            'Height between the top of viewport and the beginning of the block at cursor.'
          ),
      })
      .prefault({})
      .describe('Configuration options for synchronized scrolling.'),
    shiki: z
      .object({
        theme: z
          .string()
          .default('min-light')
          .describe(
            'Theme for highlighting. See <https://shiki.style/themes>.'
          ),
      })
      .prefault({})
      .describe('Configuration options for Shiki.'),
    katex: z
      .record(z.string(), z.any())
      .default({})
      .describe(
        'KaTeX configuration options. See <https://katex.org/docs/options>.'
      ),
    mermaid: z
      .object({
        class: z
          .string()
          .trim()
          .min(1)
          .optional()
          .transform((value) => value ?? `${SERVER_NAME}-mermaid`)
          .describe('HTML class name for mermaid elements.'),
        options: z
          .record(z.string(), z.any())
          .default({})
          .describe(
            'Additional Mermaid configuration options. See <https://mermaid.ai/open-source/config/schema-docs/config.html>.'
          ),
      })
      .prefault({})
      .describe('Mermaid configuration options.'),
  })
  .describe('Configuration options for `Tiulii`.');

export type Config = z.infer<typeof configSchema>;

export const INIT_URL = '/api/init';

export const SSE_URL = '/api/sse';

export const SERVER_NAME = 'tiulii';

export const LINE_BEGIN_ATTR = 'src-line-begin';

export const LINE_END_ATTR = 'src-line-end';

export interface InitalizationParams {
  config: Config;
  customCSS?: string | undefined;
}

interface ServerMessageRender {
  method: 'render';
  html: string;
}

interface ServerMessageScroll {
  method: 'scroll';
  line: number;
  maxLine: number;
}

export type ServerMessage = ServerMessageRender | ServerMessageScroll;

export type ServerMessageByMethod<M extends ServerMessage['method']> = Extract<
  ServerMessage,
  { method: M }
>;

export type ServerMessageRegistry = {
  [M in ServerMessage['method']]: (message: ServerMessageByMethod<M>) => void;
};
