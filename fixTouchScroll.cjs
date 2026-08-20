const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// Remove touch events from the nav
code = code.replace(/onTouchStart=\{handleTouchStart\}/g, '');
code = code.replace(/onTouchMove=\{handleTouchMove\}/g, '');
code = code.replace(/onTouchEnd=\{handleTouchEnd\}/g, '');

// Also, the onClick handlers inside NavButtons should check dragDistanceRef.current > 10,
// but since we removed touch tracking for dragDistanceRef, mobile clicks will just have dragDistanceRef.current = 0, which is perfect!

fs.writeFileSync('src/App.tsx', code);
