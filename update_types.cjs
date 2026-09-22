const fs = require('fs');
const file = 'src/app/api/types.ts';
let content = fs.readFileSync(file, 'utf8');
content = content.replace("'classic' | 'modern' | 'minimal' | 'bold';", "'classic' | 'modern' | 'minimal' | 'bold' | 'custom_html';");
fs.writeFileSync(file, content);
