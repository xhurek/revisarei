const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// 1. Add express.urlencoded and keep limit 100mb
code = code.replace(/app\.use\(express\.json\(\{ limit: '100mb' \}\)\);/, "app.use(express.json({ limit: '100mb' }));\n  app.use(express.urlencoded({ limit: '100mb', extended: true }));\n\n  const upload = multer({ storage: multer.memoryStorage() });\n  const diskUpload = multer({ dest: os.tmpdir() });");

// 2. Fix /api/upload-context to use diskUpload and FormData
const uploadContextRegex = /app\.post\("\/api\/upload-context", verifyFirebaseToken, async \(req: any, res: any\) => \{[\s\S]*?res\.json\(\{ files: results \}\);\n    \} catch \(error: any\) \{[\s\S]*?res\.status\(500\)\.json\(\{ error: error\.message \}\);\n    \}\n  \}\);/;

const uploadContextReplacement = `app.post("/api/upload-context", verifyFirebaseToken, diskUpload.array('files', 10), async (req: any, res: any) => {
    try {
      const files = req.files as Express.Multer.File[];
      const results = [];
      if (files) {
        for (const file of files) {
          const response = await withRetry(() => ai.files.upload({
              file: file.path,
              config: {
                mimeType: file.mimetype,
                displayName: file.originalname
              }
          }));
          
          results.push({
              name: response.name, 
              uri: response.uri,
              mimeType: response.mimeType,
              displayName: file.originalname,
              expiresAt: Date.now() + 48 * 60 * 60 * 1000
          });
          fs.unlinkSync(file.path);
        }
      }
      res.json({ files: results });
    } catch (error: any) {
      console.error("Error uploading context files:", error);
      res.status(500).json({ error: error.message });
    }
  });`;

code = code.replace(uploadContextRegex, uploadContextReplacement);

// 3. Fix /api/process-pdf to use upload.fields
const processPdfRegex = /app\.post\("\/api\/process-pdf", verifyFirebaseToken, async \(req: any, res: any\) => \{[\s\S]*?try \{[\s\S]*?console\.log\("Processing PDF request\.\.\."\);[\s\S]*?const \{ pdf, answerKey, supportMaterial \} = req\.body;[\s\S]*?const pdfFile = pdf \? \{ buffer: Buffer\.from\(pdf\.data, 'base64'\), mimetype: pdf\.mimeType \} : undefined;[\s\S]*?const answerKeyFile = answerKey \? \{ buffer: Buffer\.from\(answerKey\.data, 'base64'\), mimetype: answerKey\.mimeType \} : undefined;[\s\S]*?const supportFiles = supportMaterial \? supportMaterial\.map\(\(f: any\) => \(\{ buffer: Buffer\.from\(f\.data, 'base64'\), mimetype: f\.mimeType \}\)\) : \[\];/;

const processPdfReplacement = `app.post("/api/process-pdf", verifyFirebaseToken, upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'answerKey', maxCount: 1 },
    { name: 'supportMaterial', maxCount: 5 }
  ]), async (req: any, res: any) => {
    try {
      console.log("Processing PDF request...");
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const pdfFile = files['pdf']?.[0];
      const answerKeyFile = files['answerKey']?.[0];
      const supportFiles = files['supportMaterial'] || [];`;

code = code.replace(processPdfRegex, processPdfReplacement);

// 4. Fix /api/import-anki
const importAnkiRegex = /app\.post\("\/api\/import-anki", async \(req, res\) => \{[\s\S]*?try \{[\s\S]*?const \{ fileName, fileData \} = req\.body;[\s\S]*?if \(!fileData\) \{[\s\S]*?return res\.status\(400\)\.json\(\{ error: "Arquivo \.apkg não fornecido" \}\);[\s\S]*?\}[\s\S]*?const buffer = Buffer\.from\(fileData, "base64"\);[\s\S]*?const file = \{ originalname: fileName, buffer \};/;

const importAnkiReplacement = `app.post("/api/import-anki", upload.single('ankiFile'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Arquivo .apkg não fornecido" });
      }`;

code = code.replace(importAnkiRegex, importAnkiReplacement);

fs.writeFileSync('server.ts', code);
