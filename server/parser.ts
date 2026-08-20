import MarkdownIt from "markdown-it";
import markdownKaTeX from "@vscode/markdown-it-katex";
import { config } from "./config.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import type { TextDocumentContentChangeEvent } from "vscode-languageserver/node";
import assert from "node:assert/strict";

interface Parser {
  parse(text: string, uri: string, language: string, version: number): string;
  update(
    changes: TextDocumentContentChangeEvent[],
    uri: string,
    language: string,
    version: number,
  ): string;
  close(uri: string, language: string): void;
}

namespace MarkdownParser {
  const markdownIt = new MarkdownIt();
  markdownIt.use(markdownKaTeX.default, config.katex);

  const documentMap = new Map<string, TextDocument>();

  export const parser: Parser = {
    parse(text, uri, language, version) {
      const document = TextDocument.create(uri, language, version, text);
      documentMap.set(uri, document);
      return markdownIt.render(text);
    },
    update(changes, uri, _, version) {
      const document = documentMap.get(uri);
      assert(document);
      TextDocument.update(document, changes, version);
      return markdownIt.render(document.getText());
    },
    close(uri, _) {
      documentMap.delete(uri);
    },
  };
}

namespace DefaultParser {
  const documentMap = new Map<string, TextDocument>();

  export const parser: Parser = {
    parse(text, uri, language, version) {
      const document = TextDocument.create(uri, language, version, text);
      documentMap.set(uri, document);
      return `<pre>${document.getText()}</pre>`;
    },
    update(changes, uri, _, version) {
      const document = documentMap.get(uri);
      assert(document);
      TextDocument.update(document, changes, version);
      return `<pre>${document.getText()}</pre>`;
    },
    close(uri, _) {
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
