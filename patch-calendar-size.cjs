const fs = require('fs');
let content = fs.readFileSync('src/components/PlannerWidget.tsx', 'utf8');

content = content.replace(
  'days.push(<div key={`empty-${i}`} className="w-8 h-8 sm:w-10 sm:h-10"></div>);',
  'days.push(<div key={`empty-${i}`} className="w-6 h-6 sm:w-8 sm:h-8"></div>);'
);

content = content.replace(
  '"relative w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full text-sm font-medium transition-colors cursor-pointer",',
  '"relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors cursor-pointer",'
);

content = content.replace(
  '<div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm font-sans flex flex-col h-full">',
  '<div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm font-sans flex flex-col h-auto">' // changed from h-full to h-auto to make it compact
);

content = content.replace(
  '<div className="flex justify-between items-center mb-6">',
  '<div className="flex justify-between items-center mb-3">'
);

content = content.replace(
  '<h3 className="font-bold text-slate-900 text-lg capitalize">',
  '<h3 className="font-bold text-slate-900 text-base capitalize">'
);

fs.writeFileSync('src/components/PlannerWidget.tsx', content);
console.log("calendar size patched");
