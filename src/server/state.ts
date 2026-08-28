import {
  BehaviorSubject,
  bufferWhen,
  combineLatest,
  concatMap,
  debounceTime,
  distinctUntilChanged,
  endWith,
  filter,
  concat,
  from,
  map,
  mergeAll,
  mergeMap,
  shareReplay,
  startWith,
  Subject,
  takeUntil,
  timer,
  Observable,
  EMPTY,
} from "rxjs";
import {
  type DidOpenTextDocumentParams,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getParser } from "./parser.js";
import type { Parser } from "./shared.js";

export const open$ = new Subject<DidOpenTextDocumentParams>();
export const close$ = new Subject<DidCloseTextDocumentParams>();
export const change$ = new Subject<DidChangeTextDocumentParams>();

function parseIntoStream(
  parser: Parser,
  content: string,
  uri: string,
): Observable<string> {
  const { html, tasks } = parser.parse(content, uri);
  return from(tasks).pipe(
    mergeAll(),
    map(({ placeholder, content }) => html.replaceAll(placeholder, content)),
    startWith(html),
  );
}

const updates$ = open$.pipe(
  mergeMap((openParams) => {
    const { uri, languageId, text } = openParams.textDocument;
    let version = 0;
    const textDocument = TextDocument.create(uri, languageId, version, text);

    const parser = getParser(languageId);
    if (!parser) return EMPTY;

    const closeThis$ = close$.pipe(
      filter((params) => params.textDocument.uri === uri),
    );

    const initialUpdates$ = parseIntoStream(parser, text, uri).pipe(
      map((html) => ({ uri: uri, html: html })),
    );

    const changeUpdates$ = change$
      .pipe(
        filter((params) => params.textDocument.uri === uri),
        map((params) => params.contentChanges),
        bufferWhen(() => {
          const size = new TextEncoder().encode(textDocument.getText()).length;
          if (size < 1024 * 1024 * 8) return timer(20);
          return timer((size / 1024 ** 2) * 30);
        }),
        map((collection) => collection.flat()),
        filter((changes) => changes.length !== 0),
        map((changes) => {
          TextDocument.update(textDocument, changes, version);
          version++;
          return textDocument.getText();
        }),
        concatMap((txt) => parseIntoStream(parser, txt, uri)),
        map((html) => ({ uri: uri, html: html })),
        takeUntil(closeThis$),
      )
      .pipe(endWith({ uri: uri, html: undefined }));

    return concat(initialUpdates$, changeUpdates$);
  }),
);

const docs$ = new BehaviorSubject<Record<string, string>>({});
const uri$ = new BehaviorSubject<string | undefined>(undefined);

updates$.subscribe(({ uri, html }) => {
  if (html === undefined) {
    const { [uri]: _, ...rest } = docs$.value;
    docs$.next({ ...rest });
    if (uri$.value === uri) {
      uri$.next(undefined);
    }
    return;
  }

  docs$.next({ ...docs$.value, [uri]: html });
  if (uri$.value === undefined) {
    uri$.next(uri);
  }
});

export function setActiveURI(uri: string) {
  if (docs$.value[uri]) {
    uri$.next(uri);
  }
}

export function getActiveURI() {
  return uri$.value;
}

export const currentLine$ = new BehaviorSubject<number | undefined>(undefined);

export const currentHTML$ = combineLatest([docs$, uri$]).pipe(
  debounceTime(100),
  map(([docs, uri]) => (uri ? docs[uri] : undefined)),
  distinctUntilChanged(),
  shareReplay(1),
);
