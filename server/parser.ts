import MarkdownIt from "markdown-it";
import { config } from "./config.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { TextDocumentContentChangeEvent } from "vscode-languageserver/node";
import assert from "node:assert/strict";
import mdPluginKaTeX from "./md-katex.js";

interface Parser {
  parse(text: string, version: number, uri: string, language: string): string;
  update(
    changes: TextDocumentContentChangeEvent[],
    version: number,
    uri: string,
    language: string,
  ): string;
  close(uri: string, language: string): void;
}

namespace MarkdownParser {
  const md = new MarkdownIt();
  md.use(mdPluginKaTeX, config.katex);

  const documentMap = new Map<string, TextDocument>();

  export const parser: Parser = {
    parse(text, version, uri, language) {
      const document = TextDocument.create(uri, language, version, text);
      documentMap.set(uri, document);
      return md.render(text);
    },
    update(changes, version, uri, _language) {
      const document = documentMap.get(uri);
      assert(document);
      TextDocument.update(document, changes, version);
      return md.render(document.getText());
    },
    close(uri, _language) {
      documentMap.delete(uri);
    },
  };
}

namespace DefaultParser {
  const documentMap = new Map<string, TextDocument>();

  export const parser: Parser = {
    parse(text, version, uri, language) {
      const document = TextDocument.create(uri, language, version, text);
      documentMap.set(uri, document);
      return `<pre>${document.getText()}</pre>`;
    },
    update(changes, version, uri, _language) {
      const document = documentMap.get(uri);
      assert(document);
      TextDocument.update(document, changes, version);
      return `<pre>${document.getText()}</pre>`;
    },
    close(uri, _language) {
      documentMap.delete(uri);
    },
  };
}

const parserRegistry: Partial<Record<string, Parser>> = {
  markdown: MarkdownParser.parser,
};

export function getParser(language: string): Parser {
  return parserRegistry[language] || DefaultParser.parser;
}
