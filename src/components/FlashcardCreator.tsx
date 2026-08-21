import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Save, Undo2, Eye, EyeOff, Clipboard, AlertCircle, Sparkles, Check, Info, Layout, 
  HelpCircle, Settings, Sliders, Image as ImageIcon, Type, CornerDownLeft, Plus
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, storage } from '../lib/firebase';
import { Flashcard } from '../types';
import { AttachedImage, ImageOcclusionEditor } from './ImageOcclusionEditor';
import { v4 as uuidv4 } from 'uuid';
import { saveSingleFlashcardToSupabase } from '../lib/supabaseFlashcards';

interface FlashcardCreatorProps {
  editingCard?: Flashcard;
  onClose: () => void;
  onCardSaved: () => void;
  existingDecks: string[];
}

interface EditorState {
  front: string;
  back: string;
  explanation: string;
  deck: string;
  frontImages: AttachedImage[];
  backImages: AttachedImage[];
}

export function FlashcardCreator({ onClose, onCardSaved, existingDecks, editingCard }: FlashcardCreatorProps) {
  const [deck, setDeck] = useState(editingCard?.tag || '');
  const [subtag, setSubtag] = useState(editingCard?.subtag || '');

  const [front, setFront] = useState(editingCard?.question || '');
  const [back, setBack] = useState(editingCard?.answer || '');
  const [explanation, setExplanation] = useState(editingCard?.explanation || '');
  
  // States for Front/Back Multiple Image Attachments
  const [frontImages, setFrontImages] = useState<AttachedImage[]>([]);
  const [backImages, setBackImages] = useState<AttachedImage[]>([]);
  
  // Image Occlusion Mode
  const [isOcclusionMode, setIsOcclusionMode] = useState(false);
  
  // App-specific state
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for focusing & attachments
  const deckInputRef = useRef<HTMLInputElement>(null);
  const frontRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLTextAreaElement>(null);
  const explanationRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const frontImageInputRef = useRef<HTMLInputElement>(null);
  const backImageInputRef = useRef<HTMLInputElement>(null);

  // Undo / History Stack
  const historyRef = useRef<EditorState[]>([]);
  const historyIndexRef = useRef<number>(-1);

  // Helper to push to history
  const pushHistory = (state: Omit<EditorState, 'deck'>) => {
    const currentState: EditorState = {
      ...state,
      deck: deck
    };

    // If historyIndex is not at the end, truncate future history
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }

    // Push new state
    historyRef.current.push(currentState);
    if (historyRef.current.length > 50) {
      historyRef.current.shift();
    }
    historyIndexRef.current = historyRef.current.length - 1;
  };

  // Get current state package for passing around
  const getCurrentState = (): Omit<EditorState, 'deck'> => ({
    front,
    back,
    explanation,
    frontImages,
    backImages
  });

  // Handle manual field changes and push history
  const handleFieldChange = (field: 'front' | 'back' | 'explanation', value: string) => {
    if (field === 'front') setFront(value);
    if (field === 'back') setBack(value);
    if (field === 'explanation') setExplanation(value);

    // Push state to history with updated value
    const updatedState = {
      ...getCurrentState(),
      [field]: value
    };
    pushHistory(updatedState);
  };

  // Undo action
  const handleUndo = () => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prevState = historyRef.current[historyIndexRef.current];
      
      setFront(prevState.front);
      setBack(prevState.back);
      setExplanation(prevState.explanation);setFrontImages(prevState.frontImages || []);
      setBackImages(prevState.backImages || []);
      
      // Flash save status briefly
      triggerNotification('Desfeito!');
    } else {
      triggerNotification('Nada para desfazer');
    }
  };

  const [notification, setNotification] = useState('');
  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2500);
  };

  // Setup initial history
  useEffect(() => {
    if (historyRef.current.length === 0) {
      pushHistory({
        front: '',
        back: '',
        explanation: '',
        frontImages: [],
        backImages: []
      });
    }
    // Focus Front field on mount
    frontRef.current?.focus();
  }, []);

  // Helper to upload media using Base64 to match the question bank behavior and avoid Storage 403s
  const uploadAndGetUrl = async (file: File, subFolder: string, totalCount: number = 1): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target?.result) return reject(new Error("Falha ao ler arquivo"));
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          let MAX_SIZE = 800;
          let quality = 0.7;
          if (totalCount > 4) {
            MAX_SIZE = 400;
            quality = 0.5;
          } else if (totalCount > 2) {
            MAX_SIZE = 600;
            quality = 0.6;
          }
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round(height * (MAX_SIZE / width));
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round(width * (MAX_SIZE / height));
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target!.result as string);
          
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/webp', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error("Erro ao carregar imagem para compressão"));
        img.src = e.target.result as string;
      };
      
      reader.onerror = () => reject(reader.error || new Error("Erro ao ler arquivo de imagem"));
      reader.readAsDataURL(file);
    });
  };

  // Paste image handler inside Front and Back fields (Supports multiple pasted images!)
  const handleFieldPaste = async (e: React.ClipboardEvent, field: 'front' | 'back') => {
    const items = e.clipboardData?.items;
    if (!items || !auth.currentUser) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      setIsUploading(true);
      triggerNotification(`Carregando ${imageFiles.length} imagem(ns) da ${field === 'front' ? 'frente' : 'resposta'}...`);

      try {
        const totalCount = frontImages.length + backImages.length + imageFiles.length;
        const urls = await Promise.all(imageFiles.map(file => uploadAndGetUrl(file, 'flashcardMedia', totalCount)));
        if (field === 'front') {
          setFrontImages(prev => {
            const next = [...prev, ...urls.map(url => ({ id: uuidv4(), url, occlusions: [] }))];
            pushHistory({ ...getCurrentState(), frontImages: next });
            return next;
          });
        } else {
          setBackImages(prev => {
            const next = [...prev, ...urls.map(url => ({ id: uuidv4(), url, occlusions: [] }))];
            pushHistory({ ...getCurrentState(), backImages: next });
            return next;
          });
        }
        triggerNotification(`${urls.length} imagem(ns) adicionada(s) com sucesso!`);
      } catch (err: any) {
        console.error("Paste image upload failed:", err);
        setErrorMessage("Erro ao carregar imagem colada: " + err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Upload by manual file selector for Front and Back fields (Supports multiple selection!)
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'front' | 'back') => {
    const files = e.target.files;
    if (!files || files.length === 0 || !auth.currentUser) return;

    setIsUploading(true);
    triggerNotification(`Carregando ${files.length} imagem(ns) para a ${field === 'front' ? 'frente' : 'resposta'}...`);

    try {
      const fileArray: File[] = Array.from(files);
      const totalCount = frontImages.length + backImages.length + fileArray.length;
      const urls = await Promise.all(fileArray.map(file => uploadAndGetUrl(file, 'flashcardMedia', totalCount)));
      
      if (field === 'front') {
        setFrontImages(prev => {
          const next = [...prev, ...urls.map(url => ({ id: uuidv4(), url, occlusions: [] }))];
          pushHistory({ ...getCurrentState(), frontImages: next });
          return next;
        });
      } else {
        setBackImages(prev => {
          const next = [...prev, ...urls.map(url => ({ id: uuidv4(), url, occlusions: [] }))];
          pushHistory({ ...getCurrentState(), backImages: next });
          return next;
        });
      }
      triggerNotification(`${urls.length} imagem(ns) carregada(s) com sucesso!`);
    } catch (err: any) {
      console.error("File upload failed:", err);
      setErrorMessage("Erro ao carregar imagem: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeFrontImage = (indexToRemove: number) => {
    setFrontImages(prev => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      pushHistory({ ...getCurrentState(), frontImages: next });
      return next;
    });
  };

  const removeBackImage = (indexToRemove: number) => {
    setBackImages(prev => {
      const next = prev.filter((_, idx) => idx !== indexToRemove);
      pushHistory({ ...getCurrentState(), backImages: next });
      return next;
    });
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Save: Ctrl + S / Cmd + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // 2. Undo: Ctrl + Z / Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }

      // 3. Cloze Deletion (Oclusão de Texto): Ctrl + E
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleClozeShortcut();
      }

      // 4. Image Occlusion overlay: Ctrl + D
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        setIsOcclusionMode(prev => !prev);
        triggerNotification(isOcclusionMode ? 'Modo Oclusão desativado' : 'Modo Oclusão ativo: Arraste sobre a imagem');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [front, back, explanation, deck, frontImages, backImages, isOcclusionMode]);

  // Handle Cloze Deletion selection replacement
  const handleClozeShortcut = () => {
    const activeEl = document.activeElement;
    if (activeEl === frontRef.current || activeEl === backRef.current) {
      const textarea = activeEl as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      if (start !== end) {
        const text = textarea.value;
        const selected = text.substring(start, end);
        const replaced = `${text.substring(0, start)}{{c1::${selected}}}${text.substring(end)}`;
        
        if (activeEl === frontRef.current) {
          setFront(replaced);
          handleFieldChange('front', replaced);
        } else {
          setBack(replaced);
          handleFieldChange('back', replaced);
        }
        
        triggerNotification('Oclusão de texto criada!');
        
        // Restore cursor/focus
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start + selected.length + 8);
        }, 50);
      } else {
        triggerNotification('Selecione um texto para ocultar!');
      }
    } else {
      triggerNotification('Foque na Frente ou Verso primeiro!');
    }
  };

