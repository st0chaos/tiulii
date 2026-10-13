import type { Parser } from './shared.js';
import * as Markdown from './md.js';
import * as RMD from './rmd.js';
import * as Org from './org.js';

const parserRegistry: Partial<Record<string, Parser>> = {
  markdown: Markdown.parser,
  rmd: RMD.parser,
  org: Org.parser,
};

export function getParser(language: string): Parser | undefined {
  return parserRegistry[language];
}
