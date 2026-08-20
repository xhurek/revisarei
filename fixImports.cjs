const fs = require('fs');

let fc = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf-8');
if (!fc.includes("from '../lib/supabase'")) {
  fc = "import { supabase, toValidUUID } from '../lib/supabase';\n" + fc;
  fs.writeFileSync('src/components/FlashcardsRoom.tsx', fc);
}

let pw = fs.readFileSync('src/components/PlannerWidget.tsx', 'utf-8');
if (!pw.includes("from '../lib/supabase'")) {
  pw = "import { supabase, toValidUUID } from '../lib/supabase';\n" + pw;
  fs.writeFileSync('src/components/PlannerWidget.tsx', pw);
}
console.log('Imports fixed');
