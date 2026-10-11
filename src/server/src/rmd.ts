import { waitParseResult, type Parser, type Replacement } from './shared.js';
import { parser as markdownParser } from './md.js';
import util from 'node:util';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join, isAbsolute } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { randomUUIDv7 } from 'node:crypto';
import os from 'node:os';

const exec = util.promisify(childProcess.exec);

const placeholder = `<div id="${randomUUIDv7}">The Rmarkdown is rendering...</div>`;

const tmpFileName = `tltmp-20299910`;

async function render(text: string, uri: string): Promise<Replacement> {
  const tmpFilePath = join(os.tmpdir(), tmpFileName);
  await writeFile(tmpFilePath, text, { encoding: 'utf8' });

  const inPath = fileURLToPath(uri);
  const workingDirectory = dirname(inPath);
  const baseName = basename(inPath);
  const outPath = join(workingDirectory, baseName + '.knit.md');
  const figDirectoryName = `${baseName}.knit.d/`;
  try {
    await exec(
      `Rscript -e '
      library(knitr);
      opts_knit$set(base.dir="${workingDirectory}");
      opts_chunk$set(fig.path="${figDirectoryName}");
      knit("${tmpFilePath}", output="${outPath}");
      '`
    );
    const text = await readFile(outPath, { encoding: 'utf8' });
    return {
      placeholder,
      content: await waitParseResult(markdownParser.parse(text, uri)),
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
