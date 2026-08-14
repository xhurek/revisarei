const fs = require('fs');

let content = fs.readFileSync('src/components/ZipBatchImport.tsx', 'utf8');

// Replace the zip loading part with JSZip
content = content.replace(
  "const formData = new FormData();\n      formData.append('file', file);\n\n      const zipRes = await apiFetch('/api/upload-zip-context', {\n        method: 'POST',\n        body: formData\n      });\n      const zipData = await parseJsonResponse(zipRes);\n      \n      const pdfFiles = zipData.files;\n      if (!pdfFiles || pdfFiles.length === 0) {\n        throw new Error(\"Nenhum PDF encontrado no arquivo ZIP.\");\n      }",
  `import JSZip from 'jszip';
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(file);
      
      const pdfEntries = [];
      zipContent.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath.toLowerCase().endsWith('.pdf')) {
          pdfEntries.push(zipEntry);
        }
      });
      
      if (pdfEntries.length === 0) {
        throw new Error("Nenhum PDF encontrado no arquivo ZIP.");
      }`
);

// Modify the loop to upload each file
content = content.replace(
  "for (let i = 0; i < pdfFiles.length; i++) {\n        if (shouldStopRef.current) break;\n        const currentPdf = pdfFiles[i];\n        \n        setStatusText(`Analisando PDF ${i + 1} de ${pdfFiles.length}...`);",
  `for (let i = 0; i < pdfEntries.length; i++) {
        if (shouldStopRef.current) break;
        const zipEntry = pdfEntries[i];
        
        setStatusText(\`Fazendo upload e analisando PDF \${i + 1} de \${pdfEntries.length} (\${zipEntry.name})...\`);
        
        // 1. Upload the PDF to Gemini
        const pdfBlob = await zipEntry.async("blob");
        const formData = new FormData();
        formData.append('files', pdfBlob, zipEntry.name);
        
        const uploadRes = await apiFetch('/api/upload-context', {
          method: 'POST',
          body: formData
        });
        const uploadData = await parseJsonResponse(uploadRes);
        const currentPdf = uploadData.files[0];`
);

// update length variables
content = content.replace(
  "setTotalFiles(pdfFiles.length);\n      setStatusText(`Processando ${pdfFiles.length} PDFs...`);",
  "setTotalFiles(pdfEntries.length);\n      setStatusText(`Processando ${pdfEntries.length} PDFs...`);"
);

content = content.replace(
  "setProgress(Math.round(((i + 1) / pdfFiles.length) * 100));",
  "setProgress(Math.round(((i + 1) / pdfEntries.length) * 100));"
);

fs.writeFileSync('src/components/ZipBatchImport.tsx', content);
console.log('ZipBatchImport patched');
