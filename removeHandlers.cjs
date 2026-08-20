const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/const handleTouchStart = \(e: React\.TouchEvent\) => \{[\s\S]*?const handleTouchEnd = \(\) => \{\s*setIsDraggingMenu\(false\);\s*\};/m, '');

fs.writeFileSync('src/App.tsx', code);
