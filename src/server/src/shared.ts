// import type { TextDocumentContentChangeEvent } from "vscode-languageserver";

import type { Env } from 'markdown-it';

export interface Replacement {
  placeholder: string;
  content: string;
}

export interface ParseResult {
  html: string;
  replacements: Promise<Replacement>[];
}

export interface Parser {
  parse(text: string, uri: string): ParseResult;
  // close?(uri: string): void;
}

export interface MarkdownParsingEnv extends Env {
  replacements: Promise<Replacement>[];
}
export namespace MarkdownParsingEnv {
  export function is(env: Env): env is MarkdownParsingEnv {
    return 'replacements' in env;
  }
}

export async function waitParseResult(result: ParseResult) {
  const rep = await Promise.all(result.replacements);
  return rep.reduce(
    (acc, curr) => acc.replaceAll(curr.placeholder, curr.content),
    result.html
  );
}

// export interface IncrementalParser extends Parser {
//   update(
//     uri: string,
//     changes: TextDocumentContentChangeEvent[],
//     version: number,
//   ): string;
// }
// export namespace IncrementalParser {
//   export function is(parser: Parser): parser is IncrementalParser {
//     return "update" in parser;
//   }
// }
