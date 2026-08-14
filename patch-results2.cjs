const fs = require('fs');

let content = fs.readFileSync('src/components/ResultsView.tsx', 'utf8');

content = content.replace(
  "tag: info.topic || results.tag || 'Geral'",
  "tag: results.title || info.topic || results.tag || 'Caderno de Erros',\n            subtag: 'Erros'"
);
content = content.replace(
  "tag: info.topic || results.tag || 'Geral'",
  "tag: results.title || info.topic || results.tag || 'Caderno de Erros',\n            subtag: 'Erros'"
);

fs.writeFileSync('src/components/ResultsView.tsx', content);
console.log('Results patched correctly');
