import MarkdownIt from "markdown-it";
import { config } from "./config.js";
import markdownKaTeX from "./md-tex.js";
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from "@tiulii/shared";
import type { Parser } from "./shared.js";

const md = new MarkdownIt("commonmark");

md.use(markdownKaTeX, config.katex);

md.use((md) => {
  md.core.ruler.push("inject_line", function (state) {
    const tokens = state.tokens;
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token === undefined || !token.map) continue;
      const [beg, end] = token.map;
      token.attrPush([LINE_BEGIN_ATTR, beg.toString()]);
      token.attrPush([LINE_END_ATTR, end.toString()]);
    }
  });
});

export const parser: Parser = {
  parse(text) {
    return { html: md.render(text), tasks: [] };
  },
};
