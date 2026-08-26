/* Copy and modify from microsoft/vscode-markdown-it-katex */
import katex, { type KatexOptions } from "katex";
import type { MarkdownIt, StateInline, Token } from "markdown-it";

const inlineMathTokenType = "inline_math";

const displayMathTokenType = "display_math";

// function isWhitespace(char: string): boolean {
//   return /^\s$/u.test(char);
// }

// function isWordCharacterOrNumber(char: string): boolean {
//   return /^[\w\d]$/u.test(char);
// }

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function mathInlineTeX(state: StateInline, silent: boolean): boolean {
  const beg = state.pos;
  if (state.src[beg] !== "$") return false;

  // const lastToken = state.tokens.at(-1);
  // if (lastToken?.type === "html_inline") {
  //   // We may be inside of inside of inline html
  //   if (/^<\w+.+[^/]>$/.test(lastToken.content)) {
  //     return false;
  //   }
  // }

  let end = beg;
  while ((end = state.src.indexOf("$", end + 1)) !== -1) {
    let backslash = 0;
    for (let pos = end - 1; pos > beg && state.src[pos] === "\\"; pos--) {
      backslash++;
    }
    if (backslash % 2 === 0) {
      break;
    }
  }
  if (end === -1) return false;

  if (end - beg === 1) return false;

  if (silent) return true;
  const token = state.push(inlineMathTokenType, "math", 0);
  token.markup = "$";
  token.content = state.src.slice(beg + 1, end);
  state.pos = end + 1;
  return true;
}

function mathDisplayTeX(state: StateInline, silent: boolean): boolean {
  const beg = state.pos;
  if (state.src.slice(beg, beg + 2) !== "$$") return false;

  let end = beg;
  while ((end = state.src.indexOf("$$", end + 2)) !== -1) {
    let backslash = 0;
    for (let pos = end - 1; pos > beg && state.src[pos] === "\\"; pos--) {
      backslash++;
    }
    if (backslash % 2 === 0) {
      break;
    }
  }
  if (end === -1) return false;

  if (end - beg === 2) return false;

  if (silent) return true;
  const token = state.push(displayMathTokenType, "math", 0);
  token.markup = "$$";
  token.content = state.src.slice(beg + 2, end);
  token.block = true;
  state.pos = end + 2;
  return true;
}

function mathInlineGithub(state: StateInline, silent: boolean): boolean {
  const beg = state.pos;
  if (state.src.slice(beg, beg + 2) !== "$`") return false;

  let end = beg;
  while ((end = state.src.indexOf("`$", end + 2)) !== -1) {
    let backslash = 0;
    for (let pos = end - 1; pos > beg && state.src[pos] === "\\"; pos--) {
      backslash++;
    }
    if (backslash % 2 === 0) {
      break;
    }
  }
  if (end === -1) return false;

  if (end - beg === 2) return false;

  if (silent) return true;
  const token = state.push(inlineMathTokenType, "math", 0);
  token.markup = "$$";
  token.content = state.src.slice(beg + 2, end);
  token.block = true;
  state.pos = end + 2;
  return true;
}

export default function (md: MarkdownIt, userOptions?: KatexOptions) {
  md.inline.ruler.after("escape", "math_inline_github", mathInlineGithub);
  md.inline.ruler.after("math_inline_github", "math_inline_tex", mathInlineTeX);
  md.inline.ruler.after("escape", "math_display_tex", mathDisplayTeX);

  // Ensure `macros` property exists so that users can define their own macros
  const options: KatexOptions = {
    macros: {},
    ...userOptions,
  };

  const inlineRenderer = (tokens: readonly Token[], idx: number) => {
    const content = tokens[idx]!.content;
    const latex = content;
    try {
      return katex.renderToString(latex, options);
    } catch (error) {
      if (options?.throwOnError) console.log(error);
      return `<span title="${escapeHtml(latex)}">${escapeHtml(error + "")}</span>`;
    }
  };

  const blockRenderer = (tokens: readonly Token[], idx: number) => {
    const content = tokens[idx]!.content;
    try {
      return `<span>${katex.renderToString(content, { displayMode: true, ...options })}</span>`;
    } catch (error) {
      if (options?.throwOnError) console.log(error);
      return `<span title="${escapeHtml(content)}">${escapeHtml(error + "")}</span>`;
    }
  };

  md.renderer.rules[inlineMathTokenType] = inlineRenderer;
  md.renderer.rules[displayMathTokenType] = blockRenderer;
}
