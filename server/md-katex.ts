/* Copy and modify from microsoft/vscode-markdown-it-katex */
import katex, { type KatexOptions } from "katex";
import type { MarkdownIt, StateInline, Token } from "markdown-it";

function isWhitespace(char: string): boolean {
  return /^\s$/u.test(char);
}

function isWordCharacterOrNumber(char: string): boolean {
  return /^[\w\d]$/u.test(char);
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Test if potential opening or closing delimiter
 */
function isValidInlineDelim(
  state: StateInline,
  pos: number,
): { canOpen: boolean; canClose: boolean } {
  const prevChar = state.src[pos - 1];
  const char = state.src[pos];
  const nextChar = state.src[pos + 1];

  if (char !== "$") {
    return { canOpen: false, canClose: false };
  }

  let canOpen = false;
  let canClose = false;
  if (
    prevChar !== "$" &&
    prevChar !== "\\" &&
    (prevChar === undefined ||
      isWhitespace(prevChar) ||
      !isWordCharacterOrNumber(prevChar))
  ) {
    canOpen = true;
  }

  if (
    nextChar !== "$" &&
    (nextChar == undefined ||
      isWhitespace(nextChar) ||
      !isWordCharacterOrNumber(nextChar))
  ) {
    canClose = true;
  }

  return { canOpen: canOpen, canClose: canClose };
}

function isValidBlockDelim(
  state: StateInline,
  pos: number,
): { readonly canOpen: boolean; readonly canClose: boolean } {
  const prevChar = state.src[pos - 1];
  const char = state.src[pos];
  const nextChar = state.src[pos + 1];
  const nextCharPlus1 = state.src[pos + 2];

  if (
    char === "$" &&
    prevChar !== "$" &&
    prevChar !== "\\" &&
    nextChar === "$" &&
    nextCharPlus1 !== "$"
  ) {
    return { canOpen: true, canClose: true };
  }

  return { canOpen: false, canClose: false };
}

const inlineMathType = "inline_math";

function inlineMath(state: StateInline, silent: boolean): boolean {
  if (state.src[state.pos] !== "$") {
    return false;
  }

  const lastToken = state.tokens.at(-1);
  if (lastToken?.type === "html_inline") {
    // We may be inside of inside of inline html
    if (/^<\w+.+[^/]>$/.test(lastToken.content)) {
      return false;
    }
  }

  let res = isValidInlineDelim(state, state.pos);
  if (!res.canOpen) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos += 1;
    return true;
  }

  // First check for and bypass all properly escaped delimieters
  // This loop will assume that the first leading backtick can not
  // be the first character in state.src, which is known since
  // we have found an opening delimieter already.
  let start = state.pos + 1;
  let match = start;
  let pos;
  while ((match = state.src.indexOf("$", match)) !== -1) {
    // Found potential $, look for escapes, pos will point to
    // first non escape when complete
    pos = match - 1;
    while (state.src[pos] === "\\") {
      pos -= 1;
    }

    // Even number of escapes, potential closing delimiter found
    if ((match - pos) % 2 == 1) {
      break;
    }
    match += 1;
  }

  // No closing delimter found.  Consume $ and continue.
  if (match === -1) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  // Check if we have empty content, ie: $$.  Do not parse.
  if (match - start === 0) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start + 1;
    return true;
  }

  // Check for valid closing delimiter
  res = isValidInlineDelim(state, match);
  if (!res.canClose) {
    if (!silent) {
      state.pending += "$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    const token = state.push(inlineMathType, "math", 0);
    token.markup = "$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 1;
  return true;
}

const displayMathType = "display_math";

function displayMath(state: StateInline, silent: boolean): boolean {
  var start, match, token, res, pos;

  if (state.src.slice(state.pos, state.pos + 2) !== "$$") {
    return false;
  }

  res = isValidBlockDelim(state, state.pos);
  if (!res.canOpen) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos += 2;
    return true;
  }

  // First check for and bypass all properly escaped delimieters
  // This loop will assume that the first leading backtick can not
  // be the first character in state.src, which is known since
  // we have found an opening delimieter already.
  start = state.pos + 2;
  match = start;
  while ((match = state.src.indexOf("$$", match)) !== -1) {
    // Found potential $$, look for escapes, pos will point to
    // first non escape when complete
    pos = match - 1;
    while (state.src[pos] === "\\") {
      pos -= 1;
    }

    // Even number of escapes, potential closing delimiter found
    if ((match - pos) % 2 == 1) {
      break;
    }
    match += 2;
  }

  // No closing delimter found.  Consume $$ and continue.
  if (match === -1) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start;
    return true;
  }

  // Check if we have empty content, ie: $$$$.  Do not parse.
  if (match - start === 0) {
    if (!silent) {
      state.pending += "$$$$";
    }
    state.pos = start + 2;
    return true;
  }

  // Check for valid closing delimiter
  res = isValidBlockDelim(state, match);
  if (!res.canClose) {
    if (!silent) {
      state.pending += "$$";
    }
    state.pos = start;
    return true;
  }

  if (!silent) {
    token = state.push(displayMathType, "math", 0);
    token.block = true;
    token.markup = "$$";
    token.content = state.src.slice(start, match);
  }

  state.pos = match + 2;
  return true;
}

export default function (md: MarkdownIt, userOptions?: KatexOptions) {
  md.inline.ruler.after("escape", "inline_math_rule", inlineMath);
  md.inline.ruler.after("escape", "display_math_rule", displayMath);

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

  md.renderer.rules[inlineMathType] = inlineRenderer;
  md.renderer.rules[displayMathType] = blockRenderer;
}
