import katex, { type KatexOptions } from 'katex';
import type { MarkdownIt, Token } from 'markdown-it';
import { inlineMathTokenType, displayMathTokenType } from './md-tex.js';

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export default function (md: MarkdownIt, katexOptions?: KatexOptions) {
  // Ensure `macros` property exists so that users can define their own macros
  const options: KatexOptions = {
    macros: {},
    ...katexOptions,
  };

  const inlineRenderer = (tokens: readonly Token[], idx: number) => {
    const content = tokens[idx]!.content;
    const latex = content;
    try {
      return katex.renderToString(latex, options);
    } catch (error) {
      return `<span title="${escapeHtml(latex)}">${escapeHtml(error + '')}</span>`;
    }
  };

  const blockRenderer = (tokens: readonly Token[], idx: number) => {
    const content = tokens[idx]!.content;
    try {
      return `<span>${katex.renderToString(content, { displayMode: true, ...options })}</span>`;
    } catch (error) {
      return `<span title="${escapeHtml(content)}">${escapeHtml(error + '')}</span>`;
    }
  };

  md.renderer.rules[inlineMathTokenType] = inlineRenderer;
  md.renderer.rules[displayMathTokenType] = blockRenderer;
}
