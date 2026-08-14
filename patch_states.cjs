const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

code = code.replace(
  "const [usePredefinedTags, setUsePredefinedTags] = useState(false);\n  const [mainTag, setMainTag] = useState('Clínica Médica');\n  const [subtag, setSubtag] = useState('');",
  "const [usePredefinedTags, setUsePredefinedTags] = useState(false);\n  const [globalMainTag, setGlobalMainTag] = useState('Clínica Médica');\n  const [globalSubtags, setGlobalSubtags] = useState<string[]>([]);\n  const [globalSubtagInput, setGlobalSubtagInput] = useState('');"
);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
