const rawText = `
========================================================
        EXTRAÇÃO DE QUESTÕES PROCESSADA COM SUCESSO    
========================================================

--------------------------------------------------------

QUESTÃO: 5
ANO: 2026
BANCA: Estratégia MED
POSSUI IMAGEM NO PDF: NÃO
GABARITO DA QUESTÃO: D
--------------------------------------------------------

[ENUNCIADO]
Uma mulher de 35 anos de idade comparece à UBS desejando receber a vacina contra o HPV. Refere que foi tratada de uma lesão de alto grau (NIC 2) no colo do útero, tendo sido submetida à conização há 1 mês. Nega ter recebido a vacina anteriormente. Como o médico deve proceder?

[ALTERNATIVAS]
A) Orientar que a paciente “já passou da idade” para receber a vacina.
B) Indicar a vacinação contra o HPV com dose única.
C) Indicar a vacinação contra o HPV com duas doses (esquema 0 e 6 meses).
D) Indicar a vacinação contra o HPV com três doses (esquema 0, 2 e 6 meses).

========================================================
`;

function parseStructured(text) {
  const blocks = text.split(/(?=^QUESTÃO:)/im).map(s => s.trim()).filter(Boolean);
  const questions = [];
  
  for (const block of blocks) {
    if (!block.toUpperCase().startsWith("QUESTÃO:")) continue;
    
    const questionMatch = block.match(/^QUESTÃO:\s*(.*)$/im);
    const anoMatch = block.match(/^ANO:\s*(.*)$/im);
    const bancaMatch = block.match(/^BANCA:\s*(.*)$/im);
    const imagemMatch = block.match(/^POSSUI IMAGEM NO PDF:\s*(.*)$/im);
    const gabaritoMatch = block.match(/^GABARITO DA QUESTÃO:\s*(.*)$/im);
    
    // Find enunciado and alternativas
    const enunciadoMatch = block.match(/\[ENUNCIADO\]([\s\S]*?)\[ALTERNATIVAS\]/i);
    let alternativasMatch = block.match(/\[ALTERNATIVAS\]([\s\S]*?)$/i);
    let alternativasText = alternativasMatch ? alternativasMatch[1].trim() : '';
    // Optional: remove trailing === or ---
    alternativasText = alternativasText.replace(/={10,}[\s\S]*$/, '').replace(/-{10,}[\s\S]*$/, '').trim();
    
    if (questionMatch && enunciadoMatch) {
      questions.push({
        num: questionMatch[1].trim(),
        ano: anoMatch ? anoMatch[1].trim() : '',
        banca: bancaMatch ? bancaMatch[1].trim() : '',
        imagem: imagemMatch ? ['SIM', 'S', 'YES', 'TRUE'].includes(imagemMatch[1].trim().toUpperCase()) : false,
        gabarito: gabaritoMatch ? gabaritoMatch[1].trim() : '',
        enunciado: enunciadoMatch[1].trim(),
        alternativas: alternativasText.split('\n').map(l => l.trim()).filter(Boolean)
      });
    }
  }
  return questions;
}

console.log(JSON.stringify(parseStructured(rawText), null, 2));
