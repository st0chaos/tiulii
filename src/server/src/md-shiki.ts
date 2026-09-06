import type { MarkdownIt } from "markdown-it";
import { bundledLanguages, codeToHtml } from "shiki";
import { MarkdownParsingEnv, type Replacement } from "./shared.js";
import { randomUUIDv7 } from "node:crypto";
import { config } from "./config.js";
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from "@tiulii/shared";
import assert from "node:assert";

export default (md: MarkdownIt) => {
  const original = md.renderer.rules["fence"];
  md.renderer.rules["fence"] = (tokens, idx, options, env, renderer) => {
    const token = tokens[idx]!;
    const code = token.content.trim();
    const lang = token.info;
    if (lang in bundledLanguages) {
      assert(env && MarkdownParsingEnv.is(env));
      const placeholder = `<pre id="${randomUUIDv7()}">Waiting for rendering...</pre>`;
      const prms: Promise<Replacement> = codeToHtml(code, {
        lang,
        theme: config.shiki.theme,
        transformers: [
          {
            pre(hast) {
              if (token.map) {
                hast.properties[LINE_BEGIN_ATTR] = token.map[0].toString();
                hast.properties[LINE_END_ATTR] = token.map[1].toString();
              }
            },
          },
        ],
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
};
