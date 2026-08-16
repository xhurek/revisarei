import React, { useState, useEffect, useRef } from 'react';
import { collection, getDocs, addDoc, doc, deleteDoc, updateDoc, onSnapshot, query, orderBy, setDoc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, apiFetch, parseJsonResponse, OperationType } from '../lib/firebase';
import { StudyNote } from '../types';
import { Folder, FileText, Plus, Download, Trash2, Pencil, Palette, X, ArrowLeft, Tag, Globe, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudyNotesEditor } from './StudyNotesEditor';

export function StudyNotesSection() {
  const [notes, setNotes] = useState<StudyNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<StudyNote | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteFolder, setNewNoteFolder] = useState('');
  
  const [folderColors, setFolderColors] = useState<{ [key: string]: string }>({});
  const [activeColorPicker, setActiveColorPicker] = useState<string | null>(null);
  const [editingFolder, setEditingFolder] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [deletingFolder, setDeletingFolder] = useState<string | null>(null);

  const fileReaderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Fetch folder colors
    getDoc(doc(db, 'users', auth.currentUser.uid)).then(docSnap => {
      if (docSnap.exists() && docSnap.data().folderColors) {
        setFolderColors(docSnap.data().folderColors);
      }
    });

    const q = query(collection(db, `users/${auth.currentUser.uid}/studyNotes`), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notesData: StudyNote[] = [];
      snapshot.forEach((doc) => {
        notesData.push({ id: doc.id, ...doc.data() } as StudyNote);
      });
      setNotes(notesData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching study notes:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectFolder = (folder: string) => {
    setSelectedFolder(folder);
    setTimeout(() => {
      window.scrollBy({ top: 120, behavior: 'smooth' });
    }, 100);
  };

  const handleCreateNew = () => {
    setIsCreating(true);
    setTimeout(() => {
      if (window.scrollY < 250) {
        window.scrollBy({ top: 300, behavior: 'smooth' });
      }
    }, 100);
  };

  const handleUpdateFolderColor = async (folder: string, color: string) => {
    if (!auth.currentUser) return;
    const newColors = { ...folderColors, [folder]: color };
    setFolderColors(newColors);
    setActiveColorPicker(null);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), { folderColors: newColors }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deletingFolder || !auth.currentUser) return;
    try {
      const folderNotes = notes.filter(n => n.folder === deletingFolder);
      await Promise.all(folderNotes.map(async (n) => {
        if (n.isPublic) {
          try { await deleteDoc(doc(db, 'publicStudyNotes', n.id!)); } catch(e){}
        }
        return deleteDoc(doc(db, `users/${auth.currentUser?.uid}/studyNotes`, n.id!));
      }));
      setDeletingFolder(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, null);
    }
  };

  const handleRenameFolder = async () => {
    if (!editingFolder || !editFolderName.trim() || !auth.currentUser) return;
    try {
      const folderNotes = notes.filter(n => n.folder === editingFolder);
      await Promise.all(folderNotes.map(async (n) => {
        if (n.isPublic) {
          try { await updateDoc(doc(db, 'publicStudyNotes', n.id!), { folder: editFolderName }); } catch(e){}
        }
        return updateDoc(doc(db, `users/${auth.currentUser?.uid}/studyNotes`, n.id!), { folder: editFolderName });
      }));
      
      if (folderColors[editingFolder]) {
        const newColors = { ...folderColors };
        newColors[editFolderName] = newColors[editingFolder];
        delete newColors[editingFolder];
        setFolderColors(newColors);
        await setDoc(doc(db, 'users', auth.currentUser.uid), { folderColors: newColors }, { merge: true });
      }
      setEditingFolder(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, null);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteTitle.trim() || !newNoteFolder.trim()) {
      alert("Preencha título e pasta");
      return;
    }
    
    try {
      const newNote = {
        title: newNoteTitle,
        folder: newNoteFolder,
        content: `<h1>${newNoteTitle}</h1><p>Comece a escrever aqui...</p>`,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || '',
        isPublic: false
      };
      
      const docRef = await addDoc(collection(db, `users/${auth.currentUser?.uid}/studyNotes`), newNote);
      setEditingNote({ id: docRef.id, ...newNote });
      setIsCreating(false);
      setNewNoteTitle('');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, null);
    }
  };

  const handleSaveNote = async (updatedNote: StudyNote) => {
    if (!updatedNote.id || !auth.currentUser) return;
    try {
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.exists() ? userDoc.data() : {};
      const authorName = auth.currentUser.displayName || userData.name || 'Estudante';
      const authorPhoto = auth.currentUser.photoURL || '';
      const authorTitle = userData.title || 'Estudante';

      await updateDoc(doc(db, `users/${auth.currentUser.uid}/studyNotes`, updatedNote.id), {
        title: updatedNote.title,
        content: updatedNote.content,
        isPublic: !!updatedNote.isPublic,
        authorName,
        authorPhoto,
        authorTitle
      });

      if (updatedNote.isPublic) {
        await setDoc(doc(db, 'publicStudyNotes', updatedNote.id), {
          title: updatedNote.title,
          content: updatedNote.content,
          folder: updatedNote.folder || 'Geral',
          userId: auth.currentUser.uid,
          authorName,
          authorPhoto,
          authorTitle,
          isPublic: true,
          likes: updatedNote.likes || [],
          createdAt: updatedNote.createdAt || new Date().toISOString(),
          originalNoteId: updatedNote.id
        }, { merge: true });
      } else {
        try {
          await deleteDoc(doc(db, 'publicStudyNotes', updatedNote.id));
        } catch (e) {}
      }

      // Update local state of editingNote if currently open
      if (editingNote && editingNote.id === updatedNote.id) {
        setEditingNote({ ...updatedNote, isPublic: !!updatedNote.isPublic, authorName, authorPhoto, authorTitle });
      }
      
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, null);
    }
  };

  const handleDeleteNote = async (note: StudyNote, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!note.id || !auth.currentUser) return;
    if (!confirm('Excluir este caderno de estudo?')) return;
    try {
      if (note.isPublic) {
        try { await deleteDoc(doc(db, 'publicStudyNotes', note.id)); } catch(e){}
      }
      await deleteDoc(doc(db, `users/${auth.currentUser?.uid}/studyNotes`, note.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, null);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      setLoading(true);
      const res = await apiFetch('/api/parse-document', {
        method: 'POST',
        body: formData
      });
      
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Erro ao importar arquivo');
      }
      
      const data = await res.json();
      
      let htmlContent = data.text;
      if (!htmlContent.includes('<p>') && !htmlContent.includes('<h1>')) {
         htmlContent = htmlContent.split('\n').map((line: string) => `<p>${line}</p>`).join('');
      }

      const newFolder = prompt("Nome da pasta para este caderno:") || "Importados";

      const newNote = {
        title: file.name.replace(/\.[^/.]+$/, ""),
        folder: newFolder,
        content: htmlContent,
        createdAt: new Date().toISOString(),
        createdBy: auth.currentUser?.uid || ''
      };
      
      const docRef = await addDoc(collection(db, `users/${auth.currentUser.uid}/studyNotes`), newNote);
      setEditingNote({ id: docRef.id, ...newNote });
      
    } catch (err: any) {
      alert("Erro ao importar: " + err.message);
    } finally {
      setLoading(false);
      if (fileReaderRef.current) fileReaderRef.current.value = '';
    }
  };

  if (editingNote) {
    const defaultColors = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-green-500'];
    const colorStr = editingNote.folder ? (folderColors[editingNote.folder] || defaultColors[editingNote.folder.length % defaultColors.length]) : 'bg-slate-500';

    return (
      <div className="fixed inset-0 z-[100] bg-slate-50 overflow-hidden flex flex-col">
         <StudyNotesEditor 
            note={editingNote} 
            onSave={handleSaveNote} 
            onBack={() => setEditingNote(null)} 
            folderColor={colorStr}
         />
      </div>
    );
  }

  const folders: string[] = Array.from(new Set(notes.map(n => n.folder || 'Sem pasta')));

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto mt-16 pt-8 border-t border-slate-200 relative pb-16">
      {/* Editing Folder Modal */}
      {editingFolder && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-bold text-slate-900 mb-6 font-sans">Editar Pasta (Caderno de Estudo)</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Nome da Pasta</label>
                  <input 
                    type="text" 
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 transition-colors text-slate-800 font-medium"
                    placeholder="Ex: Anatomia"
                  />
                  <p className="text-xs text-slate-500 mt-2">Isso atualizará a pasta para todos os materiais dentro dela.</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setEditingFolder(null)} className="px-4 py-2 font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
              <button onClick={handleRenameFolder} className="px-5 py-2 font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-sm">Salvar Alterações</button>
            </div>
          </div>
        </div>
      )}

      {/* Deleting Folder Modal */}
      {deletingFolder && (
        <div className="fixed top-0 left-0 w-full h-[100dvh] bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden text-center">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2 font-sans">Excluir Pasta?</h2>
              <p className="text-slate-600 font-medium text-sm">
                Isso removerá permanentemente a pasta <strong>{deletingFolder}</strong> e <strong>TODOS</strong> os materiais dentro dela. Você não poderá desfazer essa ação.
              </p>
            </div>
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button onClick={handleDeleteFolder} className="w-full px-5 py-3 font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm">Sim, Excluir Tudo</button>
              <button onClick={() => setDeletingFolder(null)} className="w-full px-5 py-3 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Cadernos de Estudo</h2>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 border-l-4 border-emerald-500 pl-4 mt-1">Materiais e Resumos</h1>
        </div>
        <div className="flex gap-2 self-end md:self-auto">
          <button 
            onClick={() => fileReaderRef.current?.click()}
            className="bg-slate-100 text-slate-700 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition shadow-sm border border-slate-200"
          >
            <Download className="w-5 h-5" /> <span className="hidden sm:inline">Importar</span>
            <input type="file" ref={fileReaderRef} onChange={handleImport} className="hidden" accept=".pdf,.docx,.txt" />
          </button>
          <button 
            onClick={handleCreateNew}
            className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg shadow-emerald-100"
          >
            <Plus className="w-5 h-5" /> Novo <span className="hidden sm:inline">Material</span>
          </button>
        </div>
      </header>

      {isCreating && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
           <h3 className="text-lg font-bold text-slate-800">Novo Caderno de Estudo</h3>
           <div className="grid md:grid-cols-2 gap-4">
              <div>
                 <label className="block text-sm font-bold text-slate-600 mb-1">Título</label>
                 <input type="text" value={newNoteTitle} onChange={e => setNewNoteTitle(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
              </div>
              <div>
                 <label className="block text-sm font-bold text-slate-600 mb-1">Pasta</label>
                 <input type="text" value={newNoteFolder} onChange={e => setNewNoteFolder(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 outline-none focus:border-emerald-500" />
              </div>
           </div>
           <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setIsCreating(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-lg">Cancelar</button>
              <button onClick={handleCreateNote} className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700">Criar e Editar</button>
           </div>
        </motion.div>
      )}

      {selectedFolder === null ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {folders.map(folder => {
            const count = notes.filter(n => n.folder === folder).length;
            const defaultColors = ['bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-lime-500', 'bg-green-500'];
            const colorStr = folderColors[folder] || defaultColors[folder.length % defaultColors.length];

            return (
              <div key={folder} className={`${colorStr} text-white p-6 rounded-3xl shadow-md cursor-pointer hover:scale-[1.02] hover:shadow-lg transition flex flex-col justify-between min-h-[160px] relative group`} onClick={(e) => {
                if ((e.target as HTMLElement).closest('.color-picker')) return;
                handleSelectFolder(folder);
              }}>
                <div className="flex justify-between items-start">
                  <Folder className="w-8 h-8 text-white/80" />

                  <div className="color-picker flex gap-1 relative opacity-0 group-hover:opacity-100 transition-opacity">
                     <button 
                       className="p-1.5 hover:bg-white/20 rounded-md" 
                       title="Editar pasta" 
                       onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); setEditFolderName(folder); setActiveColorPicker(null); }}
                     >
                       <Pencil className="w-4 h-4 text-white" />
                     </button>
                     <button 
                       className="p-1.5 hover:bg-white/20 rounded-md" 
                       title="Cor da pasta"
                       onClick={(e) => { e.stopPropagation(); setActiveColorPicker(activeColorPicker === folder ? null : folder); }}
                     >
                       <Palette className="w-4 h-4 text-white" />
                     </button>
                     <button 
                       className="p-1.5 hover:bg-red-500/80 rounded-md transition-colors" 
                       title="Excluir pasta"
                       onClick={(e) => { e.stopPropagation(); setDeletingFolder(folder); setActiveColorPicker(null); }}
                     >
                       <Trash2 className="w-4 h-4 text-white" />
                     </button>
                  </div>

                  {activeColorPicker === folder && (
                    <div className="color-picker absolute top-10 right-0 bg-white rounded-xl shadow-xl p-3 border border-slate-100 z-10 w-48 animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-bold text-slate-500 uppercase">Cor da Pasta</span>
                        <button onClick={() => setActiveColorPicker(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {['bg-slate-500', 'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 'bg-pink-500', 'bg-rose-500', 'bg-neutral-800'].map(color => (
                          <button
                            key={color}
                            className={`w-8 h-8 rounded-full ${color} border-2 ${folderColors[folder] === color ? 'border-slate-800 scale-110' : 'border-transparent'} hover:scale-110 transition-transform`}
                            onClick={() => handleUpdateFolderColor(folder, color)}
                            title={color.replace('bg-', '').replace('-500', '')}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1 line-clamp-2 leading-tight">{folder}</h3>
                  <p className="text-emerald-100 font-medium text-sm">{count} material(s)</p>
                </div>
              </div>
            );
          })}
          {folders.length === 0 && !loading && (
            <div className="col-span-full text-center py-12 text-slate-500">
               Nenhum caderno de estudo. Crie ou importe um novo.
            </div>
          )}
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="space-y-6">
           <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
             <button onClick={() => setSelectedFolder(null)} className="p-2 hover:bg-slate-200 text-slate-500 rounded-lg transition"><ArrowLeft className="w-5 h-5"/></button>
             <div>
               <h3 className="text-sm font-bold text-slate-400 tracking-widest uppercase">Pasta</h3>
               <h2 className="text-xl font-bold text-slate-800">{selectedFolder}</h2>
             </div>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             {notes.filter(n => n.folder === selectedFolder).map(note => (
                <div key={note.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:shadow-md transition-all flex flex-col h-full relative group">
                   <div className="absolute top-4 right-4 flex gap-1 bg-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => handleDeleteNote(note, e)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded" title="Excluir Material">
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                   
                   <div className="flex flex-wrap gap-1.5 mb-3 items-center">
                     <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-widest">
                       <Tag className="w-3 h-3" />
                       {note.folder || "Sem pasta"}
                     </span>

                     {note.isPublic && (
                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold tracking-tight border border-emerald-200 shadow-2xs">
                         <Globe className="w-3 h-3 text-emerald-600" />
                         Público no Mundo
                       </span>
                     )}

                     <span className="ml-auto text-[10px] font-bold text-slate-400">
                       {note.createdAt ? new Date(note.createdAt).toLocaleDateString() : ''}
                     </span>
                   </div>
                   
                   <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight flex-1">{note.title}</h3>
                   <p className="text-slate-500 font-medium text-sm mb-6 flex items-center gap-1.5">
                     <FileText className="w-4 h-4 text-emerald-500" />
                     Documento de texto
                   </p>
                   
                   <button 
                     onClick={() => setEditingNote(note)}
                     className="w-full bg-slate-50 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 font-bold py-3 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors mt-auto"
                   >
                     Abrir e Editar
                   </button>
                </div>
             ))}
             {notes.filter(n => n.folder === selectedFolder).length === 0 && (
               <div className="col-span-full text-center py-8 text-slate-500">
                  Pasta vazia.
               </div>
             )}
           </div>
        </motion.div>
      )}
    </div>
  );
}
