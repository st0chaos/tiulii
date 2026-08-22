#!/usr/bin/env node
import {
  createConnection,
  NotificationType,
  ProposedFeatures,
  TextDocumentSyncKind,
  URI,
} from "vscode-languageserver/node";
import { state } from "./state.js";
import { serverName } from "../shared.js";
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

connection.onDidOpenTextDocument((params) => {
  const { uri, languageId, text, version } = params.textDocument;
  state.newDocument(uri, languageId, text, version);
});

connection.onDidChangeTextDocument((params) => {
  const {
    contentChanges,
    textDocument: { uri, version },
  } = params;
  state.updateDocument(contentChanges, uri, version);
});

connection.onDidCloseTextDocument((params) => {
  state.closeDocument(params.textDocument.uri);
});

connection.onNotification(
  new NotificationType<{ uri: URI }>(`${serverName}/didChangeView`),
  (params) => {
    state.activateURI(params.uri);
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
