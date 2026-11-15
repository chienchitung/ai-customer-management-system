import { inflateRawSync } from 'zlib';

// Minimal ZIP reader for ComPDF results, which arrive as a ZIP holding the .md/.txt output
// plus page images. Reads the central directory, so entries written with a data descriptor
// (sizes zeroed in the local header) are handled too. Supports stored and deflated entries.

export const isZip = (buf: Buffer) => buf.length > 4 && buf.readUInt32LE(0) === 0x04034b50;

export interface ZipEntry { name: string; data: () => Buffer }

export const readZip = (buf: Buffer): ZipEntry[] => {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: end of central directory not found');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('zip: bad central directory');
    const flags = buf.readUInt16LE(p + 8);
    const method = buf.readUInt16LE(p + 10);
    const compressedSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString(flags & 0x800 ? 'utf8' : 'latin1');
    entries.push({
      name,
      data: () => {
        const start = localOffset + 30 + buf.readUInt16LE(localOffset + 26) + buf.readUInt16LE(localOffset + 28);
        const raw = buf.subarray(start, start + compressedSize);
        if (method === 0) return Buffer.from(raw);
        if (method === 8) return inflateRawSync(raw);
        throw new Error(`zip: unsupported compression method ${method}`);
      },
    });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
};

/** Returns the text output from a ComPDF result: the file itself, or the .md/.txt inside a ZIP. */
export const textFromResult = (buf: Buffer): string => {
  if (!isZip(buf)) return buf.toString('utf8');
  const entries = readZip(buf).filter(e => /\.(md|markdown|txt)$/i.test(e.name) && !e.name.endsWith('/'));
  if (!entries.length) throw new Error('zip: no text file in result');
  // Several files appear only when output is split per page; keep page order.
  return entries.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })).map(e => e.data().toString('utf8')).join('\n\n');
};

const cellText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');

/** ComPDF writes tables as styled HTML; a Markdown table carries the same content in a fraction of the tokens. */
export const htmlTablesToMarkdown = (text: string) =>
  text.replace(/<table[\s\S]*?<\/table>/gi, table => {
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(([row]) =>
      [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(([, cell]) => cellText(cell)));
    if (!rows.length) return cellText(table);
    const width = Math.max(...rows.map(r => r.length));
    const line = (r: string[]) => `| ${[...r, ...Array(width - r.length).fill('')].join(' | ')} |`;
    return ['', line(rows[0]), `|${' --- |'.repeat(width)}`, ...rows.slice(1).map(line), ''].join('\n');
  });
