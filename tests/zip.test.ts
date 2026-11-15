import { describe, it, expect } from 'vitest';
import { deflateRawSync } from 'zlib';
import { htmlTablesToMarkdown, isZip, readZip, textFromResult } from '../server/zip';

// Builds a ZIP the way ComPDF does: deflated entries, UTF-8 names, data-descriptor flag set
// (sizes zeroed in the local header, real sizes only in the central directory).
const makeZip = (files: { name: string; data: Buffer; store?: boolean }[]) => {
  const locals: Buffer[] = []; const centrals: Buffer[] = []; let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const body = f.store ? f.data : deflateRawSync(f.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(0x808, 6); local.writeUInt16LE(f.store ? 0 : 8, 8);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(0x808, 8); central.writeUInt16LE(f.store ? 0 : 8, 10);
    central.writeUInt32LE(body.length, 20); central.writeUInt32LE(f.data.length, 24); central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
};

describe('ComPDF result reader', () => {
  it('pulls the Markdown out of a ZIP with images, in page order', () => {
    const zip = makeZip([
      { name: 'images/image0.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), store: true },
      { name: 'out_10.md', data: Buffer.from('第十頁') },
      { name: 'out_2.md', data: Buffer.from('# 採購單 PO-2026-118\n總計 USD 92,000') },
    ]);
    expect(isZip(zip)).toBe(true);
    expect(readZip(zip).map(e => e.name)).toEqual(['images/image0.png', 'out_10.md', 'out_2.md']);
    expect(textFromResult(zip)).toBe('# 採購單 PO-2026-118\n總計 USD 92,000\n\n第十頁');
  });

  it('passes plain text results through and rejects a ZIP without text', () => {
    expect(textFromResult(Buffer.from('plain text'))).toBe('plain text');
    expect(() => textFromResult(makeZip([{ name: 'a.png', data: Buffer.from('x') }]))).toThrow(/no text file/);
  });

  it('turns ComPDF styled HTML tables into compact Markdown tables', () => {
    const html = '<table style="x"><tr><td style="border:1px"><p style="">品項</p></td><td><p>小計 | USD</p></td></tr>'
      + '<tr><td><p>License&nbsp;x40</p></td><td><p>80,000</p></td></tr><tr><td colspan="2">Total 92,000</td></tr></table>';
    expect(htmlTablesToMarkdown(`before\n${html}\nafter`)).toBe(
      'before\n\n| 品項 | 小計 \\| USD |\n| --- | --- |\n| License x40 | 80,000 |\n| Total 92,000 |  |\n\nafter',
    );
  });
});
