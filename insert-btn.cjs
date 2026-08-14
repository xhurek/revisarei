const fs = require('fs');
let content = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

const buttonToAdd = `
          {missingImageQuestions.length > 0 && (
            <button
              onClick={() => setIsFastCheckOpen(true)}
              className="bg-amber-100 hover:bg-amber-200 text-amber-800 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 shadow-sm border border-amber-200"
            >
              <Check className="w-4 h-4" /> Checagem Rápida
            </button>
          )}
`;

content = content.replace(
  '<button \n            onClick={saveToBank}',
  buttonToAdd + '          <button \n            onClick={saveToBank}'
);

fs.writeFileSync('src/components/QuestionBankView.tsx', content);
console.log('patched btn');
