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
} from "vscode-languageserver/node";
import { getParser } from "./parser.js";
import { type Parser } from "./shared.js";
import { TextDocument } from "vscode-languageserver-textdocument";
import assert from "node:assert";

interface Document {
  parser: Parser;
  html: string;
  fullSync?: FullSyncData;
}
interface FullSyncData {
  document: TextDocument;
  changeEvent$: Subject<ChangeEvent>;
  subscription: Subscription;
}
interface ChangeEvent {
  changes: TextDocumentContentChangeEvent[];
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

  async newDocument(uri: URI, language: string, text: string, version: number) {
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

    let ver = 0;
    const document = TextDocument.create(uri, language, ver, text);
    const changeEvent$ = new Subject<ChangeEvent>();
    const subscription = changeEvent$
      .pipe(
        bufferWhen(() => {
          const size = new TextEncoder().encode(document.getText()).length;
          if (size < 1024 * 1024 * 8) return timer(20);
          return timer((size / 1024 ** 2) * 25);
        }),
      )
      .subscribe(async (events) => {
        const changes = events.map((ev) => ev.changes).flat();
        if (changes.length === 0) return;
        ver++;
        TextDocument.update(document, changes, ver);
        this.documents$.next({
          ...this.documents$.value,
          [uri]: {
            ...this.documents$.value[uri]!,
            html: await parser.parse(document.getText(), uri, ver),
          },
        });
      });

    this.documents$.next({
      ...this.documents$.value,
      [uri]: {
        parser,
        html: await parser.parse(text, uri, ver),
        fullSync: { changeEvent$, document, subscription },
      },
    });
  }

  async updateDocument(
    changes: TextDocumentContentChangeEvent[],
    uri: URI,
    version: number,
  ) {
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
      fullSync.changeEvent$.next({ changes });
    }
  }

  closeDocument(uri: URI) {
    // Clear the document's URI before removing the document
    if (this.activeURI$.value === uri) {
      this.activeURI$.next(undefined);
    }

    const document = this.documents$.value[uri];
    if (document === undefined) return;
    document.fullSync?.subscription.unsubscribe();
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
