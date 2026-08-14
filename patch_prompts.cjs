const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const oldPrompt1 = "7. DETECÇÃO DE IMAGENS: Caso o enunciado faça referência a uma imagem, figura, radiografia, foto, ECG, gráfico ou esquema explicativo necessário para responder, defina 'hasImageWarning' como true.";
const newPrompt1 = "7. DETECÇÃO DE IMAGENS: Caso o enunciado faça referência a uma imagem, figura, radiografia, foto, ECG, gráfico, tabela ou esquema explicativo necessário para responder, ou se usar termos explícitos como \"exame abaixo\", \"tabela a seguir\", \"figura a seguir\", \"observe a figura\", \"como mostra o gráfico\", defina 'hasImageWarning' como true.";

const oldPrompt2 = "Caso a questão contiver ou fizer referência a uma imagem, figura, radiografia, tomografia, ultrassom, gráfico, ECG, ecocardiograma ou esquema explicativo, defina 'has_image' como true.";
const newPrompt2 = "Caso a questão contiver ou fizer referência a uma imagem, figura, tabela, radiografia, tomografia, ultrassom, gráfico, ECG, ecocardiograma ou esquema explicativo, ou se usar termos explícitos como \"exame abaixo\", \"tabela a seguir\", \"figura a seguir\", \"observe a figura\", \"como mostra o gráfico\", defina 'has_image' como true.";

code = code.replace(oldPrompt1, newPrompt1);
code = code.replace(oldPrompt2, newPrompt2);

// Also fix the subtags array injection for predefinedTags in /api/extract-bank-questions:
// The code had: subtags=["${predefinedTags.subtag || ''}"]
// But we changed to use subtags array!
const oldTags = "${predefinedTags?.usePredefined ? `AVISO: O usuário já definiu as tags. Use mainTag=\"${predefinedTags.mainTag}\" e subtags=[\"${predefinedTags.subtag || ''}\"] para todas as questões.` : ''}";
const newTags = "${predefinedTags?.usePredefined ? `AVISO: O usuário já definiu as tags. Use mainTag=\"${predefinedTags.mainTag}\" e subtags=${JSON.stringify(predefinedTags.subtags || [])} para todas as questões.` : ''}";
code = code.replace(oldTags, newTags);

fs.writeFileSync('server.ts', code);
