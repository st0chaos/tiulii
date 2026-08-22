import MarkdownIt from "markdown-it";
import { config } from "./config.js";
import type { TextDocumentContentChangeEvent } from "vscode-languageserver/node";
import markdownKaTeX from "./md-katex.js";
import hljs from "highlight.js";
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from "../shared.js";

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

  md.use((md) => {
    md.core.ruler.push("inject_line", function (state) {
      const tokens = state.tokens;
      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];
        if (token === undefined || !token.map) continue;
        const [beg, end] = token.map;
        token.attrPush([LINE_BEGIN_ATTR, beg]);
        token.attrPush([LINE_END_ATTR, end]);
      }
    });
  });

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
