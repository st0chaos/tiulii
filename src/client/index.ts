import {
  SSE_URL,
  LINE_BEGIN_ATTR,
  LINE_END_ATTR,
  type ServerMessage,
  type ServerMessageRegistry,
  INIT_URL,
  type InitalizationMessage,
} from "@tiulii/shared";

const app = document.createElement("div");
document.body.prepend(app);

fetch(INIT_URL)
  .then((response) => response.json())
  .then((message: InitalizationMessage) => {
    document.head.insertAdjacentHTML("afterbegin", message.metadata.join(""));
  })
  .then(() => {
    const registry: ServerMessageRegistry = {
      render(message) {
        app.innerHTML = message.html;
      },

      log(message) {
        console.log(message.message);
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
            if (end - beg < 30) ratio = 0;
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
          const H = window.innerHeight * 0.2; // Move viewport slightly up
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
      const message: ServerMessage = JSON.parse(event.data);
      const handler = registry[message.method];
      if (handler === undefined) {
        throw new Error(`No handler registered for method: ${message.method}`);
      }
      (handler as (message: ServerMessage) => void)(message);
    };
  });
