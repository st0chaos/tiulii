import { type MarkdownIt, type StateBlock } from "markdown-it";

const frontMatterTokenType = "front_matter";

export interface FrontMatterDecl {
  delimiter: string;
  format: string;
}

const frontMatterFormatRegistry: FrontMatterDecl[] = [
  { delimiter: "---", format: "yaml" },
  { delimiter: "+++", format: "toml" },
] as const;

function parseFrontMatter(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  if (startLine !== 0) return false;

  let format;
  const pos = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  for (const fmt of frontMatterFormatRegistry) {
    const len = fmt.delimiter.length;
    if (
      pos + len === max &&
      state.src.slice(pos, pos + len) === fmt.delimiter
    ) {
      format = fmt;
      break;
    }
  }
  if (format === undefined) return false;

  let found = false;
  let nextLine = startLine;
  const len = format.delimiter.length;
  while (nextLine < endLine) {
    nextLine++;
    const pos = state.bMarks[nextLine]! + state.tShift[nextLine]!;
    const max = state.eMarks[nextLine]!;
    if (
      pos + len === max &&
      state.src.slice(pos, pos + len) === format.delimiter
    ) {
      found = true;
      break;
    }
  }
  if (!found) return false;

  if (silent) return true;

  const contentStart = state.bMarks[startLine + 1];
  const contentEnd = state.bMarks[nextLine];
  const rawContent = state.src.slice(contentStart, contentEnd);
  const token = state.push(frontMatterTokenType, "front_matter", 0);
  token.block = true;
  token.content = rawContent;
  token.map = [startLine, nextLine];
  token.meta = { ...token.meta, ...format };

  state.line = nextLine + 1;
  return true;
}

export default function (md: MarkdownIt) {
  md.block.ruler.before("code", "front_matter", parseFrontMatter, {
    alt: ["paragraph", "reference", "blockquote"],
  });
  md.renderer.rules[frontMatterTokenType] = () => {
    return "";
  };
}
