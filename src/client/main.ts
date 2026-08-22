import {
  SSE_URL,
  type ServerMessage,
  type ServerMessageRegistry,
} from "../shared.js";

const registry: ServerMessageRegistry = {
  render(message) {
    app.innerHTML = message.html;
  },
  log(message) {
    console.log(message.message);
  },
  style(message) {
    const style = document.createElement("style");
    style.textContent = message.css;
    document.head.append(style);
  },
};

const app = document.createElement("div");
document.body.prepend(app);

const eventSource = new EventSource(SSE_URL);

eventSource.onerror = (event) => {
  console.error(event);
  eventSource.close();
};

eventSource.onmessage = (event) => {
  const message: ServerMessage = JSON.parse(event.data);
  const handler = registry[message.method];
  if (handler === undefined) {
    throw new Error(`No handler registered for method: ${message.method}`);
  }
  (handler as (message: ServerMessage) => void)(message);
};
