import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const pages = [
  {
    source: 'index.html',
    destination: 'shoaling-animation.html',
    styles: ['styles.css'],
    scripts: ['physics.js', 'app.js'],
    links: [{ source: 'vergleich.html', destination: 'kuestenvergleich.html' }],
  },
  {
    source: 'vergleich.html',
    destination: 'kuestenvergleich.html',
    styles: ['styles.css', 'comparison.css'],
    scripts: ['regional-physics.js', 'comparison.js'],
    links: [],
  },
];

async function readResource(filename) {
  try {
    return await readFile(path.join(root, filename), 'utf8');
  } catch (error) {
    throw new Error(`Export nicht möglich: Ressource "${filename}" konnte nicht gelesen werden (${error.code ?? error.message}).`, { cause: error });
  }
}

function replaceExactlyOnce(html, marker, replacement, source) {
  const count = html.split(marker).length - 1;
  if (count !== 1) {
    throw new Error(`Export nicht möglich: In "${source}" wurde "${marker}" ${count}-mal gefunden; erwartet wird genau ein Vorkommen.`);
  }
  return html.replace(marker, () => replacement);
}

async function buildStandalone(page) {
  const filenames = [page.source, ...page.styles, ...page.scripts];
  const contents = await Promise.all(filenames.map(readResource));
  const resources = Object.fromEntries(filenames.map((filename, index) => [filename, contents[index]]));
  let html = resources[page.source];

  for (const link of page.links) {
    html = replaceExactlyOnce(html, `href="${link.source}"`, `href="${link.destination}"`, page.source);
  }
  for (const filename of page.styles) {
    html = replaceExactlyOnce(html, `<link rel="stylesheet" href="${filename}">`, `<style>\n${resources[filename]}\n</style>`, page.source);
  }
  for (const filename of page.scripts) {
    html = replaceExactlyOnce(html, `<script src="${filename}" defer></script>`, '', page.source);
  }
  // Run classic scripts after the DOM exists, including when opened with file://.
  const scripts = page.scripts.map((filename) => {
    const source = resources[filename].replace(/<\/script/gi, '<\\/script');
    return `<script>\n${source}\n</script>`;
  }).join('\n');
  html = replaceExactlyOnce(html, '</body>', `${scripts}\n</body>`, page.source);
  html = html.replace(/^[ \t]+$/gm, '');
  return { destination: path.join(root, 'dist', page.destination), html };
}

// Validate all resources before writing either shareable, self-contained file.
const exports = await Promise.all(pages.map(buildStandalone));
await mkdir(path.join(root, 'dist'), { recursive: true });
for (const { destination, html } of exports) {
  await writeFile(destination, html, 'utf8');
  console.log(`Einzeldatei erstellt: ${destination}`);
}
