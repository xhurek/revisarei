const fs = require('fs');

let content = fs.readFileSync('server.ts', 'utf8');

const newEndpoint1 = `
  app.post("/api/upload-zip-context", verifyFirebaseToken, diskUpload.single('file'), async (req: any, res: any) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No zip file uploaded" });

      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      
      const results = [];
      for (const zipEntry of zipEntries) {
        if (!zipEntry.isDirectory && zipEntry.entryName.toLowerCase().endsWith('.pdf')) {
          const pdfBuffer = zipEntry.getData();
          const tempPdfPath = path.join(os.tmpdir(), \`temp-\${Date.now()}-\${Math.random().toString(36).substring(7)}.pdf\`);
          fs.writeFileSync(tempPdfPath, pdfBuffer);
          
          const response = await withRetry(() => ai.files.upload({
              file: tempPdfPath,
              config: {
                mimeType: "application/pdf",
                displayName: zipEntry.entryName
              }
          }));
          
          results.push({
              name: response.name, 
              uri: response.uri,
              mimeType: response.mimeType,
              displayName: zipEntry.entryName,
              expiresAt: Date.now() + 48 * 60 * 60 * 1000
          });
          
          fs.unlinkSync(tempPdfPath);
        }
      }
      fs.unlinkSync(file.path);
      res.json({ files: results });
    } catch (error: any) {
      console.error("Error uploading zip context:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/extract-single-question-and-answer-from-file", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { fileUri, fileMimeType } = req.body;
      if (!fileUri) return res.status(400).json({ error: "fileUri is required" });

      const prompt = \`
        Este documento contém apenas UMA questão, e no final da página (ou do documento) está o gabarito indicando a resposta correta para ela.
        
        Sua tarefa:
        1. Transcreva a questão (enunciado, alternativas).
        2. Identifique o ano e a banca/instituição, se presentes.
        3. Localize o gabarito no final e determine qual é a alternativa correta da questão. Defina isso no campo 'resposta_correta' apenas com a letra (ex: "A", "B", "C", "D", "E").
        
        NÃO tente identificar a área médica ou tópicos, retorne-os sempre vazios.
        
        RECONHECIMENTO DE IMAGENS:
        Caso a questão contiver ou fizer referência a uma imagem, figura, radiografia, tomografia, ultrassom, gráfico, ECG, ecocardiograma ou esquema explicativo, defina 'has_image' como true.
      \`;

      const model = getModelForUser(req.user);

      const response = await withRetry((selectedModel) => ai.models.generateContent({
        model: selectedModel,
        contents: {
          parts: [
            { fileData: { fileUri, mimeType: fileMimeType || "application/pdf" } },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questoes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    numero: { type: Type.STRING },
                    enunciado: { type: Type.STRING },
                    alternativas: { type: Type.ARRAY, items: { type: Type.STRING } },
                    banca: { type: Type.STRING },
                    ano: { type: Type.STRING },
                    area_medica: { type: Type.STRING },
                    topicos: { type: Type.ARRAY, items: { type: Type.STRING } },
                    has_image: { type: Type.BOOLEAN },
                    descricao_da_imagem: { type: Type.STRING },
                    resposta_correta: { type: Type.STRING }
                  }
                }
              }
            }
          }
        }
      }));

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Error extracting question and answer:", error);
      res.status(500).json({ error: error.message });
    }
  });
`;

content = content.replace(
  '// Deletar arquivo',
  newEndpoint1 + '\n\n  // Deletar arquivo'
);

fs.writeFileSync('server.ts', content);
console.log('Patched server.ts');
