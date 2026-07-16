/**
 * Generate the Storybook MDX wrapper pages that surface all repo documentation
 * inside the explorer:
 *   - `Documentation/*`      from docs/*.md
 *   - `Documentation/ADRs/*` from docs/adr/*.md
 *   - `Internals/*`          from the bundled TypeDoc markdown
 *     (.storybook/generated/internals/*.md, produced by `npm run docs`)
 *
 * Each wrapper imports its markdown as a raw string and renders it via the
 * Storybook `Markdown` doc block (so hand-written specs and generated API docs
 * are rendered as DATA — no MDX parsing of their contents). Output is written to
 * .storybook/generated/docs/ (gitignored); regenerate by re-running this script.
 */
import { readdirSync, existsSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../..');
const OUT = path.resolve(here, '../generated/docs');

// Skip planning/working docs that aren't reference documentation.
const DOC_SKIP = new Set(['README.md', 'activity-bar-plan.md', 'high-impact-features-report.md']);

const INTERNALS_TITLES = {
  hooks: 'Hooks',
  contexts: 'Contexts',
  scheduler: 'Scheduler & messaging',
  rules: 'Rules engine',
  'storage-cache': 'Storage & cache',
  utils: 'Shared utilities',
  types: 'Types',
  background: 'Background service worker',
  content: 'Content script',
  'shared-misc': 'Shared (other)',
};

const titleCase = (slug) => slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** MDX that renders `importPath` (a `?raw` markdown import) under `title`. */
function page(title, importPath, note) {
  return `import { Meta, Markdown } from '@storybook/addon-docs/blocks';
import content from '${importPath}?raw';

{/* ${note} */}

<Meta title="${title}" />

<Markdown>{content}</Markdown>
`;
}

function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  let n = 0;

  // Documentation/* from docs/*.md
  for (const file of readdirSync(path.join(REPO, 'docs')).filter((f) => f.endsWith('.md'))) {
    if (DOC_SKIP.has(file)) continue;
    const slug = file.replace(/\.md$/, '');
    const title = `Documentation/${titleCase(slug)}`;
    writeFileSync(
      path.join(OUT, `documentation-${slug}.mdx`),
      page(
        title,
        `../../../docs/${file}`,
        `Renders docs/${file}. Edit the source markdown, not this generated wrapper.`,
      ),
    );
    n++;
  }

  // Documentation/ADRs/* from docs/adr/*.md
  for (const file of readdirSync(path.join(REPO, 'docs/adr')).filter((f) => f.endsWith('.md'))) {
    const slug = file.replace(/\.md$/, '');
    const title = `Documentation/ADRs/${titleCase(slug)}`;
    writeFileSync(
      path.join(OUT, `adr-${slug}.mdx`),
      page(title, `../../../docs/adr/${file}`, `Renders docs/adr/${file}.`),
    );
    n++;
  }

  // Internals/* from the bundled TypeDoc markdown (if generated).
  const internalsDir = path.resolve(here, '../generated/internals');
  if (existsSync(internalsDir)) {
    for (const file of readdirSync(internalsDir).filter((f) => f.endsWith('.md'))) {
      const slug = file.replace(/\.md$/, '');
      const title = `Internals/${INTERNALS_TITLES[slug] || titleCase(slug)}`;
      writeFileSync(
        path.join(OUT, `internals-${slug}.mdx`),
        page(
          title,
          `../internals/${file}`,
          `Auto-generated API reference (TypeDoc → markdown). Run \`npm run docs\` to refresh.`,
        ),
      );
      n++;
    }
  } else {
    // eslint-disable-next-line no-console
    console.warn(
      '[gen-doc-pages] no internals bundles found — run `npm run docs` first for the Internals section.',
    );
  }

  // eslint-disable-next-line no-console
  console.log(`[gen-doc-pages] wrote ${n} MDX doc pages to ${OUT}`);
}

main();
