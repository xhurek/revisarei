const fs = require('fs');
let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// 1. Add RefreshCcw to imports
content = content.replace(
  'Upload',
  'Upload, RefreshCcw'
);

// 2. Add handleRestoreDefaults function
const restoreFunction = `
  const handleRestoreDefaults = async () => {
    if (!confirm('Atenção: Isso excluirá todas as conquistas atuais e restaurará os padrões do sistema (Calouro, Café-com-leite, etc). Deseja continuar?')) return;
    try {
      const snap = await getDocs(collection(db, 'titles'));
      const deletions = snap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletions);
      
      const defaults = [
        { name: 'Calouro', requirement: 0, criteria: 'total_questions', icon: 'User', color: 'bg-slate-50|text-slate-600|border-slate-200' },
        { name: 'Café-com-leite', requirement: 250, criteria: 'total_questions', icon: 'Sparkles', color: 'bg-orange-50|text-orange-600|border-orange-100' },
        { name: 'Aprendiz', requirement: 500, criteria: 'total_questions', icon: 'GraduationCap', color: 'bg-emerald-50|text-emerald-600|border-emerald-100' },
        { name: 'Estudante', requirement: 1000, criteria: 'total_questions', icon: 'Brain', color: 'bg-blue-50|text-blue-600|border-blue-100' },
        { name: 'Interno de Plantão', requirement: 2000, criteria: 'total_questions', icon: 'Stethoscope', color: 'bg-indigo-50|text-indigo-600|border-indigo-100' },
        { name: 'Sabe muito', requirement: 4000, criteria: 'total_questions', icon: 'Flame', color: 'bg-rose-50|text-rose-600|border-rose-100' },
        { name: 'Lenda', requirement: 7000, criteria: 'total_questions', icon: 'Trophy', color: 'bg-amber-50|text-amber-600|border-amber-100' },
        { name: 'Gênio', requirement: 10000, criteria: 'total_questions', icon: 'Zap', color: 'bg-violet-50|text-violet-600|border-violet-100' }
      ];

      for (const t of defaults) {
        await addDoc(collection(db, 'titles'), t);
      }
      
      alert('Conquistas restauradas com sucesso!');
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert('Erro ao restaurar');
    }
  };
`;

content = content.replace(
  '  const handleDeleteTitleDef = async (id: string) => {',
  restoreFunction + '\n  const handleDeleteTitleDef = async (id: string) => {'
);

// 3. Add the button
const buttonHtml = `
            <div className="flex justify-end mb-4">
               <button onClick={handleRestoreDefaults} className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition flex items-center gap-2 bg-slate-100 hover:bg-indigo-50 px-4 py-2 rounded-xl">
                 <RefreshCcw className="w-4 h-4" /> Restaurar Conquistas do Sistema
               </button>
            </div>
`;

content = content.replace(
  '<div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">',
  buttonHtml + '            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">'
);

fs.writeFileSync('src/components/AdminView.tsx', content);
console.log('AdminView patched successfully');
