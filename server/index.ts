#!/usr/bin/env node
import { Observable } from "rxjs";
import {
  createConnection,
  NotificationType,
  ProposedFeatures,
  TextDocumentSyncKind,
  URI,
  type DidChangeTextDocumentParams,
  type DidCloseTextDocumentParams,
  type DidOpenTextDocumentParams,
} from "vscode-languageserver/node";
import { state } from "./state.js";
import { serverName } from "./base.js";
import { httpServer } from "./http.js";
import open from "open";

const connection = createConnection(ProposedFeatures.all);

connection.onInitialize((_) => {
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      },
    },
    serverInfo: { name: serverName },
  };
});

const didOpen$ = new Observable<DidOpenTextDocumentParams>((subscriber) => {
  connection.onDidOpenTextDocument((params) => {
    subscriber.next(params);
  });
  return () => {};
});

didOpen$.subscribe((params) => {
  const { uri, languageId, text, version } = params.textDocument;
  state.newDocument(uri, languageId, text, version);
});

const didChange$ = new Observable<DidChangeTextDocumentParams>((subscriber) => {
  connection.onDidChangeTextDocument((params) => {
    subscriber.next(params);
  });
  return () => {};
});

didChange$.subscribe((params) => {
  const { uri, version } = params.textDocument;
  state.updateDocument(params.contentChanges, uri, version);
});

const didClose$ = new Observable<DidCloseTextDocumentParams>((subscriber) => {
  connection.onDidCloseTextDocument((params) => {
    subscriber.next(params);
  });
  return () => {};
});

didClose$.subscribe((params) => {
  state.closeDocument(params.textDocument.uri);
});

connection.onNotification(
  new NotificationType<{ uri: URI }>(`${serverName}/didChangeView`),
  (params) => {
    state.activate(params.uri);
  },
);

connection.onNotification(
  new NotificationType<{}>(`${serverName}/openPreviewURL`),
  async (_) => {
    const address = httpServer.address();
    if (address === null) return;
    if (typeof address === "string") return;
    await open(`http://127.0.0.1:${address.port}`);
  },
);

connection.listen();
