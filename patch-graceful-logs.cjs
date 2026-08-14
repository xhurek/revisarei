const fs = require('fs');

function patchFile(file, replacer) {
  let content = fs.readFileSync(file, 'utf8');
  content = replacer(content);
  fs.writeFileSync(file, content);
}

patchFile('src/components/Dashboard.tsx', (c) => 
  c.replace(
    `      console.error("Error listening to stats:", err);`,
    `      if (err.code === 'permission-denied') {
        console.warn("Stats subscription closed (permission-denied). Expected during logout.");
      } else {
        console.error("Error listening to stats:", err);
      }`
  )
);

patchFile('src/App.tsx', (c) => 
  c.replace(
    `        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'notifications');
        });`,
    `        }, (err: any) => {
          if (err.code === 'permission-denied') {
            console.warn("Notifications subscription closed (permission-denied). Expected during logout.");
          } else {
            handleFirestoreError(err, OperationType.GET, 'notifications');
          }
        });`
  )
);

console.log('Patched graceful logs');
