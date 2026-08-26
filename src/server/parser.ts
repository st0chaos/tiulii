import type { Parser } from "./shared.js";
import * as Markdown from "./md.js";

const parserRegistry: Partial<Record<string, Parser>> = {
  markdown: Markdown.parser,
};

export function getParser(language: string): Parser | undefined {
  return parserRegistry[language];
}
