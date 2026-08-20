const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

code = code.replace(/await updateUserProgressInSupabase\(auth\.currentUser\.uid, \{\s*xpIncrement: xpGained,\s*streak: latestStats\.streak,\s*lastStudyDate: new Date\(\)\.toISOString\(\),\s*title: currentTitle,\s*earnedTitles: earned\s*\}\);/g, 
`await updateUserProgressInSupabase(auth.currentUser.uid, {
              xpIncrement: xpGained,
              streak: latestStats.streak,
              lastStudyDate: new Date().toISOString(),
              title: currentTitle,
              earnedTitles: earned,
              rawStats: latestStats
            });`);

code = code.replace(/await updateUserProgressInSupabase\(auth\.currentUser\.uid, \{\s*xpIncrement: xpGained,\s*streak: statsData\.streak,\s*lastStudyDate: new Date\(\)\.toISOString\(\),\s*title: currentTitle,\s*earnedTitles: earned\s*\}\);/g,
`await updateUserProgressInSupabase(auth.currentUser.uid, {
              xpIncrement: xpGained,
              streak: statsData.streak,
              lastStudyDate: new Date().toISOString(),
              title: currentTitle,
              earnedTitles: earned,
              rawStats: statsData
            });`);

fs.writeFileSync('src/App.tsx', code);
