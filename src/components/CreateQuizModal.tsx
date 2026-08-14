import React, { useState } from 'react';
import { Search, Folder, Palette } from 'lucide-react';
import { collection, addDoc, doc, getDoc, updateDoc } from 'firebase/firestore';

export function CreateQuizModal({ 
  isOpen, 
  onClose, 
  questions, 
  userFolders, 
  uniqueMainTags, 
  uniqueSubtags, 
  uniqueInstitutions, 
  uniqueYears, 
  auth, 
  db 
}: any) {
  const [newQuizTitle, setNewQuizTitle] = useState('');
  const [newQuizColor, setNewQuizColor] = useState('bg-indigo-500');
  const [modalFilters, setModalFilters] = useState<{mainTags: string[], subtags: string[], institutions: string[], years: string[]}>({ mainTags: [], subtags: [], institutions: [], years: [] });
  const [searchMainTags, setSearchMainTags] = useState('');
  const [searchSubtags, setSearchSubtags] = useState('');
  const [searchInstitutions, setSearchInstitutions] = useState('');
  const [searchYears, setSearchYears] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleFilter = (type: 'mainTags' | 'subtags' | 'institutions' | 'years', value: string) => {
    setModalFilters(prev => {
      const current = prev[type];
      const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  if (!isOpen) return null;

  const filteredQuestions = questions.filter((q: any) => {
    if (modalFilters.mainTags.length > 0 && !modalFilters.mainTags.includes(q.mainTag)) return false;
    if (modalFilters.subtags.length > 0 && !(q.subtags?.some((s: any) => modalFilters.subtags.includes(s)) || (q.subtag && modalFilters.subtags.includes(q.subtag)))) return false;
    if (modalFilters.institutions.length > 0 && !modalFilters.institutions.includes(q.institution || '')) return false;
    if (modalFilters.years.length > 0 && !modalFilters.years.includes(q.year || '')) return false;
    return true;
  });

  return (
    <div className="fixed top-0 left-0 w-full h-[100dvh] bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90dvh] rounded-2xl p-6 shadow-2xl flex flex-col">
        <h2 className="text-xl font-black text-slate-900 mb-4">Criar Caderno de Questões</h2>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-6">
          <div className="space-y-6">
            {/* INFORMAÇÕES DO CADERNO */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Detalhes do Caderno</h3>
              
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Nome do Caderno</label>
                <input 
                  type="text" 
                  value={newQuizTitle}
                  onChange={e => setNewQuizTitle(e.target.value)}
                  placeholder="Ex: Revisão Final 2026"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-sm focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Pasta (Opcional)</label>
                <select 
                  id="newQuizFolderInput"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 outline-none font-medium text-sm focus:border-indigo-500 appearance-none"
                >
                  <option value="">Sem Pasta</option>
                  {Object.keys(userFolders || {}).map(folder => (
                    <option key={folder} value={folder}>{folder}</option>
                  ))}
                  <option value="Nova Pasta...">+ Criar Nova Pasta...</option>
                </select>
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest flex items-center gap-1"><Palette className="w-3 h-3"/> Cor da Capa</label>
                <div className="flex flex-wrap gap-2">
                  {['bg-indigo-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-amber-500', 'bg-violet-500', 'bg-cyan-500', 'bg-pink-500'].map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewQuizColor(color)}
                      className={`w-8 h-8 rounded-full ${color} transition-transform hover:scale-110 ${newQuizColor === color ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : ''}`}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* FILTROS */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-200 pb-2">Selecionar Questões</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Grandes Áreas</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Buscar área..."
                      value={searchMainTags}
                      onChange={e => setSearchMainTags(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {uniqueMainTags.filter((t: string) => t.toLowerCase().includes(searchMainTags.toLowerCase())).map((tag: string, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={modalFilters.mainTags.includes(tag)}
                          onChange={() => handleToggleFilter('mainTags', tag)}
                          className="text-indigo-600 rounded border-slate-300"
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Assuntos</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Buscar assunto..."
                      value={searchSubtags}
                      onChange={e => setSearchSubtags(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {uniqueSubtags.filter((t: string) => t.toLowerCase().includes(searchSubtags.toLowerCase())).map((tag: string, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={modalFilters.subtags.includes(tag)}
                          onChange={() => handleToggleFilter('subtags', tag)}
                          className="text-indigo-600 rounded border-slate-300"
                        />
                        {tag}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Bancas</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Buscar banca..."
                      value={searchInstitutions}
                      onChange={e => setSearchInstitutions(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {uniqueInstitutions.filter((inst: string) => inst.toLowerCase().includes(searchInstitutions.toLowerCase())).map((inst: string, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={modalFilters.institutions.includes(inst)}
                          onChange={() => handleToggleFilter('institutions', inst)}
                          className="text-indigo-600 rounded border-slate-300"
                        />
                        {inst}
                      </label>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Anos</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input 
                      type="text"
                      placeholder="Buscar ano..."
                      value={searchYears}
                      onChange={e => setSearchYears(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="max-h-32 overflow-y-auto bg-white border border-slate-200 rounded-lg p-2 space-y-1">
                    {uniqueYears.filter((yr: string) => yr.toLowerCase().includes(searchYears.toLowerCase())).map((yr: string, i: number) => (
                      <label key={i} className="flex items-center gap-2 text-sm font-medium text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded">
                        <input 
                          type="checkbox" 
                          checked={modalFilters.years.includes(yr)}
                          onChange={() => handleToggleFilter('years', yr)}
                          className="text-indigo-600 rounded border-slate-300"
                        />
                        {yr}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* FOOTER */}
        <div className="pt-6 mt-auto border-t border-slate-100 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-700">
            {filteredQuestions.length} questões selecionadas
          </div>

          <div className="flex gap-2">
            <button 
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
            >
              Cancelar
            </button>
            <button 
              onClick={async () => {
                if(!newQuizTitle.trim()) return alert('Preencha o nome do caderno.');
                if (filteredQuestions.length === 0) return alert('Nenhuma questão selecionada com esses filtros.');

                try {
                  setIsSubmitting(true);
                  const el = document.getElementById('newQuizFolderInput') as HTMLInputElement;
                  let folderVal = el ? el.value.trim() : '';
                  
                  if (folderVal === 'Nova Pasta...') {
                    const promptVal = prompt("Digite o nome da nova pasta:");
                    if (!promptVal || !promptVal.trim()) {
                      setIsSubmitting(false);
                      return;
                    }
                    folderVal = promptVal.trim();
                  }

                  const qData = {
                    title: newQuizTitle,
                    tag: folderVal || null,
                    questions: filteredQuestions.map((q: any) => ({
                      id: Math.random().toString(36).substring(2,10),
                      type: q.type,
                      text: q.text,
                      options: q.options || [],
                      correctAnswer: q.correctAnswer,
                      explanation: q.explanation || '',
                      category: q.mainTag || '',
                      images: q.images || (q.image ? [q.image] : [])
                    })),
                    userId: auth.currentUser!.uid,
                    createdAt: new Date().toISOString()
                  };
                  await addDoc(collection(db, 'quizzes'), qData);
                  
                  if (folderVal) {
                      const userRef = doc(db, 'users', auth.currentUser!.uid);
                      const userSnap = await getDoc(userRef);
                      if (userSnap.exists()) {
                          const data = userSnap.data();
                          const currentColors = data.folderColors || {};
                          if (!currentColors[folderVal]) {
                              await updateDoc(userRef, {
                                  [`folderColors.${folderVal}`]: newQuizColor
                              });
                          }
                      }
                  }

                  setIsSubmitting(false);
                  onClose();
                  alert('Caderno criado com sucesso!');
                } catch (e) {
                  setIsSubmitting(false);
                  console.error(e);
                  alert('Erro ao criar caderno.');
                }
              }}
              disabled={isSubmitting}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold shadow-md shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {isSubmitting ? 'Criando...' : 'Criar Caderno'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
