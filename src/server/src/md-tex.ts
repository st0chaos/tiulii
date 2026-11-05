/* Copy and modify from microsoft/vscode-markdown-it-katex */
import type { MarkdownIt, StateInline } from 'markdown-it';

export const inlineMathTokenType = 'inline_math';

export const displayMathTokenType = 'display_math';

// function isWhitespace(char: string): boolean {
//   return /^\s$/u.test(char);
// }

// function isWordCharacterOrNumber(char: string): boolean {
//   return /^[\w\d]$/u.test(char);
// }

interface TeXOptions {
  texInline: boolean;
  texDisplay: boolean;
  latexInline: boolean;
  latexDisplay: boolean;
  githubInline: boolean;
}

function findPairPosition(
  state: StateInline,
  open: string,
  close: string
): [number, number] | undefined {
  const openLength = open.length;

  const beg = state.pos;
  if (state.src.slice(beg, beg + openLength) !== open) return;

  let end = beg;
  while ((end = state.src.indexOf(close, end + openLength)) !== -1) {
    let backslash = 0;
    for (let pos = end - 1; pos > beg && state.src[pos] === '\\'; pos--) {
      backslash++;
    }
    if (backslash % 2 === 0) {
      break;
    }
  }
  if (end === -1) return;

  return [beg, end];
}

function mathInlineTeX(state: StateInline, silent: boolean): boolean {
  const pos = findPairPosition(state, '$', '$');
  if (!pos) return false;
  const [beg, end] = pos;

  if (silent) return true;
  const token = state.push(inlineMathTokenType, 'math', 0);
  token.markup = '$';
  token.content = state.src.slice(beg + 1, end);
  state.pos = end + 1;
  return true;
}

function mathDisplayTeX(state: StateInline, silent: boolean): boolean {
  const pos = findPairPosition(state, '$$', '$$');
  if (!pos) return false;
  const [beg, end] = pos;

  if (silent) return true;
  const token = state.push(displayMathTokenType, 'math', 0);
  token.markup = '$$';
  token.content = state.src.slice(beg + 2, end);
  token.block = true;
  state.pos = end + 2;
  return true;
}

function mathInlineGithub(state: StateInline, silent: boolean): boolean {
  const pos = findPairPosition(state, '$`', '`$');
  if (!pos) return false;
  const [beg, end] = pos;

  if (silent) return true;
  const token = state.push(inlineMathTokenType, 'math', 0);
  token.markup = '$`';
  token.content = state.src.slice(beg + 2, end);
  state.pos = end + 2;
  return true;
}

function mathDisplayLaTeX(state: StateInline, silent: boolean): boolean {
  const pos = findPairPosition(state, '\\[', '\\]');
  if (!pos) return false;
  const [beg, end] = pos;

  if (silent) return true;
  const token = state.push(displayMathTokenType, 'math', 0);
  token.markup = '\\[';
  token.content = state.src.slice(beg + 2, end);
  token.block = true;
  state.pos = end + 2;
  return true;
}

function mathInlineLaTeX(state: StateInline, silent: boolean): boolean {
  const pos = findPairPosition(state, '\\(', '\\)');
  if (!pos) return false;
  const [beg, end] = pos;

  if (silent) return true;
  const token = state.push(inlineMathTokenType, 'math', 0);
  token.markup = '\\(';
  token.content = state.src.slice(beg + 2, end);
  state.pos = end + 2;
  return true;
}

export default function (md: MarkdownIt, options?: TeXOptions) {
  if (options?.texInline) {
    const rule = options?.githubInline ? 'math_inline_github' : 'escape';
    md.inline.ruler.after(rule, 'math_inline_tex', mathInlineTeX);
  }
  if (options?.texDisplay)
    md.inline.ruler.after('escape', 'math_display_tex', mathDisplayTeX);
  if (options?.latexInline)
    md.inline.ruler.before('escape', 'math_inline_latex', mathInlineLaTeX);
  if (options?.latexDisplay)
    md.inline.ruler.before('escape', 'math_display_latex', mathDisplayLaTeX);
  if (options?.githubInline)
    md.inline.ruler.after('escape', 'math_inline_github', mathInlineGithub);
}
