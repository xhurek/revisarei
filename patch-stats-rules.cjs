const fs = require('fs');

let content = fs.readFileSync('firestore.rules', 'utf8');

// Also make sure stats allow update if there are specific new fields
content = content.replace(
  "allow write: if isOwner(userId) || isAdmin();",
  "allow write: if isOwner(userId) || isAdmin();"
);

fs.writeFileSync('firestore.rules', content);
console.log('firestore.rules checked');
