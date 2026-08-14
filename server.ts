import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { PDFDocument } from 'pdf-lib';
import scraper from './pdf-scraper.cjs';
import multer from "multer";
import dotenv from "dotenv";
import AdmZip from "adm-zip";
import fs from "fs";
import os from "os";
import * as admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp } from 'firebase-admin/app';
import { fixPdfLigatures, sanitizeQuestionFields } from './src/lib/textSanitizer';

dotenv.config();

// Instanciação do SDK oficial do Google Gen AI
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Modelo padrão respeitando a variável de ambiente process.env.GEMINI_MODEL, ignorando modelos descontinuados
const isDeprecatedModel = (m?: string) => {
  if (!m) return true;
  return m.includes('1.5') || m.includes('2.0') || m.includes('2.5');
};

const envModel = process.env.GEMINI_MODEL;
const DEFAULT_MODEL = (envModel && !isDeprecatedModel(envModel)) ? envModel : 'gemini-3.6-flash';

// Lista de modelos oficiais e ativos da família Gemini para fallback
const CANDIDATE_MODELS = [
  DEFAULT_MODEL,
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest'
].filter((m, idx, arr) => m && !isDeprecatedModel(m) && arr.indexOf(m) === idx);

const verifyFirebaseToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    if (token) {
      try {
        const decodedToken = await getAuth().verifyIdToken(token);
        req.user = decodedToken;
      } catch (error) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            req.user = payload;
          }
        } catch (_) {
          // ignore token parse errors
        }
      }
    }
  }
  next();
};

const getModelForUser = (user: any) => {
  return DEFAULT_MODEL;
};

