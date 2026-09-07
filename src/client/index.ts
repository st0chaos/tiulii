import {
  INIT_URL,
  SSE_URL,
  LINE_BEGIN_ATTR,
  LINE_END_ATTR,
  type ServerMessage,
  type ServerMessageRegistry,
  type InitalizationParams,
} from "@tiulii/shared";
import mermaid from "mermaid";

mermaid.initialize({ startOnLoad: false });

const app = document.createElement("div");
document.body.prepend(app);

async function mermaidRender(element: Element) {
  const uuid = `mermaid-${crypto.randomUUID()}`;
  const { svg } = await mermaid.render(uuid, element.textContent);
  let lineAttrs = "";
  let line: string | null;
  if ((line = element.getAttribute(LINE_BEGIN_ATTR)) !== null)
    lineAttrs += ` ${LINE_BEGIN_ATTR}="${line}"`;
  if ((line = element.getAttribute(LINE_END_ATTR)) !== null)
    lineAttrs += ` ${LINE_END_ATTR}="${line}"`;
  element.outerHTML = `<div ${lineAttrs}>${svg}</div>`;
}

fetch(INIT_URL)
  .then((response) => response.json())
  .then((params: InitalizationParams) => {
    if (params.customCSS) {
      document.head.insertAdjacentHTML(
        "afterbegin",
        `<style>${params.customCSS}</style>`,
      );
    }
    if (params.config.markdown.math) {
      document.head.insertAdjacentHTML(
        "afterbegin",
        '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.18.4/dist/katex.min.css" integrity="sha384-u1zONI5gPXUx0UKI62c75/zww972y0v2rSK5ZYlVdS6xEuWDeZWUI66v6t1gvlXJ" crossorigin="anonymous" />',
      );
    }
    if (params.config.mermaid.enable) {
      mermaid.initialize(params.config.mermaid.options);
    }
    return params;
  })
  .then(({ config }) => {
    const registry: ServerMessageRegistry = {
      render(message) {
        app.innerHTML = message.html;

        document.querySelectorAll("img").forEach((img) => {
          img.addEventListener("click", () => {
            if (!document.fullscreenElement) {
              img.requestFullscreen().catch((err) => {
                console.error(
                  `Error attempting to enable full-screen mode: ${err.message}`,
                );
              });
            } else {
              document.exitFullscreen();
            }
          });
        });

        if (config.mermaid.enable) {
          for (const element of document.querySelectorAll(
            `.${config.mermaid.class}`,
          )) {
            mermaidRender(element);
          }
        }
      },

      scroll(message) {
        let target;
        let ratio = 0;
        for (const elm of app.querySelectorAll(
          `[${LINE_BEGIN_ATTR}][${LINE_END_ATTR}]`,
        )) {
          const beg = parseInt(elm.getAttribute(LINE_BEGIN_ATTR)!, 10);
          const end = parseInt(elm.getAttribute(LINE_END_ATTR)!, 10);
          if (beg <= message.line) {
            target = elm;
            if (end - beg < config.scroll.threshold) ratio = 0;
            else ratio = (message.line - beg) / (end - beg);
          } else {
            break;
          }
        }
        if (target) {
          const rect = target.getBoundingClientRect();
          // T is target top relative to viewport + height by which viewport scrolled.
          // In other words, T is the top relative to the page.
          const T = rect.top + window.scrollY;
          const H = window.innerHeight * config.scroll.top; // Move viewport slightly up
          window.scrollTo({
            top: T - H + rect.height * ratio,
            behavior: "smooth",
          });
        }
      },
    };

    const source = new EventSource(SSE_URL);
    source.onerror = (event) => {
      console.error(event);
      source.close();
    };
    source.onmessage = (event) => {
      const message = JSON.parse(event.data) as ServerMessage;
      const handler = registry[message.method];
      if (handler === undefined) {
        throw new Error(`No handler registered for method: ${message.method}`);
      }
      (handler as (message: ServerMessage) => void)(message);
    };
  });
