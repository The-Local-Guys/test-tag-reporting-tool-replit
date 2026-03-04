const XLSX = require('xlsx');
const wb = XLSX.readFile('client/public/Untitled spreadsheet.xlsx');
const ws = wb.Sheets['RCD Template'];
console.log('Merges:', JSON.stringify(ws['!merges']));
console.log('ColWidths:', JSON.stringify(ws['!cols']));
console.log('All non-empty cells:');
Object.keys(ws).filter(k => !k.startsWith('!')).forEach(k => {
  if (ws[k].v !== undefined && ws[k].v !== '') {
    console.log('  Cell', k, ':', JSON.stringify(ws[k].v), '| type:', ws[k].t);
  }
});
