import type { Parser } from './shared.js';
import * as Markdown from './md.js';
import * as RMD from './rmd.js';

const parserRegistry: Partial<Record<string, Parser>> = {
  markdown: Markdown.parser,
  rmd: RMD.parser,
};

export function getParser(language: string): Parser | undefined {
  return parserRegistry[language];
}
