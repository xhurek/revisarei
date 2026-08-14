const fs = require('fs');

let content = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

// Remove batchMode from QuestionBankView
content = content.replace(
  "const [filterYear, setFilterYear] = useState('');\n  const [batchMode, setBatchMode] = useState<'pdf' | 'zip'>('pdf');",
  "const [filterYear, setFilterYear] = useState('');"
);

// Add batchMode to AddQuestionsView
content = content.replace(
  "const [isManualModeOpen, setIsManualModeOpen] = useState(false);",
  "const [isManualModeOpen, setIsManualModeOpen] = useState(false);\n  const [batchMode, setBatchMode] = useState<'pdf' | 'zip'>('pdf');"
);

fs.writeFileSync('src/components/QuestionBankView.tsx', content);
console.log('Patched batchMode in QuestionBankView.tsx');
