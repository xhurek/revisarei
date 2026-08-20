const fs = require('fs');
let code = fs.readFileSync('src/lib/supabaseUser.ts', 'utf-8');

code = code.replace(/earnedTitles\?: string\[\];\s*\}/g, 
`earnedTitles?: string[];
    rawStats?: any;
  }`);
fs.writeFileSync('src/lib/supabaseUser.ts', code);
