const fs = require('fs');
let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// 1. Add editingTitleId state
content = content.replace(
  "const [customIconUrl, setCustomIconUrl] = useState('');",
  "const [customIconUrl, setCustomIconUrl] = useState('');\n  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);"
);

// 2. Modify handleAddTitleDef to handle Update
const newHandleAdd = `
  const handleAddTitleDef = async () => {
    if (!newTitleName.trim() || newTitleReq < 0) return;
    try {
      const colorObj = COLOR_OPTIONS[selectedColorIndex] || COLOR_OPTIONS[0];
      const colorStr = \`\${colorObj.bg}|\${colorObj.text}|\${colorObj.border}\`;
      
      const titleData = {
        name: newTitleName.trim(),
        requirement: newTitleReq,
        criteria: newTitleCriteria,
        icon: customIconUrl.trim() || selectedIconName,
        color: colorStr
      };

      if (editingTitleId) {
        await updateDoc(doc(db, 'titles', editingTitleId), titleData);
        setTitles(prev => prev.map(t => t.id === editingTitleId ? { id: editingTitleId, ...titleData } : t).sort((a, b) => a.requirement - b.requirement));
        setEditingTitleId(null);
        alert('Conquista atualizada com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'titles'), titleData);
        setTitles(prev => [...prev, { id: docRef.id, ...titleData }].sort((a, b) => a.requirement - b.requirement));
        alert('Conquista criada com sucesso!');
      }
      
      setNewTitleName('');
      setNewTitleReq(0);
      setCustomIconUrl('');
      setSelectedIconName('Award');
      setSelectedColorIndex(0);
    } catch (err) {
      handleFirestoreError(err, editingTitleId ? OperationType.UPDATE : OperationType.CREATE, 'titles');
    }
  };

  const handleEditTitleDef = (t: TitleDefinition) => {
    setEditingTitleId(t.id || null);
    setNewTitleName(t.name);
    setNewTitleReq(t.requirement);
    setNewTitleCriteria(t.criteria);
    
    if (t.icon && t.icon.startsWith('http')) {
      setCustomIconUrl(t.icon);
      setSelectedIconName('');
    } else {
      setSelectedIconName(t.icon || 'Award');
      setCustomIconUrl('');
    }

    if (t.color) {
      const idx = COLOR_OPTIONS.findIndex(c => t.color!.includes(c.bg));
      setSelectedColorIndex(idx >= 0 ? idx : 0);
    } else {
      setSelectedColorIndex(0);
    }
    
    // Scroll to top or form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
`;

content = content.replace(
  /const handleAddTitleDef = async \(\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?handleFirestoreError[\s\S]*?\}[\s\S]*?\};/,
  newHandleAdd
);

// 3. Fix handleRestoreDefaults to avoid window.location.reload
content = content.replace(
  "alert('Conquistas restauradas com sucesso!');\n      window.location.reload();",
  "alert('Conquistas restauradas com sucesso!');\n      await fetchAdminData();"
);

// 4. Update the Form UI
content = content.replace(
  '<Plus className="w-5 h-5 text-indigo-600" /> Nova Conquista',
  '{editingTitleId ? <Edit3 className="w-5 h-5 text-amber-600" /> : <Plus className="w-5 h-5 text-indigo-600" />} {editingTitleId ? "Editar Conquista" : "Nova Conquista"}'
);

content = content.replace(
  'Criar Conquista',
  '{editingTitleId ? "Salvar Alterações" : "Criar Conquista"}'
);

// Add a cancel button
content = content.replace(
  /<button onClick=\{handleAddTitleDef\}[\s\S]*?>[\s\S]*?\{editingTitleId \? "Salvar Alterações" : "Criar Conquista"\}[\s\S]*?<\/button>/,
  `
  <div className="flex gap-4">
    <button onClick={handleAddTitleDef} className="flex-1 bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-indigo-600 transition shadow-lg shadow-slate-200">
      {editingTitleId ? "Salvar Alterações" : "Criar Conquista"}
    </button>
    {editingTitleId && (
      <button onClick={() => {
        setEditingTitleId(null);
        setNewTitleName('');
        setNewTitleReq(0);
        setCustomIconUrl('');
      }} className="px-6 bg-white text-slate-500 font-bold py-4 rounded-2xl hover:bg-slate-50 border border-slate-200 transition">
        Cancelar
      </button>
    )}
  </div>
  `
);

// 5. Add edit button to the list
content = content.replace(
  /<button onClick=\{.*?handleDeleteTitleDef.*?<\/button>/g,
  `
  <div className="flex items-center gap-1">
    <button onClick={() => handleEditTitleDef(title)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors" title="Editar">
      <Edit3 className="w-5 h-5" />
    </button>
    <button onClick={() => handleDeleteTitleDef(title.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Excluir">
      <Trash2 className="w-5 h-5" />
    </button>
  </div>
  `
);

// Add Edit3 import
content = content.replace(
  'Trash2,',
  'Trash2, Edit3,'
);

fs.writeFileSync('src/components/AdminView.tsx', content);
console.log('patched admin edit');
