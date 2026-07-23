const fs = require('fs');

// 1. AdvancedPdfBatchImport.tsx
let adv = fs.readFileSync('src/components/AdvancedPdfBatchImport.tsx', 'utf8');

const base64Regex = /const fileToBase64 = \(file: File\): Promise<string> => new Promise\(\(resolve, reject\) => \{[\s\S]*?reader\.readAsDataURL\(file\);\n\}\);\n/;
adv = adv.replace(base64Regex, '');

const uploadAdvRegex = /const base64Data = await fileToBase64\(file\);\s*let uploadRes;\s*try \{\s*uploadRes = await apiFetch\('\/api\/upload-context', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*files: \[\{ name: file\.name, mimeType: file\.type \|\| 'application\/pdf', data: base64Data \}\]\s*\}\)\s*\}\);\s*\}/;

const uploadAdvReplacement = `const formData = new FormData();
      formData.append('files', file);
      
      let uploadRes;
      try {
        uploadRes = await apiFetch('/api/upload-context', {
          method: 'POST',
          body: formData
        });
      }`;
adv = adv.replace(uploadAdvRegex, uploadAdvReplacement);
fs.writeFileSync('src/components/AdvancedPdfBatchImport.tsx', adv);


// 2. QuizzesView.tsx
let qv = fs.readFileSync('src/components/QuizzesView.tsx', 'utf8');
qv = qv.replace(base64Regex, '');

const uploadQvRegex = /const filesArray = \[\];\s*for \(let i=0; i<files\.length; i\+\+\) \{\s*const b64 = await fileToBase64\(files\[i\]\);\s*filesArray\.push\(\{ name: files\[i\]\.name, mimeType: files\[i\]\.type \|\| 'application\/octet-stream', data: b64 \}\);\s*\}\s*try \{\s*const res = await apiFetch\('\/api\/upload-context', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ files: filesArray \}\)\s*\}\);/;

const uploadQvReplacement = `const formData = new FormData();
    for (let i=0; i<files.length; i++) {
       formData.append('files', files[i]);
    }
    
    try {
      const res = await apiFetch('/api/upload-context', {
         method: 'POST',
         body: formData
      });`;
qv = qv.replace(uploadQvRegex, uploadQvReplacement);
fs.writeFileSync('src/components/QuizzesView.tsx', qv);

// 3. FlashcardsRoom.tsx
let fr = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf8');
fr = fr.replace(base64Regex, '');

const uploadFrRegex = /const base64Data = await fileToBase64\(file\);\s*try \{\s*const res = await apiFetch\('\/api\/import-anki', \{ \s*method: 'POST', \s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{ fileName: file\.name, fileData: base64Data \}\) \s*\}\);/;

const uploadFrReplacement = `const formData = new FormData();
    formData.append('ankiFile', file);

    try {
      const res = await apiFetch('/api/import-anki', { 
        method: 'POST', 
        body: formData 
      });`;
fr = fr.replace(uploadFrRegex, uploadFrReplacement);
fs.writeFileSync('src/components/FlashcardsRoom.tsx', fr);

