const fs = require('fs');
let content = fs.readFileSync('firestore.rules', 'utf8');

// Also make sure stats allow update if there are specific new fields
content = content.replace(
  "      match /stats/{statId} {",
  `      match /planner/{dateId} {
        allow read, write: if isOwner(userId) || isAdmin();
      }
      match /stats/{statId} {`
);

fs.writeFileSync('firestore.rules', content);
console.log('firestore.rules patched for planner');
