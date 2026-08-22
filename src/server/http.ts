import { join, dirname } from "node:path";
import express, { type Response as ExpressResponse } from "express";
import { ssePath, type ServerMessage } from "../shared.js";
import { config } from "./config.js";
import { state } from "./state.js";
import clientJS from "../client.bundle.js";

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

  const subscription = state.activeHTML$.subscribe((html) => {
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
  const path = state.activePath;
  if (!path) return;
  const imagePath = join(dirname(path), req.path);
  res.sendFile(imagePath);
});

app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html");
  res.send(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ" crossorigin="anonymous" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.12.0/styles/default.min.css">
      </head>
      <body><script>${clientJS}</script></body>
    </html>
  `);
});

export const httpServer = app.listen(config.port);
