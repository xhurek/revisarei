const fs = require('fs');

let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  "allow update: if (isOwner(userId) && incoming().diff(existing()).affectedKeys().hasOnly(['folderColors'])) || isAdmin();",
  "allow update: if (isOwner(userId) && incoming().diff(existing()).affectedKeys().hasOnly(['folderColors', 'earnedTitles', 'title'])) || isAdmin();"
);

fs.writeFileSync('firestore.rules', content);
console.log('firestore.rules patched');
