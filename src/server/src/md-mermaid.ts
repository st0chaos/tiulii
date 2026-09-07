import type { MarkdownIt } from "markdown-it";
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from "@tiulii/shared";

interface MermaidOptions {
  className: string;
}

export default (md: MarkdownIt, mermaidOptions: MermaidOptions) => {
  const original = md.renderer.rules["fence"];
  md.renderer.rules["fence"] = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx]!;
    const code = token.content.trim();
    const lang = token.info;
    if (lang === "mermaid") {
      let lineInfo = "";
      if (token.map) {
        const [beg, end] = token.map;
        lineInfo = ` ${LINE_BEGIN_ATTR}="${beg}" ${LINE_END_ATTR}="${end}"`;
      }
      return `<pre class="${mermaidOptions.className}"${lineInfo}>${code}</pre>`;
    }
    if (original) {
      return original(tokens, idx, options, env, renderer);
    }
    return "";
  };
};
