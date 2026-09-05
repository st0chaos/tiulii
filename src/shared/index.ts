export const SSE_URL = "/api/sse";

export const INIT_URL = "/api/init";

export const SERVER_NAME = "tiulii";

export const LINE_BEGIN_ATTR = "src-line-begin";

export const LINE_END_ATTR = "src-line-end";

export interface InitalizationMessage {
  metadata: string[];
}

interface ServerMessageRender {
  method: "render";
  html: string;
}

interface ServerMessageLog {
  method: "log";
  message: any;
}

interface ServerMessageScroll {
  method: "scroll";
  line: number;
}

export type ServerMessage =
  ServerMessageRender | ServerMessageLog | ServerMessageScroll;

export type ServerMessageByMethod<M extends ServerMessage["method"]> = Extract<
  ServerMessage,
  { method: M }
>;

export type ServerMessageRegistry = {
  [M in ServerMessage["method"]]: (message: ServerMessageByMethod<M>) => void;
};
