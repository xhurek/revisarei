const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

code = code.replace(/parseQuestionsFromText\(rawText, mainTag, subtag, institution, year\);/, 
  "parseQuestionsFromText(rawText, globalMainTag, globalSubtags[0], globalInstitution, globalYear);");

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
