import MarkdownIt from "markdown-it";
import { config } from "./config.js";
import type { TextDocumentContentChangeEvent } from "vscode-languageserver/node";
import markdownKaTeX from "./md-katex.js";
import hljs from "highlight.js";

export interface Parser {
  parse(text: string, uri: string, version: number): string;
  update?(
    uri: string,
    version: number,
    changes: TextDocumentContentChangeEvent[],
  ): string;
  close?(uri: string): void;
}

namespace MarkdownParser {
  const md = new MarkdownIt({
    highlight(str, lang, _attrs) {
      if (hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(str, { language: lang }).value;
        } catch (err) {
          return `Error: ${err}`;
        }
      }
      return "";
    },
  });
  md.use(markdownKaTeX, config.katex);

  export const parser: Parser = {
    parse(text) {
      return md.render(text);
    },
  };
}

const parserRegistry: Partial<Record<string, Parser>> = {
  markdown: MarkdownParser.parser,
};

export function getParser(language: string): Parser | undefined {
  return parserRegistry[language];
}
