import type { TextDocumentContentChangeEvent } from "vscode-languageserver";

export interface Parser {
  parse(text: string, uri: string, version: number): string | Promise<string>;
  update?(
    uri: string,
    version: number,
    changes: TextDocumentContentChangeEvent[],
  ): string | Promise<string>;
  close?(uri: string): void;
}
