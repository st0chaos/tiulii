#!/usr/bin/env node
import {
  createConnection,
  NotificationType,
  ProposedFeatures,
  TextDocumentSyncKind,
  URI,
} from "vscode-languageserver/node";
import { change$, setActiveURI, close$, open$, cursor$, type DidMoveCursorParams } from "./state.js";
import { httpServer } from "./http.js";
import open from "open";
import { SERVER_NAME } from "@tiulii/shared";

const connection = createConnection(ProposedFeatures.all);

connection.onInitialize((_) => {
  return {
    capabilities: {
      textDocumentSync: {
        openClose: true,
        change: TextDocumentSyncKind.Incremental,
      },
    },
    serverInfo: { name: SERVER_NAME },
  };
});

connection.onDidOpenTextDocument((params) => {
  open$.next(params);
});

connection.onDidChangeTextDocument((params) => {
  change$.next(params);
});

connection.onDidCloseTextDocument((params) => {
  close$.next(params);
});

connection.onNotification(
  new NotificationType<{ uri: URI }>(`${SERVER_NAME}/didChangeView`),
  ({ uri }) => {
    setActiveURI(uri);
  },
);

connection.onNotification(
  new NotificationType<DidMoveCursorParams>(`${SERVER_NAME}/didMoveCursor`),
  (params) => {
    cursor$.next(params);
  },
);

connection.onNotification(
  new NotificationType<{}>(`${SERVER_NAME}/openPreviewURL`),
  async (_) => {
    const address = httpServer.address();
    if (address === null) return;
    if (typeof address === "string") return;
    try {
      await open(`http://127.0.0.1:${address.port}`);
    } catch (err) {
      console.error(err);
    }
  },
);

connection.listen();

// Local Variables:
// mode: typescript-ts
// End:
