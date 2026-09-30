import {
  BehaviorSubject,
  bufferWhen,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  endWith,
  filter,
  concat,
  from,
  map,
  mergeMap,
  shareReplay,
  startWith,
  Subject,
  takeUntil,
  timer,
  Observable,
  EMPTY,
  switchMap,
  scan,
  merge,
} from "rxjs";
import {
  type DidOpenTextDocumentParams,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getParser } from "./parser.js";
import type { Parser } from "./shared.js";

export interface DidMoveCursorParams {
  line: number;
  uri: string;
}

export const open$ = new Subject<DidOpenTextDocumentParams>();
export const close$ = new Subject<DidCloseTextDocumentParams>();
export const change$ = new Subject<DidChangeTextDocumentParams>();
export const cursor$ = new Subject<DidMoveCursorParams>();

function parseIntoStream(
  parser: Parser,
  content: string,
  uri: string,
): Observable<string> {
  const { html: initialHtml, replacements } = parser.parse(content, uri);
  return from(replacements).pipe(
    mergeMap((prms) => from(prms)),
    scan(
      (currentHtml, { placeholder, content }) =>
        currentHtml.replaceAll(placeholder, content),
      initialHtml,
    ),
    startWith(initialHtml),
  );
}

interface UpdateHTMLEvent {
  kind: "html";
  uri: string;
  html: string | undefined;
}
interface UpdateLineEvent {
  kind: "line";
  uri: string;
  line: number;
}
type UpdateEvent = UpdateHTMLEvent | UpdateLineEvent;

const updates$: Observable<UpdateEvent> = open$.pipe(
  mergeMap((openParams) => {
    const { uri, languageId, text } = openParams.textDocument;
    let version = 0;
    const textDocument = TextDocument.create(uri, languageId, version, text);

    const parser = getParser(languageId);
    if (!parser) return EMPTY;

    const closeThis$ = close$.pipe(
      filter((params) => params.textDocument.uri === uri),
    );

    const initialHtmlUpdates$: Observable<UpdateHTMLEvent> = parseIntoStream(parser, text, uri).pipe(
      map((html) => ({ kind: "html", uri: uri, html: html })),
    );

    const followingHtmlUpdates$: Observable<UpdateHTMLEvent> = change$
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
        switchMap((txt) => parseIntoStream(parser, txt, uri)),
        map((html) => ({ kind: "html", uri: uri, html: html } as UpdateHTMLEvent)),
        takeUntil(closeThis$),
      )
      .pipe(endWith({ kind: "html", uri: uri, html: undefined } as UpdateHTMLEvent));

    const htmlUpdates$: Observable<UpdateHTMLEvent> = concat(initialHtmlUpdates$, followingHtmlUpdates$);

    const lineUpdates$: Observable<UpdateLineEvent> = cursor$.pipe(
      filter((params) => params.uri === uri),
      map((params) => ({ kind: "line", uri, line: params.line } as UpdateLineEvent)),
      takeUntil(closeThis$),
    );

    return merge(htmlUpdates$, lineUpdates$);
  }),
);

interface DocumentData {
  html: string;
  line: number;
}
const docs$ = new BehaviorSubject<Record<string, DocumentData>>({});
const uri$ = new BehaviorSubject<string | undefined>(undefined);

updates$.subscribe((event) => {
  switch (event.kind) {
    case "html": {
      const { uri, html } = event;
      if (html === undefined) {
        const { [uri]: _, ...rest } = docs$.value;
        docs$.next({ ...rest });
        if (uri$.value === uri) {
          uri$.next(undefined);
        }
        return;
      }
      const origin = docs$.value[uri]
      if (origin) {
        docs$.next({ ...docs$.value, [uri]: { ...origin, html }});
      } else {
        docs$.next({ ...docs$.value, [uri]: { html, line: 0 } });
      }
      if (uri$.value === undefined) uri$.next(uri);
      break;
    }
    case "line": {
      const { uri, line } = event;
      const origin = docs$.value[uri];
      if (origin) {
        docs$.next({ ...docs$.value, [uri]: { ...origin, line } });
      }
      break;
    }
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

const latestDocument$ = combineLatest([docs$, uri$]).pipe(
  debounceTime(100),
  map(([docs, uri]) => (uri ? docs[uri] : undefined)),
);

export const currentLine$ = latestDocument$.pipe(
  map(doc => doc?.line),
  distinctUntilChanged(),
  shareReplay(1),
);

export const currentHTML$ = latestDocument$.pipe(
  map(doc => doc?.html),
  distinctUntilChanged(),
  shareReplay(1),
);
