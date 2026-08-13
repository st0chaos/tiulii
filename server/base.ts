export const ssePath = "/sse";

export const serverName = "tiulii";

export const staticDirectory = "assets";

export const entryScript = "main.js";

interface ServerMessageRender {
  method: "render";
  html: string;
}

interface ServerMessageLog {
  method: "log";
  message: any;
}

interface ServerMessageStyle {
  method: "style";
  css: string;
}

export type ServerMessage =
  ServerMessageRender | ServerMessageLog | ServerMessageStyle;

export type ServerMessageByMethod<M extends ServerMessage["method"]> = Extract<
  ServerMessage,
  { method: M }
>;

export type ServerMessageRegistry = {
  [M in ServerMessage["method"]]: (message: ServerMessageByMethod<M>) => void;
};
