import { waitParseResult, type Parser, type Replacement } from './shared.js';
import { rmdParser as markdownParser } from './md.js';
import util from 'node:util';
import childProcess from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join, isAbsolute, normalize } from 'node:path';
import { readFile, mkdir } from 'node:fs/promises';
import { randomUUIDv7 } from 'node:crypto';
import { config } from './config.js';

const execFile = util.promisify(childProcess.execFile);

const placeholder = `<!-- rmd-${randomUUIDv7} -->`;

function format(fmt: string, fields: Record<string, string>): string {
  for (const [name, value] of Object.entries(fields)) {
    fmt = fmt.replaceAll(name, value);
  }
  return fmt;
}

async function render(text: string, uri: string): Promise<Replacement> {
  const inputPath = fileURLToPath(uri);
  const inputDir = dirname(inputPath);
  const inputBase = basename(inputPath);

  const dir = format(normalize(config.rmarkdown.outputDirectory), {
    '{path}': inputPath,
    '{dir}': inputDir,
    '{base}': inputBase,
  });

  const outBaseDir = isAbsolute(dir) ? dir : join(inputDir, dir);
  const outMDPath = join(outBaseDir, 'out.md');
  try {
    const knitScript = `
      library(knitr);
      opts_knit$set(base.dir="${outBaseDir}");
      knit(text=r"--------[${text}]--------", output="${outMDPath}");
    `;
    await mkdir(dirname(outMDPath), { recursive: true });
    await execFile('Rscript', ['-e', knitScript]);
    const mdtext = await readFile(outMDPath, { encoding: 'utf8' });
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
