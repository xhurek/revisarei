const fs = require('fs');
let code = fs.readFileSync('src/components/QuestionBankView.tsx', 'utf8');

// Replace manual states with unified states
code = code.replace(
  "const [institution, setInstitution] = useState('');\n  const [year, setYear] = useState('');",
  "const [globalInstitution, setGlobalInstitution] = useState('');\n  const [globalYear, setGlobalYear] = useState('');"
);

code = code.replace(
  "const [usePredefinedTags, setUsePredefinedTags] = useState(false);\n  const [mainTag, setMainTag] = useState('');\n  const [subtag, setSubtag] = useState('');",
  "const [usePredefinedTags, setUsePredefinedTags] = useState(false);\n  const [globalMainTag, setGlobalMainTag] = useState('Clínica Médica');\n  const [globalSubtags, setGlobalSubtags] = useState<string[]>([]);\n  const [globalSubtagInput, setGlobalSubtagInput] = useState('');"
);

fs.writeFileSync('src/components/QuestionBankView.tsx', code);
