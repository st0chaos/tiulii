import MarkdownIt, { type Env } from "markdown-it";
import { config } from "./config.js";
import markdownKaTeX from "./md-tex.js";
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from "@tiulii/shared";
import type { Parser, Replacement } from "./shared.js";
import { bundledLanguages, codeToHtml } from "shiki";
import assert from "node:assert";
import { randomUUIDv7 } from "node:crypto";

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

md.use(markdownKaTeX, config.katex);

md.use((md) => {
  const original = md.renderer.rules["fence"];
  md.renderer.rules["fence"] = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx]!;
    const code = token.content.trim();
    const lang = token.info;
    if (lang in bundledLanguages) {
      assert(MarkdownParsingEnv.is(env));
      const placeholder = `<pre id="${randomUUIDv7()}">Waiting for rendering...</pre>`;
      const prms: Promise<Replacement> = codeToHtml(code, {
        lang,
        theme: "min-light",
      })
        .then((html) => {
          return { content: html, placeholder };
        })
        .catch((err) => {
          return { content: `<span>${err}</span>`, placeholder };
        });
      env.replacements.push(prms);
      return placeholder;
    }
    if (original) {
      return original(tokens, idx, options, env, renderer);
    }
    return "";
  };
});

interface MarkdownParsingEnv extends Env {
  replacements: Promise<Replacement>[];
}
namespace MarkdownParsingEnv {
  export function is(env: any): env is MarkdownParsingEnv {
    return "replacements" in env;
  }
}

export const parser: Parser = {
  parse(text) {
    const env: MarkdownParsingEnv = { replacements: [] };
    const html = md.render(text, env);
    return { html, replacements: env.replacements };
  },
};