// Retry e Fallback automático entre modelos oficiais ativos da família Gemini
async function withRetry<T>(fnBuilder: (model: string) => Promise<T>, maxRetries = 2, delay = 1500): Promise<T> {
  let lastError: any;
  for (const model of CANDIDATE_MODELS) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fnBuilder(model);
      } catch (error: any) {
        lastError = error;
        const errorMsg = (error.toString() || '') + ' ' + (error.message || '');
        console.warn(`Gemini model ${model} (attempt ${i + 1}/${maxRetries}) error: ${errorMsg.substring(0, 150)}`);
        
        const isPermanentError = 
          errorMsg.includes('404') || 
          errorMsg.includes('NOT_FOUND') ||
          errorMsg.includes('not found') ||
          errorMsg.includes('no longer available') ||
          errorMsg.includes('is not available') ||
          error.status === 404;

        if (isPermanentError) {
          console.warn(`Model ${model} returned permanent error (${errorMsg.substring(0, 100)}). Trying next candidate model immediately...`);
          break; // Pula para o próximo modelo candidato imediatamente sem retentar o erro permanente
        }

        const isTransient = 
          errorMsg.includes('429') || 
          errorMsg.includes('503') || 
          errorMsg.includes('RESOURCE_EXHAUSTED') ||
          errorMsg.includes('exceeded your current quota') ||
          errorMsg.includes('high demand') ||
          error.status === 429 ||
          error.status === 503;

        if (isTransient) {
          if (i < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.5, 3000);
            continue;
          } else {
            console.warn(`Model ${model} exhausted retries. Trying next candidate model...`);
            break; // Tenta o próximo modelo candidato em CANDIDATE_MODELS
          }
        }
        throw error;
      }
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  const upload = multer({ storage: multer.memoryStorage() });
  const diskUpload = multer({ dest: os.tmpdir() });

  // Upload para a Gemini File API
  app.post("/api/upload-context", verifyFirebaseToken, diskUpload.array('files', 10), async (req: any, res: any) => {
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
  });

  // Explicar questão
  app.post("/api/explain-question", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { question, options, knowledgeBase, userAnswer, correctAnswer } = req.body;
      const parts: any[] = [];
      
      if (knowledgeBase && knowledgeBase.length > 0) {
        for (const file of knowledgeBase) {
          parts.push({
            fileData: {
              fileUri: file.uri,
              mimeType: file.mimeType
            }
          });
        }
        parts.push({ text: `Utilize o material de apoio fornecido acima para responder à dúvida do aluno.` });
      }

      parts.push({ text: `Enunciado da questão: ${question}` });
      if (options && options.length > 0) {
        parts.push({ text: `Alternativas: ${options.join(' | ')}` });
      }
      if (correctAnswer) parts.push({ text: `A resposta correta é: ${correctAnswer}` });
      if (userAnswer) parts.push({ text: `O aluno marcou ou respondeu: ${userAnswer}` });
      
      parts.push({ text: `Explique detalhadamente por que a resposta correta é a certa, apontando como isso se conecta com o material de apoio fornecido (se houver). Se a questão for de múltipla escolha e o aluno errou, justifique o motivo do erro. Seja didático, encorajador e direto.` });

      const model = getModelForUser(req.user);

      const response = await withRetry((selectedModel) => ai.models.generateContentStream({
        model: selectedModel,
        contents: { parts },
      }));

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      for await (const chunk of response) {
        if (chunk.text) {
          res.write(chunk.text);
        }
      }
      res.end();
    } catch (error: any) {
      console.error("Error explaining question:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Extrair banco de questões
  app.post("/api/extract-bank-questions", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { text, answerKeyText, predefinedTags, institution, year, images } = req.body;
      
      const prompt = `
        Você é um assistente especializado em extração de dados educacionais (questões de medicina).
        Abaixo está um texto que contém uma ou mais questões, e possivelmente o texto do gabarito correspondente.
        
        Extraia TODAS as questões (múltipla escolha ou discursivas) contidas no texto.
        
        TEXTO DAS QUESTÕES:
        --------------------------------------
        ${text}
        --------------------------------------

        TEXTO DO GABARITO (se aplicável):
        --------------------------------------
        ${answerKeyText || 'Não fornecido.'}
        --------------------------------------
        
        Regras de extração:
        1. Identifique a numeração original da questão (ex: "1", "12", "105") se presente no texto e salve no campo 'questionNumber'.
        2. Classifique o 'type' da questão como "multiple_choice" ou "discursive".
        3. SEPARAÇÃO RIGOROSA DE ALTERNATIVAS: Se for "multiple_choice", extraia OBRIGATORIAMENTE todas as alternativas para a lista 'options'. NUNCA deixe as alternativas coladas dentro do enunciado. O enunciado deve conter APENAS o texto do enunciado da questão e terminar antes da opção (A). NUNCA inclua as letras (A, B, C...) no texto individual de cada opção ou da resposta.
        4. LIMPEZA DO ENUNCIADO: Remova cabeçalhos repetitivos, anos, nomes de bancas ou textos de introdução da prova do início do enunciado (ex: se o texto começar com "2024 - USP - Questão 12. Paciente...", remova "2024 - USP - Questão 12." do enunciado e deixe apenas "Paciente..."). Salve o ano no campo 'year' e a banca no campo 'institution'.
        5. O 'correctAnswer' deve OBRIGATORIAMENTE ser deduzido do gabarito fornecido. Não tente "adivinhar" a resposta por conta própria se não houver no gabarito, deixe em branco.
        6. Defina 'mainTag' como uma das 6 Grandes Áreas da Medicina ("Clínica Médica", "Cirurgia Geral", "Pediatria", "Ginecologia", "Obstetrícia", "Medicina de Família e Comunidade", ou "Outros"). NUNCA tente extrair ou identificar as 'subtags', retorne sempre o campo 'subtags' como um array vazio [].
        7. DETECÇÃO DE IMAGENS: Caso o enunciado faça referência a uma imagem, figura, radiografia, foto, ECG, gráfico, tabela ou esquema explicativo necessário para responder, ou se usar termos explícitos como "exame abaixo", "tabela a seguir", "figura a seguir", "observe a figura", "como mostra o gráfico", defina 'hasImageWarning' como true.
        8. ATENÇÃO: Tabela ou lista de gabarito no final do texto NÃO É IMAGEM DE QUESTÃO! NUNCA marque 'hasImageWarning' como true para tabelas de gabarito.
        9. CORREÇÃO DE LIGATURAS E ERROS DE OCR DO PDF:
           - Corrija qualquer caractere '+' que tenha substituído ligaturas como 'fi' ou 'fl' em palavras (ex: 'ultrassonográ+ca' -> 'ultrassonográfica', 'mamogra+a' -> 'mamografia', '+ ́ sico' -> 'físico').
           - Corrija a letra 'V' ou 'v' quando tiver substituído erroneamente a ligatura 'FL' ou 'FI' em palavras médicas em português (ex: 'INVAMAÇÃO' -> 'INFLAMAÇÃO', 'VUTUAÇÃO' -> 'FLUTUAÇÃO', 'REVUXO' -> 'REFLUXO', 'PROVILAXIA' -> 'PROFILAXIA', 'INSUVICIÊNCIA' -> 'INSUFICIÊNCIA', 'DIVICULDADE' -> 'DIFICULDADE').
           - Corrija acentos, til ou cedilhas isolados/separados de letras (ex: 'c ̧ a ̃ o' -> 'ção', 'mama ́ rio' -> 'mamário', 'inspec ̧ a ̃ o' -> 'inspeção').
           - Garanta que todo o texto esteja com a grafia médica correta e acentuação unificada em português.
        ${predefinedTags?.usePredefined ? `AVISO: O usuário já definiu as tags. Use mainTag="${predefinedTags.mainTag}" e subtags=${JSON.stringify(predefinedTags.subtags || [])} para todas as questões.` : ''}
        
        Retorne o resultado estritamente em conformidade com o formato JSON.
      `;
      
      const parts: any[] = [{ text: prompt }];

      if (images && images.length > 0) {
        images.forEach((imgBase64: string) => {
          const match = imgBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/);
          if (match) {
             parts.push({
               inlineData: {
                 mimeType: match[1],
                 data: match[2]
               }
             });
          }
        });
      }
      
      const model = getModelForUser(req.user);

      const resultResponse = await withRetry((selectedModel) => ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    questionNumber: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ["multiple_choice", "discursive"] },
                    text: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING },
                    mainTag: { type: Type.STRING },
                    subtags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    hasImageWarning: { type: Type.BOOLEAN }
                  },
                  required: ["text", "correctAnswer", "type", "mainTag"]
                }
              }
            },
            required: ["questions"]
          }
        }
      }));
      
      const parsed = JSON.parse(resultResponse.text || "{\"questions\": []}");
      
      const finalQuestions = parsed.questions.map((q: any) => sanitizeQuestionFields({
        ...q,
        id: Math.random().toString(36).substring(2, 9),
        institution: institution || '',
        year: year || ''
      }));
      
      res.json({ questions: finalQuestions });
    } catch (error: any) {
      console.error("Error extracting bank questions:", error);
      res.status(500).json({ error: error.message });
    }
  });

  
  app.post("/api/upload-zip-context", verifyFirebaseToken, diskUpload.single('file'), async (req: any, res: any) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ error: "No zip file uploaded" });

      const zip = new AdmZip(file.path);
      const zipEntries = zip.getEntries();
      
      const results = [];
      for (const zipEntry of zipEntries) {
        if (!zipEntry.isDirectory && zipEntry.entryName.toLowerCase().endsWith('.pdf')) {
          const pdfBuffer = zipEntry.getData();
          const tempPdfPath = path.join(os.tmpdir(), `temp-${Date.now()}-${Math.random().toString(36).substring(7)}.pdf`);
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

      const prompt = `
        Este documento contém apenas UMA questão, e no final da página (ou do documento) está o gabarito indicando a resposta correta para ela.
        
        Sua tarefa:
        1. Transcreva a questão (enunciado, alternativas).
        2. Identifique o ano e a banca/instituição, se presentes.
        3. Localize o gabarito no final e determine qual é a alternativa correta da questão. Defina isso no campo 'resposta_correta' apenas com a letra (ex: "A", "B", "C", "D", "E").
        
        NÃO tente identificar a área médica ou tópicos, retorne-os sempre vazios.
        
        RECONHECIMENTO DE IMAGENS:
        Caso a questão contiver ou fizer referência a uma imagem, figura, tabela, radiografia, tomografia, ultrassom, gráfico, ECG, ecocardiograma ou esquema explicativo, ou se usar termos explícitos como "exame abaixo", "tabela a seguir", "figura a seguir", "observe a figura", "como mostra o gráfico", defina 'has_image' como true.
      `;

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


  // Deletar arquivo
  app.post("/api/delete-file", verifyFirebaseToken, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: "File name is required" });
      await withRetry(() => ai.files.delete({ name }));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting file:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Extrair gabarito
  app.post("/api/extract-answer-key-from-file", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { fileUri, fileMimeType } = req.body;
      if (!fileUri) return res.status(400).json({ error: "fileUri is required" });

      const prompt = `
        Vá até o final deste documento, localize o gabarito oficial das questões e retorne-o estritamente como um objeto JSON estruturado.
        As chaves devem ser o número da questão e os valores a alternativa correta.
        Exemplo: { "1": "A", "2": "C", "3": "E" }
      `;

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
        }
      }));

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Error extracting answer key:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Extrair lote de questões
  app.post("/api/extract-questions-batch-from-file", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { fileUri, fileMimeType, startIdx, endIdx } = req.body;
      if (!fileUri || startIdx === undefined || endIdx === undefined) {
        return res.status(400).json({ error: "fileUri, startIdx, and endIdx are required" });
      }

      const prompt = `
        Transcreva fielmente as questões de número ${startIdx} até ${endIdx} deste documento.
        Não tente responder as questões. Retorne apenas o número da questão ('numero'), o enunciado e as alternativas exatamente como estão no PDF.
        Identifique também o ano (ano) e a banca/instituição (banca) da questão, se aparecerem antes do enunciado.
        NÃO tente identificar a área médica ou tópicos, retorne-os sempre vazios.
        
        SEPARAÇÃO DE ALTERNATIVAS E LIMPEZA DE ENUNCIADO:
        - Extraia OBRIGATORIAMENTE todas as alternativas para a lista de alternativas ('alternativas'). NUNCA deixe as opções coladas dentro do enunciado. O enunciado deve conter APENAS o texto da pergunta e terminar antes da primeira alternativa (A).
        - Remova do início do enunciado qualquer cabeçalho de prova, ano repetido, nome da banca ou 'Questão XX' (ex: em '2024 - USP - Questão 12. Paciente...', deixe no enunciado apenas 'Paciente...').
        
        RECONHECIMENTO DE IMAGENS:
        Caso a questão contiver ou fizer referência a uma imagem, figura, radiografia, tomografia, ultrassom, gráfico, ECG, ecocardiograma ou esquema explicativo, defina 'has_image' como true.
        
        ATENÇÃO ESPECIAL À ÚLTIMA PÁGINA OU SEÇÃO DE GABARITO:
        No final de provas ou simulados, existe uma tabela ou lista com o GABARITO oficial das respostas.
        A TABELA DE GABARITO NÃO É UMA IMAGEM DE QUESTÃO!
        Se você identificar a tabela/lista de gabarito no final, desconsidere-a completamente. NUNCA a considere como imagem de questão nem crie uma questão para o gabarito.

        CORREÇÃO DE LIGATURAS E ERROS DE OCR DO PDF:
        - Corrija qualquer caractere '+' que tenha substituído ligaturas como 'fi' ou 'fl' em palavras (ex: 'ultrassonográ+ca' -> 'ultrassonográfica', 'mamogra+a' -> 'mamografia', '+ ́ sico' -> 'físico').
        - Corrija a letra 'V' ou 'v' quando tiver substituído erroneamente a ligatura 'FL' ou 'FI' em palavras médicas em português (ex: 'INVAMAÇÃO' -> 'INFLAMAÇÃO', 'VUTUAÇÃO' -> 'FLUTUAÇÃO', 'REVUXO' -> 'REFLUXO', 'PROVILAXIA' -> 'PROFILAXIA', 'INSUVICIÊNCIA' -> 'INSUFICIÊNCIA', 'DIVICULDADE' -> 'DIFICULDADE').
        - Corrija acentos, til ou cedilhas isolados/separados de letras (ex: 'c ̧ a ̃ o' -> 'ção', 'mama ́ rio' -> 'mamário', 'inspec ̧ a ̃ o' -> 'inspeção', 'brac ̧ os' -> 'braços'). Garanta que todo o texto esteja com a grafia médica correta e acentuação unificada em português.
      `;

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
                    descricao_da_imagem: { type: Type.STRING }
                  },
                  required: ["numero", "enunciado", "alternativas"]
                }
              }
            },
            required: ["questoes"]
          }
        }
      }));

      const rawBatch = JSON.parse(response.text || "{\"questoes\": []}");
      const sanitizedBatch = {
        ...rawBatch,
        questoes: (rawBatch.questoes || []).map((q: any) => ({
          ...q,
          enunciado: fixPdfLigatures(q.enunciado || ''),
          alternativas: (q.alternativas || []).map((alt: string) => fixPdfLigatures(alt)),
          banca: fixPdfLigatures(q.banca || '')
        }))
      };

      res.json(sanitizedBatch);
    } catch (error: any) {
      console.error("Error extracting questions batch:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Processar PDF
  app.post("/api/process-pdf", verifyFirebaseToken, upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'answerKey', maxCount: 1 },
    { name: 'supportMaterial', maxCount: 5 }
  ]), async (req: any, res: any) => {
    try {
      console.log("Processing PDF request...");
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const pdfFile = files['pdf']?.[0];
      const answerKeyFile = files['answerKey']?.[0];
      const supportFiles = files['supportMaterial'] || [];
      const answerKeyText = req.body.answerKeyText;

      if (!pdfFile) {
        return res.status(400).json({ error: "PDF file is required" });
      }

      const model = getModelForUser(req.user);

      const fullText = await scraper.parseText(pdfFile.buffer);

      const maxChunkSize = 100000;
      const textChunks: string[] = [];
      let currentChunk = "";
      
      const paragraphs = fullText.split(/\n\s*\n/);
      for (const p of paragraphs) {
        if ((currentChunk.length + p.length) > maxChunkSize && currentChunk.length > 0) {
          textChunks.push(currentChunk);
          currentChunk = "";
        }
        currentChunk += p + "\n\n";
      }
      if (currentChunk.trim().length > 0) {
        textChunks.push(currentChunk);
      }

      console.log(`Extracted text from PDF. Split into ${textChunks.length} chunks.`);

      const baseParts: any[] = [];
      if (answerKeyFile) {
        baseParts.push({
          inlineData: {
            data: answerKeyFile.buffer.toString('base64'),
            mimeType: answerKeyFile.mimetype
          }
        });
      } else if (answerKeyText) {
        baseParts.push({ text: `Gabarito de apoio: ${answerKeyText}` });
      }
      
      for (const file of supportFiles) {
        baseParts.push({
          inlineData: {
            data: file.buffer.toString('base64'),
            mimeType: file.mimetype
          }
        });
      }

      const processChunk = async (chunkText: string, index: number) => {
        const chunkParts = [...baseParts];
        
        const prompt = `
          Você é um assistente especializado em extração de dados educacionais.
          Abaixo está um bloco de texto extraído de um documento maior (Parte ${index + 1} de ${textChunks.length}).
          
          Extraia **TODAS** as questões (múltipla escolha ou discursivas) contidas **APENAS** no texto abaixo. 
          Use o gabarito anexo para preencher a resposta correta e a explicação, se possível.
          Identifique e associe uma das 6 Grandes Áreas da Medicina para cada questão, caso a área não se aplique perfeitamente a uma das 6 coloque a mais provável.
          As Grandes Áreas são: "Clínica Médica", "Cirurgia Geral", "Pediatria", "Ginecologia", "Obstetrícia", "Medicina de Família e Comunidade".
          Caso a questão não seja de medicina, use "Outros".

          TEXTO DA PARTE ${index + 1}:
          --------------------------------------
          ${chunkText}
          --------------------------------------

          Regras de extração:
          1. Classifique o 'type' da questão como "multiple_choice" ou "discursive".
          2. Se for "multiple_choice", preencha o campo 'options'. NUNCA inclua as letras (A, B, C...) no texto das opções ou da resposta.
          3. Se for "discursive", preencha 'correctAnswer'.
          4. Defina o 'category' com uma das Grandes Áreas listadas acima.
          
          Retorne o resultado estritamente em conformidade com o formato JSON.
        `;
        
        chunkParts.push({ text: prompt });

        const resultResponse = await withRetry((selectedModel) => ai.models.generateContent({
        model: selectedModel,
           contents: { parts: chunkParts },
           config: {
             responseMimeType: "application/json",
             responseSchema: {
               type: Type.OBJECT,
               properties: {
                 title: { type: Type.STRING },
                 questions: {
                   type: Type.ARRAY,
                   items: {
                     type: Type.OBJECT,
                     properties: {
                       id: { type: Type.STRING },
                       type: { type: Type.STRING, enum: ["multiple_choice", "discursive"] },
                       text: { type: Type.STRING },
                       options: { type: Type.ARRAY, items: { type: Type.STRING } },
                       correctAnswer: { type: Type.STRING },
                       explanation: { type: Type.STRING },
                       category: { type: Type.STRING }
                     },
                     required: ["id", "text", "correctAnswer", "type", "category"]
                   }
                 }
               },
               required: ["questions"]
             }
           }
        }));

        try {
          return JSON.parse(resultResponse.text || "{\"questions\": []}");
        } catch (e) {
          console.error("Failed to parse JSON for chunk:", index);
          return { questions: [] };
        }
      };

      const results = [];
      for (let i = 0; i < textChunks.length; i++) {
        console.log(`Processing chunk ${i + 1}/${textChunks.length}...`);
        const chunkResult = await processChunk(textChunks[i], i);
        results.push(chunkResult);
        
        // Pausa de 3 segundos entre partes (suficiente para o Flash)
        if (i < textChunks.length - 1) {
           await new Promise(resolve => setTimeout(resolve, 8000));
        }
      }

      let allQuestions: any[] = [];
      let quizTitle = "Quiz Extraído";

      for (const result of results) {
        if (result.questions && Array.isArray(result.questions)) {
          allQuestions = [...allQuestions, ...result.questions];
        }
        if (result.title && result.title !== "Título") {
          quizTitle = result.title;
        }
      }

      allQuestions = allQuestions.map((q, i) => ({ ...q, id: `q${i + 1}` }));
      
      console.log(`Finished processing chunks. Total questions extracted: ${allQuestions.length}`);
      res.json({ title: quizTitle, questions: allQuestions });
      return;

    } catch (error: any) {
      console.error("Error processing PDF:", error);
      let errorMsg = error.message;
      if (errorMsg && errorMsg.includes("exceeds the supported page limit")) {
        errorMsg = "O documento excede o limite de 1000 páginas suportado pela IA. Por favor, divida o PDF em partes menores e tente novamente.";
      }
      res.status(500).json({ error: errorMsg });
    }
  });

  // Avaliar resposta discursiva (ajustado para gemini-2.0-flash)
  app.post("/api/evaluate-answer", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { question, expectedAnswer, userAnswer, knowledgeBase, files } = req.body;
      const parts: any[] = [];
      
      parts.push({ text: `Avalie a resposta do aluno para a seguinte questão discursiva.` });
      parts.push({ text: `Questão: ${question}` });
      parts.push({ text: `Resposta Esperada (Gabarito): ${expectedAnswer}` });
      parts.push({ text: `Resposta do Aluno: ${userAnswer}` });
      
      const parsedKnowledgeBase = typeof knowledgeBase === 'string' ? JSON.parse(knowledgeBase) : knowledgeBase;
      if ((files && files.length > 0) || (parsedKnowledgeBase && parsedKnowledgeBase.length > 0)) {
        parts.push({ text: `Material de apoio adicional fornecido para basear a correção:` });
        
        if (files) {
          for (const file of files) {
            parts.push({
              inlineData: {
                data: file.data,
                mimeType: file.mimeType
              }
            });
          }
        }
        
        if (parsedKnowledgeBase) {
          for (const kb of parsedKnowledgeBase) {
            parts.push({
              fileData: {
                fileUri: kb.uri,
                mimeType: kb.mimeType
              }
            });
          }
        }
      }
      
      const response = await withRetry((selectedModel) => ai.models.generateContent({
        model: selectedModel,
        contents: [{ role: "user", parts }],
        config: {
          responseMimeType: "application/json"
        }
      }));

      const responseText = response.text;
      let feedbackData;
      try {
        feedbackData = JSON.parse(responseText);
      } catch (e) {
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          feedbackData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error("Não foi possível processar o JSON retornado pela IA.");
        }
      }

      res.json(feedbackData);
    } catch (error: any) {
      console.error("Error evaluating answer:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Analisar Assunto Principal e Subtema das questões erradas
  app.post("/api/analyze-missed-topics", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.json({ analysis: [] });
      }

      const prompt = `
        Para cada uma das questões de medicina erradas e suas respostas corretas abaixo, identifique o Assunto Principal (tema/doença) e o Subtema (conduta, tratamento, diagnóstico, complicação específica).

        Exemplo 1:
        Questão: "No tratamento da Doença do Refluxo Gastroesofágico (DRGE), são condutas adequadas, EXCETO:"
        Resposta: "Nos períodos de sono, posição prona, com elevação da cabeceira entre 30 a 40 graus."
        -> Assunto Principal: "DRGE"
        -> Subtema: "Tratamento"

        Exemplo 2:
        Questão: "Criança de 3 anos, portadora de anemia falciforme, apresenta palidez súbita, hipoatividade e dor abdominal. Ao exame, apresenta baço a 7 cm da reborda costal esquerda (previamente impalpável). Qual o diagnóstico mais provável?"
        Resposta: "Crise de sequestro esplênico."
        -> Assunto Principal: "Anemia falciforme"
        -> Subtema: "Sequestro esplênico"

        Lista de questões a analisar:
        ${JSON.stringify(items.map((it: any, i: number) => ({ id: i, question: it.question, answer: it.answer })))}

        Retorne um JSON estritamente no seguinte formato:
        {
          "analysis": [
            {
              "id": 0,
              "topic": "Assunto Principal curto e limpo (ex: DRGE, Anemia falciforme, Asma, HAS)",
              "subtopic": "Subtema curto e limpo (ex: Tratamento, Sequestro esplênico, Quadro clínico, Complicações)"
            }
          ]
        }
      `;

      const response = await withRetry((selectedModel) => ai.models.generateContent({
        model: selectedModel,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.NUMBER },
                    topic: { type: Type.STRING },
                    subtopic: { type: Type.STRING }
                  },
                  required: ["id", "topic", "subtopic"]
                }
              }
            },
            required: ["analysis"]
          }
        }
      }));

      res.json(JSON.parse(response.text || '{"analysis": []}'));
    } catch (error: any) {
      console.error("Error analyzing missed topics:", error);
      res.json({ analysis: [] });
    }
  });

  // Gerar Flashcard
  app.post("/api/generate-flashcard", verifyFirebaseToken, async (req: any, res: any) => {
    try {
      const { question, expectedAnswer, userAnswer } = req.body;
      const parts: any[] = [];
      
      parts.push({ text: `O aluno errou uma questão. Extraia o conceito chave subjacente a este erro para criar um flashcard de revisão ativa (pergunta e resposta curta e direta). Não coloque a questão completa no flashcard, não seja redundante com as alternativas (se existirem). Foque no princípio ou conteúdo que faltou para o aluno acertar.` });
      parts.push({ text: `Enunciado/Questão original: ${question}` });
      parts.push({ text: `Resposta esperada correta: ${expectedAnswer}` });
      if (userAnswer) parts.push({ text: `Resposta que o aluno marcou: ${userAnswer}` });
      
      parts.push({ text: `
        Retorne um JSON com:
        {
          "flashcardQuestion": "Uma pergunta limpa, direta e focado no conceito chave necessário para resolver a questão.",
          "flashcardAnswer": "A resposta direta à pergunta focada no conceito chave, com uma leve explicação.",
          "explanation": "Por que a resposta do aluno estava errada ou uma dica para o futuro."
        }
      `});

      const model = getModelForUser(req.user);

      const response = await withRetry((selectedModel) => ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              flashcardQuestion: { type: Type.STRING },
              flashcardAnswer: { type: Type.STRING },
              explanation: { type: Type.STRING }
            },
            required: ["flashcardQuestion", "flashcardAnswer", "explanation"]
          }
        }
      }));

      res.json(JSON.parse(response.text || "{}"));
    } catch (error: any) {
      console.error("Error generating flashcard:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Importar Anki
  app.post("/api/import-anki", async (req, res) => {
    try {
      const { fileName, fileData } = req.body;
      if (!fileData) {
        return res.status(400).json({ error: "Arquivo .apkg não fornecido" });
      }
      const buffer = Buffer.from(fileData, 'base64');
      const file = { originalname: fileName, buffer };

      const AdmZip = (await import('adm-zip')).default;
      const initSqlJs = (await import('sql.js')).default;
      const { decompress } = await import('fzstd');
      
      const zip = new AdmZip(file.buffer);
      
      const decompressIfNeeded = (buf: Buffer) => {
        if (buf && buf.length >= 4 && buf[0] === 0x28 && buf[1] === 0xB5 && buf[2] === 0x2F && buf[3] === 0xFD) {
          try {
            return Buffer.from(decompress(new Uint8Array(buf)));
          } catch (e) {
            console.error("Zstd decompress error:", e);
          }
        }
        return buf;
      };

      const allEntries = zip.getEntries();
      const findEntry = (name: string) => {
        if (!name) return null;
        const normalized = name.toLowerCase().replace(/\\/g, '/');
        let entry = zip.getEntry(name);
        if (entry) return entry;
        
        entry = allEntries.find(e => {
          const eName = e.entryName.toLowerCase().replace(/\\/g, '/');
          return eName === normalized || eName.endsWith('/' + normalized);
        });
        return entry || null;
      };

      const collectionEntry = findEntry('collection.anki21b') || findEntry('collection.anki21') || findEntry('collection.anki2');
      
      if (!collectionEntry) {
        return res.status(400).json({ error: "Arquivo .apkg inválido: arquivo collection (anki2/anki21) não encontrado no zip." });
      }
      
      const collectionData = decompressIfNeeded(collectionEntry.getData());
      
      const SQL = await initSqlJs();
      const db = new SQL.Database(collectionData);
      
      const result = db.exec("SELECT flds FROM notes LIMIT 2000");
      
      const flashcards: any[] = [];
      if (result.length > 0 && result[0].values) {
         for (const row of result[0].values) {
           const flds = row[0] as string;
           const parts = flds.split('\x1f');
           if (parts.length >= 2) {
             const rawQ = parts[0];
             const rawA = parts.slice(1).join('\n\n');
             
             const sanitize = (text: string) => {
                 let t = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                            .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
                 t = t.replace(/<img[^>]*>/gi, '[Imagem do Anki omitida]');
                 return t;
             };
             
             let q = sanitize(rawQ).trim();
             let a = sanitize(rawA).trim();
             
             if (q.length > 400000) q = q.substring(0, 400000) + '...';
             if (a.length > 400000) a = a.substring(0, 400000) + '...';

             if (q.length > 0 && a.length > 0) {
                 flashcards.push({
                   question: q,
                   answer: a,
                   explanation: ''
                 });
             }
           }
         }
      }
      
      return res.json({ flashcards, media: {}, debug: { isSimplified: true } });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: "Falha ao analisar arquivo: " + e.message });
    }
  });

  // Handler de erros de API
  app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('API Error:', err);
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });

  // Catch-all 404 para rotas /api não encontradas (evita retornar o HTML index.html da SPA)
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `Rota de API não encontrada: ${req.method} ${req.path}` });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();