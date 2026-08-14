const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

// In processQuestions
code = code.replace(/institution, year, auth\.currentUser\?\.uid \|\| ''\);/g, "globalInstitution, globalYear, auth.currentUser?.uid || '');");
code = code.replace(/institution,\n            year,/g, "institution: globalInstitution,\n            year: globalYear,");
code = code.replace(/predefinedTags: usePredefinedTags \? { usePredefined: true, mainTag, subtag } : { usePredefined: false }/g, "predefinedTags: usePredefinedTags ? { usePredefined: true, mainTag: globalMainTag, subtags: globalSubtags } : { usePredefined: false }");
code = code.replace(/usePredefinedTags \? mainTag : 'Clínica Médica', usePredefinedTags \? subtag : ''/g, "usePredefinedTags ? globalMainTag : 'Clínica Médica', usePredefinedTags ? (globalSubtags[0] || '') : ''");

// In addManualQuestion
code = code.replace(/mainTag: mainTag \|\| 'Clínica Médica',\n      subtag: subtag \|\| '',\n      institution: institution \|\| '',\n      year: year \|\| ''/, 
`mainTag: usePredefinedTags ? globalMainTag : 'Clínica Médica',
      subtags: usePredefinedTags ? [...globalSubtags] : [],
      subtag: usePredefinedTags ? (globalSubtags[0] || '') : '',
      institution: globalInstitution,
      year: globalYear`);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
