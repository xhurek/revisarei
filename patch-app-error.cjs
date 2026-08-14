const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(
  `        }, (err) => {
          console.error("User profile subscription error:", err);
        });`,
  `        }, (err: any) => {
          if (err.code === 'permission-denied') {
            console.warn("User profile subscription closed (permission-denied). This is expected during logout.");
          } else {
            console.error("User profile subscription error:", err);
          }
        });`
);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx error logging patched');
