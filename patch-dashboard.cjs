const fs = require('fs');

let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// 1. Import PlannerWidget
if (!content.includes('PlannerWidget')) {
  content = content.replace(
    "import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';",
    "import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';\nimport { PlannerWidget } from './PlannerWidget';"
  );
}

// 2. Change wrapper
// Old: <div className="space-y-8 w-full max-w-4xl mx-auto">
// New: <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full max-w-6xl mx-auto">\n  <div className="xl:col-span-2 space-y-8">
content = content.replace(
  '<div className="space-y-8 w-full max-w-4xl mx-auto">',
  '<div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full max-w-7xl mx-auto">\n      <div className="xl:col-span-2 space-y-8">'
);

// 3. Close the left column div and add right column div
// At the end of Dashboard.tsx, the last lines are:
//     </div>
//   );
// }
const closingPattern = `    </div>
  );
}`;

content = content.replace(
  closingPattern,
  `      </div>
      <div className="xl:col-span-1">
        <PlannerWidget />
      </div>
    </div>
  );
}`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('Dashboard.tsx patched with PlannerWidget');
