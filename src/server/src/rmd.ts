import { waitParseResult, type Parser, type Replacement } from './shared.js';
import { rmdParser as markdownParser } from './md.js';
import util from 'node:util';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import { randomUUIDv7 } from 'node:crypto';

const execFile = util.promisify(childProcess.execFile);

const placeholder = `<!-- rmd-${randomUUIDv7} -->`;

async function render(text: string, uri: string): Promise<Replacement> {
  const inputPath = fileURLToPath(uri);
  const workingDirectory = dirname(inputPath);
  const baseName = basename(inputPath);
  const dataDirectoryName = baseName + '.knit.d/';
  const outPath = join(
    workingDirectory,
    dataDirectoryName,
    baseName + '.knit.md'
  );
  try {
    const knitScript = `
    library(knitr);
    opts_knit$set(base.dir="${workingDirectory}");
    opts_chunk$set(fig.path="${dataDirectoryName}");
    knit(text=r"--------[${text}]--------", output="${outPath}");
    `;
    await execFile('Rscript', ['-e', knitScript]);
    const mdtext = await readFile(outPath, { encoding: 'utf8' });
    return {
      placeholder,
      content: await waitParseResult(markdownParser.parse(mdtext, uri)),
    };
  } catch (err) {
    return {
      placeholder,
      content: `<div>Failed to render Rmarkdown: ${err}</div>`,
    };
  }
}

export const parser: Parser = {
  parse(text, uri) {
    return {
      html: placeholder,
      replacements: [render(text, uri)],
    };
  },
};
