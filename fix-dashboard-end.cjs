const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

content = content.replace(
  `      </div>
      <div className="xl:col-span-1">
        <PlannerWidget />
      </div>
    </div>
  );
}`,
  `      </div>
      <div className="xl:col-span-1">
        <PlannerWidget />
      </div>
    </div>
    </div>
  );
}`
);

fs.writeFileSync('src/components/Dashboard.tsx', content);
