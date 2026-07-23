const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const defaultModelRegex = /dotenv\.config\(\);\n\nconst PROJECT_ID/;
code = code.replace(defaultModelRegex, "dotenv.config();\n\n// Define o modelo padrão (pode ser sobrescrito via variável de ambiente no .env)\nconst DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';\n\nconst PROJECT_ID");

const getModelForUserRegex = /\/\/ ⚡ Usando gemini-2\.5-flash como padrão para todos para evitar erros de cota \(429\)\nconst getModelForUser = \(user: any\) => \{\n  return 'gemini-2\.5-flash';\n\};/;
code = code.replace(getModelForUserRegex, "const getModelForUser = (user: any) => {\n  return DEFAULT_MODEL;\n};");

const evaluateRegex = /model: "gemini-2\.5-flash",\n\s*contents: \[\{ role: "user", parts \}\],/;
code = code.replace(evaluateRegex, "model: getModelForUser(req.user),\n        contents: [{ role: \"user\", parts }],");

fs.writeFileSync('server.ts', code);
