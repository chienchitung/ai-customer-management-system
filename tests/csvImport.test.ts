import { describe, it, expect } from 'vitest';
import { buildImport, parseCsv, csvTemplate } from '../lib/csvImport';
import { exportCSV } from '../lib/storage';
import { Customer, CustomerStatus } from '../types';

const existing: Customer[] = [{
  id: 'x', name: 'Eleanor Vance', company: 'Innovate Corp', email: 'eleanor@innovate.com',
  status: CustomerStatus.PROSPECT, lastContact: '2026-09-01', interactions: [],
}];

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, commas, CRLF, BOM and blank lines', () => {
    const rows = parseCsv('\uFEFFa,b\r\n"x, y","say ""hi"""\r\n\r\n"multi\nline",z');
    expect(rows).toEqual([['a', 'b'], ['x, y', 'say "hi"'], ['multi\nline', 'z']]);
  });
});

describe('buildImport', () => {
  it('maps Chinese headers and stage names, parses amounts and dates', () => {
    const p = buildImport('姓名,公司,信箱,階段,金額,幣別,下一步,到期日,備註\n王小明,範例科技,ming@ex.com,談判中,"1,200",twd,寄報價,2026/10/5,展會認識', [], '2026-10-01');
    expect(p.issues).toEqual([]);
    const c = p.customers[0];
    expect(c).toMatchObject({ name: '王小明', company: '範例科技', email: 'ming@ex.com', status: CustomerStatus.NEGOTIATION, dealValue: 1200, dealCurrency: 'TWD' });
    expect(c.nextAction).toEqual({ description: '寄報價', dueDate: '2026-10-05' });
    expect(c.interactions[0].summary).toBe('展會認識');
  });

  it('reports invalid rows with their row number and skips duplicates', () => {
    const csv = [
      'Name,Company,Email,Deal Value,Due Date',
      ',NoName Co,,,',
      'No Company,,,,',
      'Bad Mail,Co,not-an-email,,',
      'Neg,Co,,-5,',
      'Bad Date,Co,,,2026-13-40',
      'Eleanor Vance,Innovate Corp,,,',       // duplicate by name+company
      'Someone,Other,ELEANOR@innovate.com,,', // duplicate by email (case-insensitive)
      'Ok One,Co,ok@co.com,,',
      'Ok One,Co,,,',                         // duplicate within the file
    ].join('\n');
    const p = buildImport(csv, existing);
    expect(p.customers.map(c => c.name)).toEqual(['Ok One']);
    expect(p.issues.map(i => [i.row, i.reason])).toEqual([
      [2, 'missingName'], [3, 'missingCompany'], [4, 'badEmail'], [5, 'badAmount'], [6, 'badDate'],
      [7, 'duplicate'], [8, 'duplicate'], [10, 'duplicateInFile'],
    ]);
  });

  it('round-trips the app\'s own CSV export and the template', () => {
    const exported = exportCSV([{ ...existing[0], id: 'y', name: 'New Person', email: 'new@p.com', dealValue: 10, dealCurrency: 'EUR', nextAction: { description: 'Call', dueDate: '2026-10-09' } }]);
    const p = buildImport(exported, []);
    expect(p.customers[0]).toMatchObject({ name: 'New Person', status: CustomerStatus.PROSPECT, dealValue: 10, dealCurrency: 'EUR', nextAction: { description: 'Call', dueDate: '2026-10-09' } });
    expect(buildImport(csvTemplate('zh'), []).customers).toHaveLength(1);
    expect(buildImport(csvTemplate('en'), []).customers).toHaveLength(1);
  });
});
