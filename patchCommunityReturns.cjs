const fs = require('fs');
let code = fs.readFileSync('src/components/CommunityView.tsx', 'utf-8');

code = code.replace(/\/\/ If Supabase returned items, use them![\s\S]*?return;\s*\}/m, '');

fs.writeFileSync('src/components/CommunityView.tsx', code);
