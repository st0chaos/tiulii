export const SSE_URL = "/sse";

export const SERVER_NAME = "tiulii";

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
