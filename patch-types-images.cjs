const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');
content = content.replace(
  '  explanation?: string;\n  category?: string;\n}',
  '  explanation?: string;\n  category?: string;\n  images?: string[];\n}'
);
fs.writeFileSync('src/types.ts', content);
