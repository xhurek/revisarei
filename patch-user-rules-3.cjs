const fs = require('fs');

let content = fs.readFileSync('firestore.rules', 'utf8');

content = content.replace(
  "allow create: if isOwner(userId);",
  "allow create: if isOwner(userId) && (isAdmin() || incoming().authorized == false);"
);

fs.writeFileSync('firestore.rules', content);
console.log('firestore.rules patched for create');
