import { fileURLToPath } from "node:url";
import {
  BehaviorSubject,
  combineLatest,
  distinctUntilChanged,
  map,
} from "rxjs";
import {
  URI,
  TextDocumentContentChangeEvent,
} from "vscode-languageserver/node";
import { getParser, type Parser } from "./parser.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import assert from "node:assert";

interface Document {
  parser: Parser;
  html: string;
  textDocument?: TextDocument;
}

class State {
  private documents$: BehaviorSubject<Record<URI, Document>>;
  private activeURI$: BehaviorSubject<string | undefined>;
  readonly activeHTML$: BehaviorSubject<string | undefined>;

  constructor() {
    this.documents$ = new BehaviorSubject({});
    this.activeURI$ = new BehaviorSubject<URI | undefined>(undefined);
    this.activeHTML$ = new BehaviorSubject<string | undefined>(undefined);

    combineLatest([this.documents$, this.activeURI$])
      .pipe(
        map(([documents, uri]) => {
          if (uri === undefined) return undefined;
          return documents[uri]?.html;
        }),
        distinctUntilChanged(),
      )
      .subscribe((html) => this.activeHTML$.next(html));
  }

  newDocument(uri: URI, language: string, text: string, version: number) {
    const current = this.documents$.value;
    const parser = getParser(language);
    if (!parser) return;
    if (!parser.update) {
      this.documents$.next({
        ...current,
        [uri]: {
          parser,
          html: parser.parse(text, uri, version),
          textDocument: TextDocument.create(uri, language, version, text),
        },
      });
    } else {
      this.documents$.next({
        ...current,
        [uri]: {
          parser,
          html: parser.parse(text, uri, version),
        },
      });
    }
    if (this.activeURI$.value === undefined) {
      this.activeURI$.next(uri);
    }
  }

  updateDocument(
    changes: TextDocumentContentChangeEvent[],
    uri: URI,
    version: number,
  ) {
    const current = this.documents$.value;
    if (current[uri] === undefined) return;
    const { parser, textDocument: document } = current[uri];
    if (parser.update) {
      this.documents$.next({
        ...current,
        [uri]: {
          parser,
          html: parser.update(uri, version, changes),
        },
      });
    } else {
      assert(document);
      TextDocument.update(document, changes, version);
      this.documents$.next({
        ...current,
        [uri]: {
          parser,
          textDocument: document,
          html: parser.parse(document.getText(), uri, version),
        },
      });
    }
  }

  closeDocument(uri: URI) {
    // Clear the document's URI before removing the document
    if (this.activeURI$.value === uri) {
      this.activeURI$.next(undefined);
    }

    const x = this.documents$.value[uri];
    if (x === undefined) return;
    x.parser.close?.(uri);

    const { [uri]: _, ...rest } = this.documents$.value;
    this.documents$.next({ ...rest });
  }

  activateURI(uri: URI) {
    if (this.documents$.value[uri]) {
      this.activeURI$.next(uri);
    }
  }

  get activePath() {
    const uri = this.activeURI$.value;
    if (uri === undefined) return undefined;
    // The URI may be "file://"
    const path = fileURLToPath(uri);
    if (path === "/") return undefined;
    return path;
  }
}

export const state = new State();
