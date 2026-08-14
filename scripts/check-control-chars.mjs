/**
 * Fail if any tracked text file contains a raw control byte.
 *
 * Why this exists: `src/sidepanel/hooks/useAppsData.ts` carried a literal NUL
 * inside a template string (`${targetTabId}<NUL>${origin}`) as a key separator.
 * It worked at runtime, but it made the file **binary** as far as `grep(1)` is
 * concerned — and grep silently skips binary files rather than warning. Every
 * grep-based scan therefore had a blind spot: `git grep`, `knip`, ripgrep, and
 * any human or agent searching the tree all reported "no matches" for symbols
 * that were plainly there.
 *
 * The six-character escape compiles to exactly the same runtime string and
 * keeps the file text. There is no reason to ever write the raw byte.
 *
 * Allowed: tab (0x09), newline (0x0A), carriage return (0x0D).
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** Extensions worth checking — source and config, not fixtures or binaries. */
const CHECKED = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|css|html|yml|yaml)$/;

/** Control bytes that are legitimate in a text file. */
const ALLOWED = new Set([0x09, 0x0a, 0x0d]);

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && CHECKED.test(f));

const offenders = [];
for (const file of files) {
  const buf = readFileSync(file);
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    if (byte < 0x20 && !ALLOWED.has(byte)) {
      const line = buf.subarray(0, i).toString('utf8').split('\n').length;
      offenders.push({ file, line, byte });
      break; // one report per file is enough to act on
    }
  }
}

if (offenders.length > 0) {
  console.error('Raw control bytes found in tracked text files:\n');
  for (const { file, line, byte } of offenders) {
    console.error(`  ${file}:${line} — byte 0x${byte.toString(16).padStart(2, '0')}`);
  }
  console.error('\nUse an escape sequence instead. A raw control byte makes the file');
  console.error('binary to grep(1), which then skips it silently.');
  process.exit(1);
}

console.log(`No raw control bytes in ${files.length} tracked text files.`);
