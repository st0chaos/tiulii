import { join, dirname, extname } from "node:path";
import {
  INIT_URL,
  SSE_URL,
  type InitalizationMessage,
  type ServerMessage,
} from "@tiulii/shared";
import { config } from "./config.js";
import { currentHTML$, currentLine$, getActiveURI } from "./state.js";
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { SSEStreamingApi, streamSSE } from "hono/streaming";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { access } from "node:fs/promises";
import constants from "node:constants";

const app = new Hono();

app.get(INIT_URL, (c) => {
  const metadata: string[] = [];
  if (config.cssFile) metadata.push(`<style>${config.cssFile}</style>`);
  if (config.markdown.math)
    metadata.push(
      '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ" crossorigin="anonymous" />',
    );

  const message: InitalizationMessage = {
    metadata: metadata,
  };
  return c.json(message);
});

app.get(SSE_URL, async (c) => {
  function sendEvent(res: SSEStreamingApi, data: ServerMessage) {
    res.writeSSE({ data: JSON.stringify(data) });
  }

  return streamSSE(c, async (stream) => {
    const heartBeat = setInterval(() => {
      stream.write(": heartbeat.\n\n");
    }, 15 * 1000);

    const updateSub = currentHTML$.subscribe((html) => {
      sendEvent(stream, { method: "render", html: html ?? "Null" });
    });

    const scrollSub = currentLine$.subscribe((line) => {
      if (line === undefined) return;
      sendEvent(stream, { method: "scroll", line });
    });

    await new Promise<void>((resolve) =>
      stream.onAbort(() => {
        scrollSub.unsubscribe();
        updateSub.unsubscribe();
        clearInterval(heartBeat);
        resolve();
      }),
    );
  });
});

const scriptURL = "/static/index.js";

app.use(
  scriptURL,
  serveStatic({
    path: join(dirname(import.meta.filename), "index.js"),
  }),
);

app.get("/", (c) => {
  return c.html(`
    <!doctype html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body><script src="${scriptURL}"></script></body>
    </html>
  `);
});

app.get(":image{.+\\.(?:png|jpeg|gif|webp|bmp|avif|tiff)$}", async (c) => {
  const activeURI = getActiveURI();
  if (activeURI === undefined) return c.notFound();
  const activePath = fileURLToPath(activeURI);
  if (activePath === "/") return c.notFound();
  const imagePath = c.req.param("image");
  const extension = extname(imagePath).slice(1);
  const filePath = join(dirname(activePath), imagePath);
  try {
    await access(filePath, constants.F_OK);
    c.header("Content-Type", `image/${extension}`);
    return c.body(Readable.toWeb(createReadStream(filePath)));
  } catch {
    return c.notFound();
  }
});

export const httpServer = serve({
  fetch: app.fetch,
  port: config.port,
});
