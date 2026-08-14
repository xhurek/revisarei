const fs = require('fs');
let content = fs.readFileSync('src/components/PlannerWidget.tsx', 'utf8');
content = content.replace(
  '<div className="flex flex-col gap-6 h-full">',
  '<div className="flex flex-col gap-4">'
);
fs.writeFileSync('src/components/PlannerWidget.tsx', content);
