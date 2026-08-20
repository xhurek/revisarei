const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/dragDistanceRef\.current \+= Math\.abs\(walk\);/g, 
`dragDistanceRef.current = Math.abs(x - startX);`);

fs.writeFileSync('src/App.tsx', code);
