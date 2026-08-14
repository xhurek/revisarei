const fs = require('fs');
let content = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

const parseStructuredCode = `
function parseStructuredText(rawText: string, currentMainTag: string, currentSubtag: string, currentInstitution: string, currentYear: string, currentUserUid: string): BankQuestion[] {
  const blocks = rawText.split(/(?=^QUESTÃO:)/im).map(s => s.trim()).filter(Boolean);
  const questions: BankQuestion[] = [];
  
  for (const block of blocks) {
    if (!block.toUpperCase().startsWith("QUESTÃO:")) continue;
    
    const questionMatch = block.match(/^QUESTÃO:\\s*(.*)$/im);
    const anoMatch = block.match(/^ANO:\\s*(.*)$/im);
    const bancaMatch = block.match(/^BANCA:\\s*(.*)$/im);
    const imagemMatch = block.match(/^POSSUI IMAGEM NO PDF:\\s*(.*)$/im);
    const gabaritoMatch = block.match(/^GABARITO DA QUESTÃO:\\s*(.*)$/im);
    
    const enunciadoMatch = block.match(/\\[ENUNCIADO\\]([\\s\\S]*?)\\[ALTERNATIVAS\\]/i);
    let alternativasMatch = block.match(/\\[ALTERNATIVAS\\]([\\s\\S]*?)$/i);
    let alternativasText = alternativasMatch ? alternativasMatch[1].trim() : '';
    alternativasText = alternativasText.replace(/={10,}[\\s\\S]*$/, '').replace(/-{10,}[\\s\\S]*$/, '').trim();
    
    if (questionMatch && enunciadoMatch) {
      questions.push({
        id: 'struct_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
        questionNumber: questionMatch[1].trim(),
        year: anoMatch ? anoMatch[1].trim() : currentYear || '',
        institution: bancaMatch ? bancaMatch[1].trim() : currentInstitution || '',
        hasImageWarning: imagemMatch ? ['SIM', 'S', 'YES', 'TRUE'].includes(imagemMatch[1].trim().toUpperCase()) : false,
        correctAnswer: gabaritoMatch ? gabaritoMatch[1].trim() : '',
        text: enunciadoMatch[1].trim(),
        options: alternativasText.split('\\n').map(l => l.trim()).filter(Boolean),
        type: 'multiple_choice',
        mainTag: currentMainTag || 'Clínica Médica',
        subtag: currentSubtag ? currentSubtag.split(',')[0].trim() : '',
        subtags: currentSubtag ? currentSubtag.split(',').map(s=>s.trim()).filter(Boolean) : [],
        createdAt: new Date().toISOString(),
        createdBy: currentUserUid || 'unknown'
      });
    }
  }
  return questions;
}
`;

content = content.replace(
  'export function AddQuestionsView({ ',
  parseStructuredCode + '\nexport function AddQuestionsView({ '
);

// Now patch processQuestions
const processQuestionsReplacement = `
  const processQuestions = async () => {
    if (!text.trim()) return alert('Insira o texto das questões.');
    setProcessing(true);
    try {
      // Fast path for structured format
      if (text.includes("QUESTÃO:") && text.includes("[ENUNCIADO]") && text.includes("[ALTERNATIVAS]")) {
        const parsed = parseStructuredText(text, usePredefinedTags ? mainTag : 'Clínica Médica', usePredefinedTags ? subtag : '', institution, year, auth.currentUser?.uid || '');
        if (parsed.length > 0) {
          setStaging(prev => [...prev, ...parsed]);
          setText('');
          setAnswerKeyText('');
          setImages([]);
          setProcessing(false);
          return;
        }
      }

      let data;
`;

content = content.replace(
  `  const processQuestions = async () => {
    if (!text.trim()) return alert('Insira o texto das questões.');
    setProcessing(true);
    try {
      let data;`,
  processQuestionsReplacement
);

fs.writeFileSync('src/components/QuestionBankView.tsx', content);
console.log('patched structured parsing');