// Save Card to Firebase Firestore
  const handleSave = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;

    // Validate deck name requirement
    const finalDeck = deck.trim();
    if (!finalDeck) {
      const msg = 'O nome do caderno/deck é obrigatório antes de salvar os cards. Digite o nome do deck.';
      setErrorMessage(msg);
      setSaveStatus('error');
      triggerNotification('⚠️ Nome do caderno é obrigatório!');
      deckInputRef.current?.focus();
      return false;
    }

    // Prepare content (embedding image occlusion code if configured)
    let finalQuestion = front.trim();
    let finalAnswer = back.trim();

    // Auto-copy front to back if back is empty and we have a cloze deletion
    const clozeRegex = /\{\{c\d+:{1,2}(.*?)\}\}/gi;
    if (clozeRegex.test(finalQuestion) && !finalAnswer) {
      finalAnswer = finalQuestion;
    }

    // Render image function that handles occlusions
    const renderAttachedImage = (img: AttachedImage, renderOcclusions: boolean) => {
      const containerPrefix = `<div class="relative inline-block max-w-full overflow-hidden select-none border border-slate-200/50 rounded-xl bg-slate-50 p-1.5 shadow-sm my-4">`;
      const imageTag = `<img src="${img.url}" alt="Imagem" class="max-w-full h-auto rounded-lg mx-auto object-contain" />`;
      
      let overlays = '';
      if (renderOcclusions && img.occlusions.length > 0) {
        overlays = img.occlusions.map(rect => {
          const rectStyle = `position: absolute; left: ${rect.x}%; top: ${rect.y}%; width: ${rect.w}%; height: ${rect.h}%; border-radius: 6px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); background-color: #4f46e5; border: 2.5px solid #1e1b4b; opacity: 1; z-index: 20;`;
          return `<div style="${rectStyle}" class="occlusion-block"></div>`;
        }).join('');
      }
      
      const containerSuffix = `</div>`;
      return `${containerPrefix}${imageTag}${overlays}${containerSuffix}`;
    };

    if (frontImages.length > 0) {
      const imgTagsWithOcclusion = frontImages.map(img => renderAttachedImage(img, true)).join('\n');
      finalQuestion = `${finalQuestion}\n\n${imgTagsWithOcclusion}`;
      
      // If there are occlusions on front images, we need to show the CLEAN images in the answer
      const hasAnyFrontOcclusions = frontImages.some(img => img.occlusions.length > 0);
      if (hasAnyFrontOcclusions && backImages.length === 0) {
        const cleanFrontImages = frontImages.map(img => renderAttachedImage(img, false)).join('\n');
        finalAnswer = `${finalAnswer}\n\n${cleanFrontImages}`;
      }
    }

    if (backImages.length > 0) {
      const imgTagsWithOcclusion = backImages.map(img => renderAttachedImage(img, true)).join('\n');
      finalAnswer = `${finalAnswer}\n\n${imgTagsWithOcclusion}`;
    }

    if (!finalQuestion && frontImages.length === 0) {
      setErrorMessage('A Frente do card ou uma imagem é obrigatória.');
      setSaveStatus('error');
      frontRef.current?.focus();
      return false;
    }

    setSaveStatus('saving');
    try {
      const newCardId = `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const cardData: Flashcard = {
        id: newCardId,
        question: finalQuestion,
        answer: finalAnswer,
        explanation: explanation.trim(),
        tag: finalDeck,
        subtag: subtag.trim(),
        subtags: subtag.trim() ? [subtag.trim()] : [],
        nextReview: new Date().toISOString(),
        interval: 0,
        easeFactor: 2.5,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      };

      // 1. Save in Supabase
      try {
        await saveSingleFlashcardToSupabase(auth.currentUser.uid, cardData);
      } catch (sErr) {
        console.warn("Supabase save single flashcard error:", sErr);
      }

      

      setSaveStatus('success');
      triggerNotification(`Card salvo em "${finalDeck}"! Digite o próximo card.`);

      // Reset state for the next card, keeping the deck name intact!
      setFront('');
      setBack('');
      setExplanation('');
      setFrontImages([]);
      setBackImages([]);
      setErrorMessage('');

      // Re-initialize history for the fresh card
      historyRef.current = [];
      historyIndexRef.current = -1;
      pushHistory({
        front: '',
        back: '',
        explanation: '',
        frontImages: [],
        backImages: []
      });

      // Recalibrate and focus Frente input immediately
      frontRef.current?.focus();
      setSaveStatus('idle');

      onCardSaved(); // Callback to trigger lists refresh in parent
      return true;
    } catch (err: any) {
      console.error(err);
      setErrorMessage(err.message || 'Erro ao salvar no Firestore');
      setSaveStatus('error');
      return false;
    }
  };

  // Handler for Finalize Deck Button click
  const handleFinalize = async () => {
    const finalQuestion = front.trim();
    if (finalQuestion || frontImages.length > 0 || backImages.length > 0) {
      // Try to save first
      const success = await handleSave();
      if (!success) {
        // If save failed because of validation (e.g. deck name empty), abort closing so user can fix it
        return;
      }
    }
    onClose();
  };


  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 space-y-6" ref={containerRef}>
      {/* Header */}
      <header className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 animate-spin-slow" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Criador Ultra-Rápido</h1>
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Alta Produtividade & Repetição Espaçada</p>
          </div>
        </div>
        
        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all" title="Voltar / Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="flex flex-col gap-8 max-w-4xl mx-auto">
        
        {/* Left Side: Fields Form */}
        <div className="space-y-6">
          
          {/* Deck Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-indigo-500" /> Caderno / Deck <span className="text-red-500 font-bold">*</span>
              </label>
            </div>
            
            <div className="relative">
              <input
                ref={deckInputRef}
                type="text"
                placeholder="Digite o nome do caderno (Obrigatório, ex: Cardiologia)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-bold"
                value={deck}
                onChange={(e) => setDeck(e.target.value)}
                list="deck-options-list"
              />
              <datalist id="deck-options-list">
                {existingDecks.map(d => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Subtag Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-500" /> Subtag / Específica (Opcional)
              </label>
            </div>
            <input
              type="text"
              placeholder="Ex: Valvopatias, ECG, Tratamento..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium"
              value={subtag}
              onChange={(e) => setSubtag(e.target.value)}
            />
          </div>

          {/* Front field */}
          <div className="space-y-2 relative">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-indigo-500" /> Frente do Flashcard
              </label>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Ctrl + E para Cloze</span>
                <span className="text-slate-200">|</span>
                <button
                  type="button"
                  onClick={() => frontImageInputRef.current?.click()}
                  className="text-[10px] text-indigo-600 font-extrabold hover:underline uppercase tracking-wider flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> + Imagem (ou Ctrl+V)
                </button>
                <input
                  type="file"
                  multiple
                  ref={frontImageInputRef}
                  onChange={(e) => handleFileInputChange(e, 'front')}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
            <textarea
              ref={frontRef}
              rows={4}
              placeholder="Digite a pergunta. Dica: selecione uma palavra e aperte Ctrl+E para ocultá-la!"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-semibold text-sm resize-none"
              value={front}
              onPaste={(e) => handleFieldPaste(e, 'front')}
              onChange={(e) => handleFieldChange('front', e.target.value)}
            />
            {/* Front Multiple Images Grid Preview */}
            {frontImages.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {frontImages.map((img, index) => (
                  <ImageOcclusionEditor
                    key={img.id}
                    image={img}
                    isOcclusionMode={isOcclusionMode}
                    onUpdate={(updatedImage) => {
                      setFrontImages(prev => {
                        const next = [...prev];
                        next[index] = updatedImage;
                        return next;
                      });
                    }}
                    onRemove={() => removeFrontImage(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Back field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <CornerDownLeft className="w-3.5 h-3.5 text-indigo-500" /> Verso (Resposta)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-slate-200">|</span>
                <button
                  type="button"
                  onClick={() => backImageInputRef.current?.click()}
                  className="text-[10px] text-indigo-600 font-extrabold hover:underline uppercase tracking-wider flex items-center gap-1"
                >
                  <ImageIcon className="w-3.5 h-3.5" /> + Imagem (ou Ctrl+V)
                </button>
                <input
                  type="file"
                  multiple
                  ref={backImageInputRef}
                  onChange={(e) => handleFileInputChange(e, 'back')}
                  className="hidden"
                  accept="image/*"
                />
              </div>
            </div>
            <textarea
              ref={backRef}
              rows={4}
              placeholder="Digite a resposta do flashcard..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium text-sm resize-none"
              value={back}
              onPaste={(e) => handleFieldPaste(e, 'back')}
              onChange={(e) => handleFieldChange('back', e.target.value)}
            />
            {/* Back Multiple Images Grid Preview */}
            {backImages.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {backImages.map((img, index) => (
                  <ImageOcclusionEditor
                    key={img.id}
                    image={img}
                    isOcclusionMode={isOcclusionMode}
                    onUpdate={(updatedImage) => {
                      setBackImages(prev => {
                        const next = [...prev];
                        next[index] = updatedImage;
                        return next;
                      });
                    }}
                    onRemove={() => removeBackImage(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Explanation field */}
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" /> Detalhes Extras / Explicação (Opcional)
            </label>
            <textarea
              ref={explanationRef}
              rows={2}
              placeholder="Notas adicionais, regras mnemônicas ou referências do material..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium text-xs resize-none"
              value={explanation}
              onChange={(e) => handleFieldChange('explanation', e.target.value)}
            />
          </div>

          {/* Active Error Messaging */}
          {saveStatus === 'error' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-50 border border-red-200 p-3.5 rounded-xl flex items-start gap-2.5 text-red-700">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div className="text-xs font-bold leading-relaxed">{errorMessage}</div>
            </motion.div>
          )}

          {/* Action Buttons Panel */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving' || isUploading}
              className="flex-[2] bg-indigo-600 text-white font-extrabold py-3.5 px-6 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2.5 text-sm"
            >
              {saveStatus === 'saving' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <CornerDownLeft className="w-4 h-4" />
                  Próximo <kbd className="hidden sm:inline bg-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Ctrl + S</kbd>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleFinalize}
              disabled={saveStatus === 'saving' || isUploading}
              className="flex-1 bg-green-500 text-white font-extrabold py-3.5 px-6 rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-500/15 flex items-center justify-center gap-2 text-sm"
            >
              <Check className="w-4 h-4" />
              Salvar Deck
            </button>

            <button
              onClick={handleUndo}
              type="button"
              className="p-3.5 border border-slate-200 hover:bg-slate-50 text-slate-500 hover:text-slate-800 rounded-xl transition"
              title="Desfazer última edição"
            >
              <Undo2 className="w-5 h-5" />
            </button>
          </div>

          {/* Productivity shortcut cheatsheet */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2 text-[11px] font-medium text-slate-500 shadow-inner mt-6">
            <h4 className="font-extrabold uppercase tracking-widest text-slate-400 text-[9px] flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-500" /> Atalhos de Teclado (Ultra Produtividade)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mt-1">
              <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                <span>Salvar & Limpar</span>
                <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-600 border border-slate-200">Ctrl+S</kbd>
              </div>
              <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                <span>Desfazer</span>
                <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-600 border border-slate-200">Ctrl+Z</kbd>
              </div>
              <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                <span>Ocultar Texto (Cloze)</span>
                <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-600 border border-slate-200">Ctrl+E</kbd>
              </div>
              <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-slate-100 shadow-sm">
                <span>Ativar Oclusão</span>
                <kbd className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-600 border border-slate-200">Ctrl+A</kbd>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Persistent floating dynamic notification banner */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.9 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white font-bold py-2.5 px-5 rounded-full shadow-2xl z-50 text-xs flex items-center gap-2 border border-slate-800"
          >
            <Sparkles className="w-4 h-4 text-indigo-400 animate-spin-slow" />
            <span>{notification}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
