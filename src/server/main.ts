#!/usr/bin/env node
import {
  createConnection,
  NotificationType,
  ProposedFeatures,
  TextDocumentSyncKind,
  URI,
} from "vscode-languageserver/node";
import { state } from "./state.js";
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
  state.newDocument(params);
});

connection.onDidChangeTextDocument((params) => {
  state.updateDocument(params);
});

connection.onDidCloseTextDocument((params) => {
  state.closeDocument(params);
});

connection.onNotification(
  new NotificationType<{ uri: URI }>(`${SERVER_NAME}/didChangeView`),
  (params) => {
    state.activateURI(params.uri);
  },
);

connection.onNotification(
  new NotificationType<{}>(`${SERVER_NAME}/openPreviewURL`),
  async (_) => {
    const address = httpServer.address();
    if (address === null) return;
    if (typeof address === "string") return;
    await open(`http://127.0.0.1:${address.port}`);
  },
);

connection.onNotification(
  new NotificationType<{ line: number }>(`${SERVER_NAME}/didMoveCursor`),
  ({ line }) => {
    state.activeLine$.next(line);
  },
);

connection.listen();
