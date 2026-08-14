const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

const modalStart = code.indexOf('{isCreateQuizModalOpen && (');
if (modalStart === -1) {
  console.log("Could not find modal start");
  process.exit(1);
}

// Find the matching closing brace/parenthesis for the modal
let braceCount = 0;
let modalEnd = -1;
for (let i = modalStart; i < code.length; i++) {
  if (code[i] === '{') braceCount++;
  if (code[i] === '}') {
    braceCount--;
    if (braceCount === 0) {
      modalEnd = i;
      break;
    }
  }
}

if (modalEnd === -1) {
  console.log("Could not find modal end");
  process.exit(1);
}

const modalContent = code.substring(modalStart, modalEnd + 1);

let newCode = code.replace(modalContent, `
      <CreateQuizModal 
        isOpen={isCreateQuizModalOpen}
        onClose={() => setIsCreateQuizModalOpen(false)}
        questions={questions}
        userFolders={userFolders}
        uniqueMainTags={uniqueMainTags}
        uniqueSubtags={uniqueSubtags}
        uniqueInstitutions={uniqueInstitutions}
        uniqueYears={uniqueYears}
        auth={auth}
        db={db}
      />
`);

// Now let's remove the modal states from QuestionBankView
newCode = newCode.replace(/const \[newQuizTitle, setNewQuizTitle\] = useState\(''\);\n/, '');
newCode = newCode.replace(/const \[newQuizColor, setNewQuizColor\] = useState\('bg-indigo-500'\);\n/, '');
newCode = newCode.replace(/const \[modalFilters, setModalFilters\] = useState.*?;\n/, '');
newCode = newCode.replace(/const \[searchMainTags, setSearchMainTags\] = useState\(''\);\n/, '');
newCode = newCode.replace(/const \[searchSubtags, setSearchSubtags\] = useState\(''\);\n/, '');
newCode = newCode.replace(/const \[searchInstitutions, setSearchInstitutions\] = useState\(''\);\n/, '');
newCode = newCode.replace(/const \[searchYears, setSearchYears\] = useState\(''\);\n/, '');

// We also need to remove handleToggleFilter from QuestionBankView
const handleToggleStart = newCode.indexOf('const handleToggleFilter = (type:');
if (handleToggleStart !== -1) {
    let braceCount = 0;
    let handleToggleEnd = -1;
    let foundFirstBrace = false;
    for (let i = handleToggleStart; i < newCode.length; i++) {
        if (newCode[i] === '{') {
            braceCount++;
            foundFirstBrace = true;
        }
        if (newCode[i] === '}') {
            braceCount--;
            if (foundFirstBrace && braceCount === 0) {
                handleToggleEnd = i;
                break;
            }
        }
    }
    if (handleToggleEnd !== -1) {
        newCode = newCode.substring(0, handleToggleStart) + newCode.substring(handleToggleEnd + 1);
    }
}

// Add the import for CreateQuizModal
newCode = "import { CreateQuizModal } from './CreateQuizModal';\n" + newCode;

fs.writeFileSync('src/components/QuestionBankView.tsx', newCode);
console.log("Successfully extracted modal");
