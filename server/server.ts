#!/usr/bin/env node
import pth from "node:path";
import url from "node:url";
import express, { type Response as ExpressResponse } from "express";
import open from "open";
import {
  createConnection,
  NotificationType,
  ProposedFeatures,
  TextDocumentSyncKind,
  TextDocuments,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
  ssePath,
  type ServerMessage,
  serverName as lspServerName,
  staticDirectory,
  entryScript,
} from "./base.js";
import { config } from "./config.js";
import {
  BehaviorSubject,
  Observable,
  debounceTime,
  distinctUntilChanged,
  map,
} from "rxjs";
import matter, { type GrayMatterFile } from "@11ty/gray-matter";
import markdownKaTeX from "@vscode/markdown-it-katex";
import MarkdownIt from "markdown-it";

const markdownIt = new MarkdownIt();
markdownIt.use(markdownKaTeX.default);

interface State {
  filePath?: string | undefined;
  fileContent?: string | undefined;
}

class StateManager {
  private state$: BehaviorSubject<State>;
  readonly matter$: Observable<GrayMatterFile<string> | undefined>;
  readonly html$: Observable<string | undefined>;

  constructor(initialState: State) {
    this.state$ = new BehaviorSubject<State>(initialState);

    this.matter$ = this.state$.pipe(
      debounceTime(50),
      map((s) => (s.fileContent ? matter(s.fileContent) : undefined)),
      distinctUntilChanged(),
    );

    this.html$ = this.matter$.pipe(
      map((s) => (s ? markdownIt.render(s.content) : undefined)),
      distinctUntilChanged(),
    );
  }

  get value(): State {
    return this.state$.getValue();
  }

  update(updater: (state: State) => Partial<State>) {
    const currentState = this.value;
    this.state$.next({
      ...currentState,
      ...updater(currentState),
    });
  }

  select<K extends keyof State>(key: K): Observable<State[K]> {
    return this.state$.pipe(
      map((state) => state[key]),
      distinctUntilChanged(),
    );
  }
}

const state = new StateManager({});

const runtimeFilename = url.fileURLToPath(import.meta.url);

const runtimeDirectory = pth.dirname(runtimeFilename);

// LSP server

const lspConnection = createConnection(ProposedFeatures.all);

const documentManager = new TextDocuments(TextDocument);

lspConnection.onInitialize((_) => {
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      },
    },
    serverInfo: { name: lspServerName },
  };
});

interface DidChangeViewParams {
  path: string;
  content: string;
}

lspConnection.onNotification(
  new NotificationType<DidChangeViewParams>(`${lspServerName}/didChangeView`),
  (param) => {
    state.update((_) => ({ filePath: param.path, fileContent: param.content }));
  },
);

lspConnection.onNotification(
  new NotificationType<void>(`${lspServerName}/openPreviewURL`),
  async (_) => {
    const address = httpServer.address();
    if (address === null) return;
    if (typeof address === "string") return;
    await open(`http://127.0.0.1:${address.port}`);
  },
);

documentManager.onDidOpen((_) => {});

documentManager.onDidChangeContent((event) => {
  const path = url.fileURLToPath(event.document.uri);
  state.update((_) => ({
    filePath: path,
    fileContent: event.document.getText(),
  }));
});

documentManager.onDidClose((event) => {
  if (state.value.filePath === url.fileURLToPath(event.document.uri)) {
    state.update((_) => ({
      filePath: undefined,
      fileContent: undefined,
    }));
  }
});

documentManager.listen(lspConnection);
lspConnection.listen();

// HTTP server

function sseSend(res: ExpressResponse, data: ServerMessage) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

const app = express();

app.get(ssePath, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const heartBeat = setInterval(() => {
    res.write(": heartbeat.\n\n");
  }, 15 * 1000);

  const subscription = state.html$.subscribe((html) => {
    if (!html) return;
    sseSend(res, {
      method: "render",
      html: html,
    });
  });

  if (config.css) {
    sseSend(res, { method: "style", css: config.css });
  }

  req.on("close", () => {
    subscription.unsubscribe();
    clearInterval(heartBeat);
    res.end();
  });
});

app.get(/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$/i, async (req, res) => {
  const path = state.value.filePath;
  if (!path) return;
  const imagePath = pth.join(pth.dirname(path), req.path);
  res.sendFile(imagePath);
});

const prefix = "/";
app.use(prefix, express.static(pth.join(runtimeDirectory, staticDirectory)));
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ" crossorigin="anonymous" />
      </head>
      <body><script src="${pth.join(prefix, entryScript)}"></script></body>
    </html>
  `);
});

const httpServer = app.listen(config.port);
