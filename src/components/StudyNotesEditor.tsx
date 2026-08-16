import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { StudyNote } from '../types';
import { ArrowLeft, Save, Bold, Italic, Underline, FileText, Highlighter, Eraser, ListOrdered, Undo2, Redo2, Heading1, Heading2, Check, AlignJustify, List, Globe, Lock, Share2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  note: StudyNote;
  onSave: (note: StudyNote) => Promise<boolean | void> | void;
  onBack: () => void;
  folderColor?: string;
}

export function StudyNotesEditor({ note, onSave, onBack, folderColor }: Props) {
  const [title, setTitle] = useState(note.title);
  const [isPublic, setIsPublic] = useState(!!note.isPublic);
  const [showPublicModal, setShowPublicModal] = useState(false);
  const [tocMode, setTocMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const [highlightMode, setHighlightMode] = useState(false);
  const [highlightColor, setHighlightColor] = useState('#fef08a'); // default pastel yellow
  const [fontSizePx, setFontSizePx] = useState(16);
  const [tocItems, setTocItems] = useState<{id: string, text: string}[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const tocModeRef = useRef(tocMode);
  const editorRef = useRef<HTMLDivElement>(null);
  const initialContentLoaded = useRef(false);

  const updateToc = () => {
    if (!editorRef.current) return;
    const items: {id: string, text: string}[] = [];
    const seenIds = new Set<string>();
    editorRef.current.querySelectorAll('[id^="toc-"]').forEach(el => {
      if (seenIds.has(el.id)) {
        el.removeAttribute('id');
        return;
      }
      seenIds.add(el.id);
      if (el.textContent?.trim()) {
        items.push({ id: el.id, text: el.textContent.trim() });
      } else {
        el.removeAttribute('id');
      }
    });
    setTocItems(items);
  };

  useEffect(() => {
    tocModeRef.current = tocMode;
  }, [tocMode]);

  useEffect(() => {
    // Ensure Enters create paragraphs instead of divs
    document.execCommand('defaultParagraphSeparator', false, 'p');

    if (editorRef.current && !initialContentLoaded.current) {
      editorRef.current.innerHTML = note.content || '';
      updateToc();
      initialContentLoaded.current = true;
    }

    const handleEditorClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (tocModeRef.current) {
        const block = target.closest('p, h1, h2, h3, h4, h5, h6, li, div');
        if (block && editorRef.current?.contains(block) && block !== editorRef.current) {
          e.preventDefault();
          e.stopPropagation();

          const isRemoving = block.id && block.id.startsWith('toc-');

          if (isRemoving) {
            block.removeAttribute('id');
            block.classList.add('bg-red-100', 'transition-colors');
            setTimeout(() => block.classList.remove('bg-red-100', 'transition-colors'), 500);
            setToastMessage('Removido do sumário');
          } else {
            block.id = 'toc-' + Math.random().toString(36).substr(2, 9);
            block.classList.add('bg-emerald-100', 'transition-colors');
            setTimeout(() => block.classList.remove('bg-emerald-100', 'transition-colors'), 500);
            setToastMessage('Adicionado ao sumário');
          }
          setTimeout(() => setToastMessage(null), 2000);
          
          updateToc();
          return;
        }
      } else {
        // Not in TOC mode: click a TOC item in text to scroll back to top
        const block = target.closest('[id^="toc-"]');
        if (block && editorRef.current?.contains(block)) {
          const tocContainer = document.getElementById('toc-main-container');
          if (tocContainer) {
            tocContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }

      const anchor = target.closest('a');
      if (anchor && anchor.getAttribute('href')?.startsWith('#')) {
        e.preventDefault();
        const id = anchor.getAttribute('href')?.substring(1);
        const el = document.getElementById(id || '');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    const editorEl = editorRef.current;
    if (editorEl) {
      editorEl.addEventListener('click', handleEditorClick);
    }
    return () => {
      if (editorEl) {
        editorEl.removeEventListener('click', handleEditorClick);
      }
    };
  }, [note.content]);

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    
    let hasImage = false;
    const items = e.clipboardData?.items;
    
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          hasImage = true;
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result) {
                document.execCommand('insertImage', false, ev.target.result as string);
              }
            };
            reader.readAsDataURL(blob);
          }
        }
      }
    }

    if (!hasImage) {
      const text = e.clipboardData.getData('text/plain');
      if (text) {
        const paragraphs = text
          .split(/\r?\n/)
          .map(line => line.trim().length > 0 ? `<div>${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>` : '<div><br></div>')
          .join('');
        document.execCommand('insertHTML', false, paragraphs);
      }
    }
    setTimeout(updateToc, 100);
  };

  const handleClearFormat = () => {
    document.execCommand('removeFormat', false, '');

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && !selection.isCollapsed) {
      const range = selection.getRangeAt(0);
      const commonAncestor = range.commonAncestorContainer;
      const container = commonAncestor.nodeType === 1 ? commonAncestor as HTMLElement : commonAncestor.parentElement;

      if (container) {
        const elements = container.querySelectorAll('*');
        elements.forEach(el => {
          if (selection.containsNode(el, true)) {
            el.removeAttribute('style');
            el.removeAttribute('class');
          }
        });
        if (selection.containsNode(container, true)) {
          container.removeAttribute('style');
          container.removeAttribute('class');
        }
      }
    }
  };

  const handleApplyHeading = (level: 'H1' | 'H2') => {
    document.execCommand('fontSize', false, '7');
    const fonts = editorRef.current?.querySelectorAll('font[size="7"]');
    const size = level === 'H1' ? '18px' : '16px';
    fonts?.forEach(f => {
      f.removeAttribute('size');
      f.style.fontSize = size;
      f.style.fontWeight = 'bold';
    });
    if (editorRef.current) {
      updateToc();
    }
  };

  const handleStepFontSize = (delta: number) => {
    const newSize = Math.max(12, Math.min(48, fontSizePx + delta * 2));
    setFontSizePx(newSize);

    document.execCommand('fontSize', false, '7');
    const fonts = editorRef.current?.querySelectorAll('font[size="7"]');
    fonts?.forEach(f => {
      f.removeAttribute('size');
      f.style.fontSize = `${newSize}px`;
    });

  };

  const handleToggleBulletList = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand('insertUnorderedList', false);
    updateToc();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  const handleEditorMouseUp = () => {
    if (highlightMode) {
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) {
        document.execCommand('backColor', false, highlightColor);
      }
    }
  };

  const handleHighlight = () => {
    if (highlightMode) {
       setHighlightMode(false);
       return;
    }
    
    setHighlightMode(true);
    
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
      document.execCommand('backColor', false, highlightColor);
    }
  };

  const handleSave = async (overridePublic?: boolean) => {
    setIsSaving(true);
    const updatedContent = editorRef.current?.innerHTML || '';
    const finalPublic = overridePublic !== undefined ? overridePublic : isPublic;
    await onSave({ ...note, title, content: updatedContent, isPublic: finalPublic });
    setIsSaving(false);
    setSavedVisible(true);
    setTimeout(() => setSavedVisible(false), 2000);
  };

  const togglePublic = async () => {
    const nextPublic = !isPublic;
    setIsPublic(nextPublic);
    setShowPublicModal(false);
    setToastMessage(nextPublic ? 'Caderno tornado público no Mundo!' : 'Caderno tornado privado.');
    setTimeout(() => setToastMessage(null), 3000);
    await handleSave(nextPublic);
  };

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-50 flex flex-col font-sans overflow-hidden">
      <style>{`
        [id^="toc-"] {
          cursor: pointer;
          transition: all 0.2s;
        }
        [id^="toc-"]:hover {
          color: #059669 !important;
        }
        .study-editor-content ul,
        div[contenteditable="true"] ul {
          list-style-type: disc !important;
          list-style-position: outside !important;
          padding-left: 2rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .study-editor-content ol,
        div[contenteditable="true"] ol {
          list-style-type: decimal !important;
          list-style-position: outside !important;
          padding-left: 2rem !important;
          margin-top: 0.5rem !important;
          margin-bottom: 0.5rem !important;
        }
        .study-editor-content li,
        div[contenteditable="true"] li {
          display: list-item !important;
          list-style-type: disc !important;
          margin-top: 0.25rem !important;
          margin-bottom: 0.25rem !important;
          padding-left: 0.25rem !important;
        }
      `}</style>

      {/* Public Visibility Modal */}
      {showPublicModal && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 min-h-screen min-h-[100dvh] w-screen h-screen bg-slate-950/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              {isPublic ? 'Visibilidade: Público no Mundo' : 'Compartilhar na Comunidade (Mundo)'}
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed mb-6">
              {isPublic
                ? 'Este caderno está visível publicamente na aba Mundo com seu nome, foto e título atualizado. Outros usuários podem ler e salvar uma cópia para eles sem alterar seu material original.'
                : 'Ao tornar este caderno público, ele aparecerá na aba Mundo para toda a comunidade. Ele exibirá a etiqueta [Estudo], sua foto de perfil e seu título de estudante atualizado. Outros usuários poderão salvar uma cópia nos cadernos deles (as edições deles não alteram o seu caderno).'}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
              <button
                onClick={() => setShowPublicModal(false)}
                className="px-4 py-2.5 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition text-sm"
              >
                Fechar
              </button>
              <button
                onClick={togglePublic}
                className={cn(
                  "px-5 py-2.5 rounded-xl font-bold text-white transition text-sm flex items-center justify-center gap-2 shadow-sm",
                  isPublic ? "bg-amber-600 hover:bg-amber-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                {isPublic ? (
                  <><Lock className="w-4 h-4" /> Tornar Privado</>
                ) : (
                  <><Globe className="w-4 h-4" /> Tornar Público no Mundo</>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-xl z-[150] animate-in fade-in slide-in-from-top-4 pointer-events-none">
          {toastMessage}
        </div>
      )}
      {/* Top Header */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 shadow-sm shrink-0 sticky top-0 z-50 flex items-center min-h-[57px]">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button onClick={onBack} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition shrink-0" title="Voltar (sem salvar)">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <div className="inline-grid items-center min-w-0 max-w-[180px] sm:max-w-xs md:max-w-md shrink">
                {/* Hidden mirror span to accurately size the input to the exact text width */}
                <span className={`invisible col-start-1 row-start-1 font-bold text-base sm:text-lg text-slate-900 border-l-4 ${folderColor ? folderColor.replace('bg-', 'border-') : 'border-emerald-500'} pl-2.5 sm:pl-3 whitespace-pre select-none pointer-events-none truncate overflow-hidden`}>
                  {title || 'Título do Caderno'}
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className={`col-start-1 row-start-1 font-bold text-base sm:text-lg text-slate-900 bg-transparent outline-none border-l-4 ${folderColor ? folderColor.replace('bg-', 'border-') : 'border-emerald-500'} pl-2.5 sm:pl-3 w-full`}
                  placeholder="Título do Caderno"
                />
              </div>
              <div className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold shrink-0" title={`Pasta: ${note.folder}`}>
                <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span className="truncate max-w-[80px] sm:max-w-[120px] md:max-w-[180px]">{note.folder}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowPublicModal(true)}
              className={cn(
                "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition border shrink-0",
                isPublic
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900"
              )}
              title="Gerenciar visibilidade pública no Mundo"
            >
              <Globe className={cn("w-4 h-4 shrink-0", isPublic ? "text-emerald-600" : "text-slate-400")} />
              <span className="hidden sm:inline">{isPublic ? 'Público no Mundo' : 'Compartilhar'}</span>
            </button>

            <button onClick={() => handleSave()} disabled={isSaving} className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 sm:px-4 py-1.5 rounded-xl font-bold text-xs sm:text-sm hover:bg-emerald-700 transition shadow-xs disabled:opacity-70 justify-center shrink-0">
              {savedVisible ? (
                 <><Check className="w-4 h-4" /><span className="hidden md:inline">Salvo!</span></>
              ) : isSaving ? (
                 <span className="hidden md:inline">Salvando...</span>
              ) : (
                 <><Save className="w-4 h-4" /><span className="hidden md:inline">Salvar</span></>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto pt-6 pb-32 px-6">
        {tocMode && (
          <div className="max-w-4xl mx-auto bg-emerald-50 border border-emerald-200 px-6 py-3 rounded-xl text-sm text-emerald-700 font-medium flex items-center justify-between mb-4 shadow-sm transition-all">
            <span>Modo Sumário ativo: Clique num tópico no texto para adicionar/remover do sumário.</span>
            <button onClick={() => setTocMode(false)} className="font-bold underline hover:text-emerald-900 px-2 py-1 rounded hover:bg-emerald-100">Concluir</button>
          </div>
        )}

        {tocItems.length > 0 && (
          <div id="toc-main-container" className="max-w-4xl mx-auto bg-slate-50 border border-slate-200 px-6 py-5 rounded-2xl mb-6 shadow-sm">
            <h3 className="font-bold text-slate-800 uppercase tracking-widest text-sm flex items-center gap-2 mb-4">
              <ListOrdered className="w-4 h-4" /> Sumário
            </h3>
            <ul className="space-y-3">
              {tocItems.map(item => (
                <li key={item.id}>
                  <a 
                    href={`#${item.id}`} 
                    onClick={(e) => {
                      e.preventDefault();
                      document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="text-emerald-600 hover:text-emerald-800 hover:underline font-bold transition-colors text-sm"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="max-w-4xl mx-auto flex items-start gap-4 md:gap-6 relative">
          {/* Floating Vertical Toolbar */}
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-none bg-white/95 backdrop-blur-md shadow-xl border border-slate-200 p-1.5 rounded-2xl hidden sm:flex flex-col items-center gap-1 z-40 shrink-0">
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('undo'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Desfazer">
                 <Undo2 className="w-4 h-4" />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('redo'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Refazer">
                 <Redo2 className="w-4 h-4" />
              </button>

              <div className="h-px w-6 bg-slate-200 my-0.5"></div>
              
              <button onMouseDown={(e) => { e.preventDefault(); handleApplyHeading('H1'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Título Principal (~18px, Negrito)">
                 <Heading1 className="w-4 h-4" />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); handleApplyHeading('H2'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Subtítulo (~16px, Negrito)">
                 <Heading2 className="w-4 h-4" />
              </button>
              
              <div className="h-px w-6 bg-slate-200 my-0.5"></div>
              
              {/* Font Size Widget (+ on top, number in middle, - on bottom) */}
              <div className="flex flex-col items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5 select-none my-0.5">
                <button 
                  onMouseDown={(e) => { e.preventDefault(); handleStepFontSize(1); }} 
                  className="w-6 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:bg-slate-300 rounded font-bold text-xs" 
                  title="Aumentar tamanho"
                >
                  +
                </button>
                <span className="text-[11px] font-extrabold text-slate-700 px-1 py-0.5 leading-none">
                  {fontSizePx}
                </span>
                <button 
                  onMouseDown={(e) => { e.preventDefault(); handleStepFontSize(-1); }} 
                  className="w-6 h-5 flex items-center justify-center text-slate-700 hover:bg-slate-200 active:bg-slate-300 rounded font-bold text-xs" 
                  title="Diminuir tamanho"
                >
                  -
                </button>
              </div>

              <div className="h-px w-6 bg-slate-200 my-0.5"></div>

              <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Negrito">
                 <Bold className="w-4 h-4" />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Itálico">
                 <Italic className="w-4 h-4" />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Sublinhado">
                 <Underline className="w-4 h-4" />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyFull'); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Justificar">
                 <AlignJustify className="w-4 h-4" />
              </button>
              <button 
                onMouseDown={(e) => { e.preventDefault(); handleToggleBulletList(); }} 
                className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition" 
                title="Tópicos (Marcadores)"
              >
                 <List className="w-4 h-4" />
              </button>
              
              <div className="relative group">
                <button onMouseDown={(e) => { e.preventDefault(); handleHighlight(); }} className={`p-1.5 rounded-lg transition ${highlightMode ? 'bg-yellow-100 text-yellow-700 ring-2 ring-yellow-400' : 'text-slate-600 hover:bg-slate-200'}`} title="Modo Marca-texto">
                   <Highlighter className="w-4 h-4" />
                </button>
                {highlightMode && (
                   <div className="absolute left-full ml-2 top-0 bg-white shadow-xl border border-slate-200 rounded-xl p-1.5 flex flex-col gap-1.5 z-50">
                      <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#fbcfe8'); }} className={`w-5 h-5 rounded-full bg-pink-200 transition ${highlightColor === '#fbcfe8' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Rosa"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#bbf7d0'); }} className={`w-5 h-5 rounded-full bg-green-200 transition ${highlightColor === '#bbf7d0' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Verde"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#fed7aa'); }} className={`w-5 h-5 rounded-full bg-orange-200 transition ${highlightColor === '#fed7aa' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Laranja"></button>
                      <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#fef08a'); }} className={`w-5 h-5 rounded-full bg-yellow-200 transition ${highlightColor === '#fef08a' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Amarelo"></button>
                   </div>
                )}
              </div>
              
              <div className="h-px w-6 bg-slate-200 my-0.5"></div>
              
              <button onMouseDown={(e) => { e.preventDefault(); setTocMode(!tocMode); }} className={`p-1.5 rounded-lg transition ${tocMode ? 'bg-emerald-100 text-emerald-700 font-bold' : 'text-slate-600 hover:bg-slate-200'}`} title={tocMode ? "Concluir Sumário" : "Sumário"}>
                 <ListOrdered className="w-4 h-4" />
              </button>
              <button onMouseDown={(e) => { e.preventDefault(); handleClearFormat(); }} className="p-1.5 text-slate-600 hover:bg-slate-200 rounded-lg transition text-red-500 hover:text-red-600 hover:bg-red-50" title="Limpar Formatação">
                 <Eraser className="w-4 h-4" />
              </button>
          </div>

          <div className="flex-1 bg-white shadow-sm border border-slate-200 rounded-2xl flex flex-col relative w-full">
             {/* Editable Area */}
             <div 
                ref={editorRef}
                className="study-editor-content p-6 md:p-8 outline-none max-w-none text-slate-800"
                contentEditable
                onPaste={handlePaste}
                onMouseUp={handleEditorMouseUp}
                onKeyDown={handleKeyDown}
                onInput={updateToc}
                style={{ minHeight: '500px' }}
             />
          </div>
        </div>
      </div>

      {/* Floating Bottom Toolbar for Mobile */}
      <div className="fixed sm:hidden bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md shadow-2xl border border-slate-200 p-2 rounded-2xl flex flex-wrap items-center justify-center gap-1 z-30">
          <button onMouseDown={(e) => { e.preventDefault(); handleApplyHeading('H1'); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Título Principal">
             <Heading1 className="w-4 h-4" />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); handleApplyHeading('H2'); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Subtítulo">
             <Heading2 className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          
          {/* Mobile Font Size Widget */}
          <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg px-1.5 py-0.5 gap-1 select-none">
            <button onMouseDown={(e) => { e.preventDefault(); handleStepFontSize(-1); }} className="w-5 h-5 flex items-center justify-center text-slate-700 font-bold text-xs">-</button>
            <span className="text-xs font-extrabold text-slate-700">{fontSizePx}</span>
            <button onMouseDown={(e) => { e.preventDefault(); handleStepFontSize(1); }} className="w-5 h-5 flex items-center justify-center text-slate-700 font-bold text-xs">+</button>
          </div>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          <button onMouseDown={(e) => { e.preventDefault(); execCommand('bold'); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Negrito">
             <Bold className="w-4 h-4" />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('italic'); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Itálico">
             <Italic className="w-4 h-4" />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('underline'); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Sublinhado">
             <Underline className="w-4 h-4" />
          </button>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('justifyFull'); }} className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" title="Justificar">
             <AlignJustify className="w-4 h-4" />
          </button>
          <button 
            onMouseDown={(e) => { e.preventDefault(); handleToggleBulletList(); }} 
            className="p-2 text-slate-600 hover:bg-slate-200 rounded-lg transition" 
            title="Tópicos (Marcadores)"
          >
             <List className="w-4 h-4" />
          </button>

          <div className="relative">
            <button onMouseDown={(e) => { e.preventDefault(); handleHighlight(); }} className={`p-2 rounded-lg transition ${highlightMode ? 'bg-yellow-100 text-yellow-700' : 'text-slate-600 hover:bg-slate-200'}`} title="Modo Marca-texto">
               <Highlighter className="w-4 h-4" />
            </button>
            {highlightMode && (
               <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white shadow-xl border border-slate-200 rounded-xl p-2 flex gap-2 z-50">
                  <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#fbcfe8'); }} className={`w-6 h-6 rounded-full bg-pink-200 transition ${highlightColor === '#fbcfe8' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Rosa"></button>
                  <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#bbf7d0'); }} className={`w-6 h-6 rounded-full bg-green-200 transition ${highlightColor === '#bbf7d0' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Verde"></button>
                  <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#fed7aa'); }} className={`w-6 h-6 rounded-full bg-orange-200 transition ${highlightColor === '#fed7aa' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Laranja"></button>
                  <button onMouseDown={(e) => { e.preventDefault(); setHighlightColor('#fef08a'); }} className={`w-6 h-6 rounded-full bg-yellow-200 transition ${highlightColor === '#fef08a' ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-110'}`} title="Amarelo"></button>
               </div>
            )}
          </div>
          <div className="w-px h-6 bg-slate-200 mx-1"></div>
          <button onMouseDown={(e) => { e.preventDefault(); setTocMode(!tocMode); }} className={`p-2 rounded-lg transition ${tocMode ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-200'}`} title="Sumário">
             <ListOrdered className="w-4 h-4" />
          </button>
      </div>
    </div>
  );
}
