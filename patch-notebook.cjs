const fs = require('fs');
let content = fs.readFileSync('src/components/PlannerWidget.tsx', 'utf8');

content = content.replace(
  '<motion.div \n            initial={{ opacity: 0, y: 10, scale: 0.95 }}\n            animate={{ opacity: 1, y: 0, scale: 1 }}\n            exit={{ opacity: 0, scale: 0.95 }}\n            className="bg-amber-50 rounded-2xl p-6 border border-amber-200 shadow-sm flex flex-col min-h-[300px]"\n          >',
  '<motion.div \n            initial={{ opacity: 0, y: 10, scale: 0.95 }}\n            animate={{ opacity: 1, y: 0, scale: 1 }}\n            exit={{ opacity: 0, scale: 0.95 }}\n            className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col min-h-[250px]"\n          >'
);

content = content.replace(
  'className="bg-amber-50 rounded-2xl p-6 border border-amber-200 shadow-sm flex flex-col min-h-[300px]"',
  'className="bg-amber-50 rounded-2xl p-5 border border-amber-200 shadow-sm flex flex-col min-h-[250px]"'
);

content = content.replace(
  '<div className="flex-1 space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">',
  '<div className="flex-1 space-y-2 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">'
);

fs.writeFileSync('src/components/PlannerWidget.tsx', content);
