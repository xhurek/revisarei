const fs = require('fs');
let content = fs.readFileSync('src/components/ZipBatchImport.tsx', 'utf8');

content = content.replace("import JSZip from 'jszip';", "");
content = "import JSZip from 'jszip';\n" + content;

fs.writeFileSync('src/components/ZipBatchImport.tsx', content);
