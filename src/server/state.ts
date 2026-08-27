import { fileURLToPath } from "node:url";
import {
  BehaviorSubject,
  bufferWhen,
  combineLatest,
  distinctUntilChanged,
  map,
  Subject,
  Subscription,
  timer,
} from "rxjs";
import {
  URI,
  TextDocumentContentChangeEvent,
  type DidOpenTextDocumentParams,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
} from "vscode-languageserver/node";
import { getParser } from "./parser.js";
import { type Parser } from "./shared.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import assert from "node:assert";

class FullSyncDocument {
  private version: number = 0;
  private document: TextDocument;
  private changes$: Subject<TextDocumentContentChangeEvent[]> = new Subject();

  constructor(
    uri: string,
    languageId: string,
    content: string,
    handler: (content: string, version: number) => void,
  ) {
    this.document = TextDocument.create(uri, languageId, this.version, content);
    this.changes$
      .pipe(
        bufferWhen(() => {
          const size = new TextEncoder().encode(this.document.getText()).length;
          if (size < 1024 * 1024 * 8) return timer(20);
          return timer((size / 1024 ** 2) * 30);
        }),
      )
      .subscribe(async (events) => {
        const changes = events.flat();
        if (changes.length === 0) return;
        this.version++;
        TextDocument.update(this.document, changes, this.version);
        handler(this.document.getText(), this.version);
      });
  }
  destroy() {
    this.changes$.complete();
  }
  update(change: TextDocumentContentChangeEvent[]) {
    this.changes$.next(change);
  }
}

interface Document {
  parser: Parser;
  html: string;
  fullSync?: FullSyncDocument;
}

class State {
  private documents$: BehaviorSubject<Record<URI, Document>>;
  private activeURI$: BehaviorSubject<string | undefined>;
  readonly activeHTML$: BehaviorSubject<string | undefined>;
  activeLine$: BehaviorSubject<number | undefined>;

  constructor() {
    this.documents$ = new BehaviorSubject({});
    this.activeURI$ = new BehaviorSubject<URI | undefined>(undefined);
    this.activeHTML$ = new BehaviorSubject<string | undefined>(undefined);
    this.activeLine$ = new BehaviorSubject<number | undefined>(undefined);

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

  async newDocument(params: DidOpenTextDocumentParams) {
    const { uri, languageId: language, text, version } = params.textDocument;
    if (this.documents$.value[uri]) return;

    if (this.activeURI$.value === undefined) {
      this.activeURI$.next(uri);
    }

    const parser = getParser(language);
    if (!parser) return;

    if (parser.update) {
      this.documents$.next({
        ...this.documents$.value,
        [uri]: { parser, html: await parser.parse(text, uri, version) },
      });
      return;
    }

    const fullSync = new FullSyncDocument(uri, language, text, async (text) => {
      const value = this.documents$.value;
      this.documents$.next({
        ...value,
        [uri]: {
          ...value[uri]!,
          html: await parser.parse(text, uri, version),
        },
      });
    });

    this.documents$.next({
      ...this.documents$.value,
      [uri]: {
        parser,
        fullSync,
        html: await parser.parse(text, uri, 0),
      },
    });
  }

  async updateDocument(params: DidChangeTextDocumentParams) {
    const {
      textDocument: { uri, version },
      contentChanges: changes,
    } = params;
    const current = this.documents$.value;
    if (current[uri] === undefined) return;
    const { parser, fullSync } = current[uri];
    if (parser.update) {
      this.documents$.next({
        ...current,
        [uri]: {
          parser,
          html: await parser.update(uri, version, changes),
        },
      });
    } else {
      assert(fullSync);
      fullSync.update(changes);
    }
  }

  closeDocument(params: DidCloseTextDocumentParams) {
    const {
      textDocument: { uri },
    } = params;
    // Clear the document's URI before removing the document
    if (this.activeURI$.value === uri) {
      this.activeURI$.next(undefined);
    }

    const document = this.documents$.value[uri];
    if (document === undefined) return;
    document.fullSync?.destroy();
    document.parser.close?.(uri);

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
