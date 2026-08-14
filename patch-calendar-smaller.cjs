const fs = require('fs');
let content = fs.readFileSync('src/components/PlannerWidget.tsx', 'utf8');

content = content.replace(
  'days.push(<div key={`empty-${i}`} className="w-6 h-6 sm:w-8 sm:h-8"></div>);',
  'days.push(<div key={`empty-${i}`} className="w-5 h-5 sm:w-6 sm:h-6"></div>);'
);

content = content.replace(
  '"relative w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center rounded-full text-xs font-medium transition-colors cursor-pointer",',
  '"relative w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full text-[10px] sm:text-xs font-medium transition-colors cursor-pointer",'
);

content = content.replace(
  '<div className="grid grid-cols-7 gap-1 mb-2 text-center text-xs font-bold text-slate-400">',
  '<div className="grid grid-cols-7 gap-1 mb-1 text-center text-[10px] font-bold text-slate-400">'
);

fs.writeFileSync('src/components/PlannerWidget.tsx', content);
