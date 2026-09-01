import MarkdownIt from "markdown-it";
import { config } from "./config.js";
import markdownKaTeX from "./md-tex.js";
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from "@tiulii/shared";
import type { MarkdownParsingEnv, Parser } from "./shared.js";
import markdownFrontMatter from "./md-fm.js";
import markdownShiki from "./md-shiki.js";

const md = new MarkdownIt("commonmark");

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

if (config.markdown.table) md.enable("table");

if (config.markdown.strikethrough) md.enable("strikethrough");

if (config.markdown.frontMatter) md.use(markdownFrontMatter);

if (config.markdown.math) md.use(markdownKaTeX, config.katex);

if (config.markdown.highlight) md.use(markdownShiki);

export const parser: Parser = {
  parse(text) {
    const env: MarkdownParsingEnv = { replacements: [] };
    const html = md.render(text, env);
    return { html, replacements: env.replacements };
  },
};
