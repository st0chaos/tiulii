import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
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
import { getParser } from "./parser.js";

class State {
  private documents$: BehaviorSubject<
    Record<URI, { language: string; html: string }>
  >;
  private activeDocumentURI$: BehaviorSubject<string | undefined>;
  readonly activeDocumentHTML$: BehaviorSubject<string | undefined>;

  constructor() {
    this.documents$ = new BehaviorSubject({});
    this.activeDocumentURI$ = new BehaviorSubject<URI | undefined>(undefined);
    this.activeDocumentHTML$ = new BehaviorSubject<string | undefined>(
      undefined,
    );

    combineLatest([this.documents$, this.activeDocumentURI$])
      .pipe(
        map(([documents, uri]) => {
          if (uri === undefined) return undefined;
          return documents[uri]?.html;
        }),
        distinctUntilChanged(),
      )
      .subscribe((html) => this.activeDocumentHTML$.next(html));
  }

  newDocument(uri: URI, language: string, text: string, version: number) {
    const parser = getParser(language);
    const current = this.documents$.value;
    this.documents$.next({
      ...current,
      [uri]: {
        language: language,
        html: parser.parse(text, version, uri, language),
      },
    });
    if (this.activeDocumentURI$.value === undefined) {
      this.activeDocumentURI$.next(uri);
    }
  }

  updateDocument(
    changes: TextDocumentContentChangeEvent[],
    uri: URI,
    version: number,
  ) {
    const current = this.documents$.value;
    assert(current[uri] !== undefined);
    const language = current[uri].language;
    this.documents$.next({
      ...current,
      [uri]: {
        language: language,
        html: getParser(language).update(changes, version, uri, language),
      },
    });
  }

  closeDocument(uri: URI) {
    // Clear the document's URI before removing the document
    if (this.activeDocumentURI$.value === uri) {
      this.activeDocumentURI$.next(undefined);
    }
    if (this.documents$.value[uri]) {
      const { [uri]: removed, ...rest } = this.documents$.value;
      this.documents$.next({ ...rest });
    }
  }

  activate(uri: URI) {
    if (this.documents$.value[uri]) {
      this.activeDocumentURI$.next(uri);
    }
  }

  get activeDocumentPath() {
    const uri = this.activeDocumentURI$.value;
    if (uri === undefined) return undefined;
    // The URI may be "file://"
    const path = fileURLToPath(uri);
    if (path === "/") return undefined;
    return path;
  }
}

export const state = new State();
