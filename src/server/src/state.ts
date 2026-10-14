import {
  BehaviorSubject,
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
  Observable,
  EMPTY,
  scan,
  merge,
  share,
  buffer,
  switchMap,
} from 'rxjs';
import {
  type DidOpenTextDocumentParams,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { getParser } from './parser.js';
import type { Parser } from './shared.js';
import { config } from './config.ts';

export interface DidMoveCursorParams {
  line: number;
  uri: string;
}

export const open$ = new Subject<DidOpenTextDocumentParams>();
export const close$ = new Subject<DidCloseTextDocumentParams>();
export const change$ = new Subject<DidChangeTextDocumentParams>();
export const cursorMoved$ = new Subject<DidMoveCursorParams>();

function parseIntoStream(
  parser: Parser,
  content: string,
  uri: string
): Observable<string> {
  const { html: initialHtml, replacements } = parser.parse(content, uri);
  return from(replacements).pipe(
    mergeMap((prms) => from(prms)),
    scan(
      (currentHtml, { placeholder, content }) =>
        currentHtml.replaceAll(placeholder, content),
      initialHtml
    ),
    startWith(initialHtml)
  );
}

interface UpdateHTMLEvent {
  kind: 'html';
  uri: string;
  html: string | undefined;
}
interface UpdateLineEvent {
  kind: 'line';
  uri: string;
  line: number;
}
type UpdateEvent = UpdateHTMLEvent | UpdateLineEvent;

const updates$: Observable<UpdateEvent> = open$.pipe(
  mergeMap(({ textDocument: { uri, languageId, text } }) => {
    let version = 0;
    const textDocument = TextDocument.create(uri, languageId, version, text);
    const parser = getParser(languageId);
    if (!parser) return EMPTY;

    const closeThis$ = close$.pipe(
      filter((params) => params.textDocument.uri === uri)
    );

    const initialHTMLUpdate$: Observable<UpdateHTMLEvent> = parseIntoStream(
      parser,
      text,
      uri
    ).pipe(map((html) => ({ kind: 'html', uri: uri, html: html })));

    const changeThis$ = change$.pipe(
      filter((params) => params.textDocument.uri === uri),
      map((params) => params.contentChanges),
      share()
    );

    const upcomingHTMLUpdate$: Observable<UpdateHTMLEvent> = changeThis$.pipe(
      buffer(changeThis$.pipe(debounceTime(config.debounceTime))),
      map((collection) => collection.flat()),
      filter((changes) => changes.length !== 0),
      map((changes) => {
        TextDocument.update(textDocument, changes, version);
        version++;
        return textDocument.getText();
      }),
      switchMap((txt) => parseIntoStream(parser, txt, uri)),
      map(
        (html) => ({ kind: 'html', uri: uri, html: html }) as UpdateHTMLEvent
      ),
      takeUntil(closeThis$),
      endWith({ kind: 'html', uri: uri, html: undefined } as UpdateHTMLEvent)
    );

    const lineUpdate$: Observable<UpdateLineEvent> = cursorMoved$.pipe(
      filter((params) => params.uri === uri),
      map(
        (params) =>
          ({ kind: 'line', uri, line: params.line }) as UpdateLineEvent
      ),
      takeUntil(closeThis$)
    );

    return merge(concat(initialHTMLUpdate$, upcomingHTMLUpdate$), lineUpdate$);
  })
);

interface DocumentData {
  html: string;
  line: number;
}
const docs$ = new BehaviorSubject<Record<string, DocumentData>>({});
const uri$ = new BehaviorSubject<string | undefined>(undefined);

updates$.subscribe((event) => {
  switch (event.kind) {
    case 'html': {
      const { uri, html } = event;
      if (html === undefined) {
        const { [uri]: _, ...rest } = docs$.value;
        docs$.next({ ...rest });
        if (uri$.value === uri) {
          uri$.next(undefined);
        }
        return;
      }
      const origin = docs$.value[uri];
      if (origin) {
        docs$.next({ ...docs$.value, [uri]: { ...origin, html } });
      } else {
        docs$.next({ ...docs$.value, [uri]: { html, line: 0 } });
      }
      if (uri$.value === undefined) uri$.next(uri);
      break;
    }
    case 'line': {
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
  map(([docs, uri]) => (uri ? docs[uri] : undefined))
);

export const currentLine$ = latestDocument$.pipe(
  map((doc) => doc?.line),
  distinctUntilChanged(),
  shareReplay(1)
);

export const currentHTML$ = latestDocument$.pipe(
  map((doc) => doc?.html),
  distinctUntilChanged(),
  shareReplay(1)
);
