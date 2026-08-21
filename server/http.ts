import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Response as ExpressResponse } from "express";
import {
  ssePath,
  entryScript,
  staticDirectory,
  type ServerMessage,
} from "./base.js";
import { config } from "./config.js";
import { state } from "./state.js";
import { cssURL } from "./md-katex.js";

function sendEvent(res: ExpressResponse, data: ServerMessage) {
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

  const subscription = state.activeDocumentHTML$.subscribe((html) => {
    sendEvent(res, { method: "render", html: html ?? "" });
  });

  if (config.css) {
    sendEvent(res, { method: "style", css: config.css });
  }

  req.on("close", () => {
    subscription.unsubscribe();
    clearInterval(heartBeat);
    res.end();
  });
});

app.get(/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico|avif)$/i, async (req, res) => {
  const path = state.activeDocumentPath;
  if (!path) return;
  const imagePath = join(dirname(path), req.path);
  res.sendFile(imagePath);
});

const prefix = "/";
app.use(
  prefix,
  express.static(
    join(dirname(fileURLToPath(import.meta.url)), staticDirectory),
  ),
);
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        ${cssURL}
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.12.0/styles/default.min.css">
      </head>
      <body><script src="${join(prefix, entryScript)}"></script></body>
    </html>
  `);
});

export const httpServer = app.listen(config.port);
