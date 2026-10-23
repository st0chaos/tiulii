import { waitParseResult, type Parser, type Replacement } from './shared.js';
import { rmdParser as markdownParser } from './md.js';
import util from 'node:util';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { randomUUIDv7 } from 'node:crypto';

const execFile = util.promisify(childProcess.execFile);

const placeholder = `<!-- rmd-${randomUUIDv7} -->`;

async function render(text: string, uri: string): Promise<Replacement> {
  const inputPath = fileURLToPath(uri);
  const workingDirectory = dirname(inputPath);
  const baseName = basename(inputPath);
  const outputDirName = baseName + '.knit.d/';
  const outputDirectory = join(workingDirectory, outputDirName);
  const outPath = join(outputDirectory, baseName + '.knit.md');
  try {
    const knitScript = `
    library(knitr);
    opts_knit$set(base.dir="${workingDirectory}");
    opts_chunk$set(fig.path="${outputDirName}");
    knit(text=r"--------[${text}]--------", output="${outPath}");
    `;
    await mkdir(outputDirectory, { recursive: true });
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
