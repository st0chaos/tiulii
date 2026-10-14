import { unified } from 'unified';
import uniorgParse from 'uniorg-parse';
import uniorgRehype from 'uniorg-rehype';
import stringify from 'rehype-stringify';
import { type Parser, type Replacement } from './shared.js';
import { randomUUIDv7 } from 'node:crypto';
import { config } from './config.ts';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import { visit } from 'unist-util-visit';
import assert from 'node:assert';
import { LINE_BEGIN_ATTR, LINE_END_ATTR } from '@tiulii/shared';

const placeholder = `<!-- org-${randomUUIDv7} -->`;

function createLineMap(text: string) {
  const lineOffsets: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      lineOffsets.push(i + 1);
    }
  }
  return (offset: number): number => {
    assert(typeof offset === 'number');
    let low = 0;
    let high = lineOffsets.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineOffsets[mid] === offset) return mid + 1;
      if (lineOffsets[mid]! < offset) low = mid + 1;
      else high = mid - 1;
    }
    return high + 1;
  };
}

async function render(text: string, _uri: string): Promise<Replacement> {
  const processor = unified()
    .use(uniorgParse)
    .use(
      (lineMap) => (tree) => {
        visit(tree, (node) => {
          type ExpectedNode = typeof node & {
            contentsBegin: number;
            contentsEnd: number;
          };
          function isExpectedNode(node: unknown): node is ExpectedNode {
            return (
              typeof node === 'object' &&
              node !== null &&
              'contentsBegin' in node &&
              'contentsEnd' in node
            );
          }
          node.data = node.data || {};
          node.data.hProperties = node.data.hProperties || {};
          if (isExpectedNode(node)) {
            node.data.hProperties[LINE_BEGIN_ATTR] = lineMap(
              node.contentsBegin
            );
            node.data.hProperties[LINE_END_ATTR] = lineMap(node.contentsEnd);
          }
        });
      },
      createLineMap(text)
    )
    .use(uniorgRehype)
    .use(rehypeShiki, config.shiki)
    .use(rehypeKatex, { macros: {}, ...config.katex })
    .use(stringify);

  const file = await processor.process(text);
  return {
    placeholder,
    content: String(file.value),
  };
}

export const parser: Parser = {
  parse(text, uri) {
    return {
      html: placeholder,
      replacements: [render(text, uri)],
    };
  },
};
