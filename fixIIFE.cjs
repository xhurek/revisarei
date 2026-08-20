const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf-8');

code = code.replace(/\/\/ Fallback para Firebase/g, 
`      })(); // END OF IIFE\n      // Fallback para Firebase`);

fs.writeFileSync('src/components/Dashboard.tsx', code);
