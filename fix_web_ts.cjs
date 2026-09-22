const fs = require('fs');
let types = fs.readFileSync('src/app/api/types.ts', 'utf8');
types = types.replace(
  'totalSGST: number;',
  'totalSGST: number;\n  totalDiscount?: number;'
);
fs.writeFileSync('src/app/api/types.ts', types);
