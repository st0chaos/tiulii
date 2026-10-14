import { unified } from 'unified';
import uniorgParse from 'uniorg-parse';
import uniorgRehype from 'uniorg-rehype';
import stringify from 'rehype-stringify';
import { type Parser, type Replacement } from './shared.js';
import { randomUUIDv7 } from 'node:crypto';
import { config } from './config.ts';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';

const processor = unified()
  .use(uniorgParse)
  .use(uniorgRehype)
  .use(rehypeKatex, { macros: {}, ...config.katex })
  .use(rehypeShiki, config.shiki)
  .use(stringify);

const placeholder = `<!-- org-${randomUUIDv7} -->`;

async function parseOrgToHtml(
  orgContent: string,
  _uri: string
): Promise<Replacement> {
  const file = await processor.process(orgContent);
  return {
    placeholder,
    content: String(file.value),
  };
}

export const parser: Parser = {
  parse(text, uri) {
    return {
      html: placeholder,
      replacements: [parseOrgToHtml(text, uri)],
    };
  },
};
