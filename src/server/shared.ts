// import type { TextDocumentContentChangeEvent } from "vscode-languageserver";

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
