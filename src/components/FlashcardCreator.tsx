import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Save, Undo2, Eye, EyeOff, Clipboard, AlertCircle, Sparkles, Check, Info, Layout, 
  HelpCircle, Settings, Sliders, Image, Type, CornerDownLeft
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore';
import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { Flashcard } from '../types';

interface FlashcardCreatorProps {
  onClose: () => void;
  onCardSaved: () => void;
  existingDecks: string[];
}

interface EditorState {
  front: string;
  back: string;
  explanation: string;
  deck: string;
  occlusionImageUrl: string;
  occlusionRect: { x: number; y: number; w: number; h: number } | null;
  isDrawingOcclusion: boolean;
  frontImage: string;
  backImage: string;
}

export function FlashcardCreator({ onClose, onCardSaved, existingDecks }: FlashcardCreatorProps) {
  const [deck, setDeck] = useState('');

  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [explanation, setExplanation] = useState('');
  
  // New States for Front/Back Image Attachments
  const [frontImage, setFrontImage] = useState('');
  const [backImage, setBackImage] = useState('');
  
  // Image Occlusion states
  const [occlusionImageUrl, setOcclusionImageUrl] = useState('');
  const [occlusionRect, setOcclusionRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDrawingOcclusion, setIsDrawingOcclusion] = useState(false);
  
  // App-specific state
  const [isUploading, setIsUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs for focusing & attachments
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
    occlusionImageUrl,
    occlusionRect,
    isDrawingOcclusion,
    frontImage,
    backImage
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
      setExplanation(prevState.explanation);
      setOcclusionImageUrl(prevState.occlusionImageUrl);
      setOcclusionRect(prevState.occlusionRect);
      setIsDrawingOcclusion(prevState.isDrawingOcclusion);
      setFrontImage(prevState.frontImage || '');
      setBackImage(prevState.backImage || '');
      
      // Flash save status briefly
      triggerNotification('Desfeito!');
    } else {
      triggerNotification('Nada para desfazer');
    }
  };

  const [notification, setNotification] = useState('');
  const triggerNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 2000);
  };

  // Setup initial history
  useEffect(() => {
    if (historyRef.current.length === 0) {
      pushHistory({
        front: '',
        back: '',
        explanation: '',
        occlusionImageUrl: '',
        occlusionRect: null,
        isDrawingOcclusion: false,
        frontImage: '',
        backImage: ''
      });
    }
    // Focus Front field on mount
    frontRef.current?.focus();
  }, []);

  // Helper to upload media using Base64 to match the question bank behavior and avoid Storage 403s
  const uploadAndGetUrl = async (file: File, subFolder: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error("Falha ao converter arquivo de imagem para Base64"));
        }
      };
      reader.onerror = () => reject(reader.error || new Error("Erro ao ler arquivo de imagem"));
      reader.readAsDataURL(file);
    });
  };

  // Paste image handler inside Front and Back fields
  const handleFieldPaste = async (e: React.ClipboardEvent, field: 'front' | 'back') => {
    const items = e.clipboardData?.items;
    if (!items || !auth.currentUser) return;

    let imageFile: File | null = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault();
      setIsUploading(true);
      triggerNotification(`Fazendo upload da imagem da ${field === 'front' ? 'frente' : 'resposta'}...`);

      try {
        const url = await uploadAndGetUrl(imageFile, 'flashcardMedia');
        if (field === 'front') {
          setFrontImage(url);
        } else {
          setBackImage(url);
        }
        
        const nextState = {
          ...getCurrentState(),
          [field === 'front' ? 'frontImage' : 'backImage']: url
        };
        pushHistory(nextState);
        triggerNotification('Imagem colada com sucesso!');
      } catch (err: any) {
        console.error("Paste image upload failed:", err);
        setErrorMessage("Erro ao carregar imagem colada: " + err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Upload by manual file selector for Front and Back fields
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>, field: 'front' | 'back') => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    setIsUploading(true);
    triggerNotification(`Carregando imagem do arquivo para a ${field === 'front' ? 'frente' : 'resposta'}...`);

    try {
      const url = await uploadAndGetUrl(file, 'flashcardMedia');
      if (field === 'front') {
        setFrontImage(url);
      } else {
        setBackImage(url);
      }
      
      const nextState = {
        ...getCurrentState(),
        [field === 'front' ? 'frontImage' : 'backImage']: url
      };
      pushHistory(nextState);
      triggerNotification('Imagem carregada com sucesso!');
    } catch (err: any) {
      console.error("File upload failed:", err);
      setErrorMessage("Erro ao carregar imagem: " + err.message);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Save: Ctrl + S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      
      // 2. Undo: Ctrl + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }

      // 3. Cloze Deletion (Oclusão de Texto): Ctrl + E
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        handleClozeShortcut();
      }

      // 4. Image Occlusion overlay: Ctrl + A
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (occlusionImageUrl) {
          setIsDrawingOcclusion(prev => {
            const next = !prev;
            if (next && !occlusionRect) {
              setOcclusionRect({ x: 25, y: 25, w: 50, h: 50 });
            }
            pushHistory({
              ...getCurrentState(),
              isDrawingOcclusion: next,
              occlusionRect: next && !occlusionRect ? { x: 25, y: 25, w: 50, h: 50 } : occlusionRect
            });
            return next;
          });
        } else {
          triggerNotification('Cole uma imagem primeiro!');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [front, back, explanation, deck, occlusionImageUrl, occlusionRect, isDrawingOcclusion, frontImage, backImage]);

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

  // Upload Paste Listener (Clipboard Image Paste - fallback/occlusion-specific)
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const activeEl = document.activeElement;
    if (activeEl === frontRef.current || activeEl === backRef.current) {
      return;
    }

    const items = e.clipboardData?.items;
    if (!items || !auth.currentUser) return;

    let imageFile: File | null = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageFile = items[i].getAsFile();
        break;
      }
    }

    if (imageFile) {
      e.preventDefault(); 
      setIsUploading(true);
      triggerNotification('Fazendo upload da captura de tela...');

      try {
        const url = await uploadAndGetUrl(imageFile, 'flashcardMedia');

        setOcclusionImageUrl(url);
        // Default occlusion box in the middle
        const defaultRect = { x: 30, y: 30, w: 40, h: 40 };
        setOcclusionRect(defaultRect);
        setIsDrawingOcclusion(true);

        const nextState = {
          ...getCurrentState(),
          occlusionImageUrl: url,
          occlusionRect: defaultRect,
          isDrawingOcclusion: true
        };
        pushHistory(nextState);

        triggerNotification('Captura de tela colada! Modo oclusão ativo.');
      } catch (err: any) {
        console.error("Paste upload failed:", err);
        setErrorMessage("Erro ao salvar printscreen: " + err.message);
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Save Card to Firebase Firestore
  const handleSave = async (): Promise<boolean> => {
    if (!auth.currentUser) return false;

    const finalDeck = deck.trim();
    if (!finalDeck) {
      setErrorMessage('O nome do caderno não pode estar vazio. Por favor, digite o nome do deck antes de prosseguir.');
      setSaveStatus('error');
      // Raise alert for user visibility
      alert('O nome do caderno não pode estar vazio. Por favor, digite o nome do deck antes de prosseguir.');
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

    // Append standard front image if uploaded/pasted
    if (frontImage) {
      finalQuestion = `${finalQuestion}\n\n<img src="${frontImage}" alt="Imagem Frente" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100" />`;
    }

    // Append standard back image if uploaded/pasted
    if (backImage) {
      finalAnswer = `${finalAnswer}\n\n<img src="${backImage}" alt="Imagem Verso" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100" />`;
    }

    if (occlusionImageUrl && occlusionRect) {
      // Embed visual occlusion rectangle code directly inside Frente and Verso HTML
      const rectStyle = `position: absolute; left: ${occlusionRect.x}%; top: ${occlusionRect.y}%; width: ${occlusionRect.w}%; height: ${occlusionRect.h}%; border-radius: 4px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: all 0.2s ease-in-out;`;
      
      const frontOverlay = `<div style="${rectStyle} background: #4f46e5; border: 2.5px solid #312e81;" class="occlusion-block animate-pulse"></div>`;

      const containerPrefix = `<div class="relative inline-block max-w-full overflow-hidden select-none border border-slate-200/50 rounded-xl bg-slate-50 p-1.5 shadow-sm mt-4">`;
      const imageTag = `<img src="${occlusionImageUrl}" alt="Imagem Oclusiva" class="max-w-full h-auto rounded-lg mx-auto" />`;
      const containerSuffix = `</div>`;

      // Prepend to Frente and Verso
      finalQuestion = `${finalQuestion}\n\n${containerPrefix}${imageTag}${frontOverlay}${containerSuffix}`;
      finalAnswer = `${finalAnswer}\n\n${containerPrefix}${imageTag}${containerSuffix}`;
    }

    if (!finalQuestion && !occlusionImageUrl) {
      setErrorMessage('A Frente do card ou uma Imagem de Oclusão é obrigatória.');
      setSaveStatus('error');
      return false;
    }

    setSaveStatus('saving');
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'flashcards'), {
        question: finalQuestion,
        answer: finalAnswer,
        explanation: explanation.trim(),
        tag: finalDeck,
        nextReview: new Date().toISOString(),
        interval: 0,
        easeFactor: 2.5,
        userId: auth.currentUser.uid,
        createdAt: new Date().toISOString()
      });

      setSaveStatus('success');
      triggerNotification('Flashcard salvo com sucesso!');

      // Reset state for next card, keeping the deck selection!
      setFront('');
      setBack('');
      setExplanation('');
      setOcclusionImageUrl('');
      setOcclusionRect(null);
      setIsDrawingOcclusion(false);
      setFrontImage('');
      setBackImage('');

      // Re-initialize history for the fresh card
      historyRef.current = [];
      historyIndexRef.current = -1;
      pushHistory({
        front: '',
        back: '',
        explanation: '',
        occlusionImageUrl: '',
        occlusionRect: null,
        isDrawingOcclusion: false,
        frontImage: '',
        backImage: ''
      });

      // Recalibrate and focus Frente input
      frontRef.current?.focus();
      setTimeout(() => {
        setSaveStatus('idle');
      }, 800);

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
    if (finalQuestion || occlusionImageUrl || frontImage || backImage) {
      // Try to save first
      const success = await handleSave();
      if (!success) {
        // If save failed because of validation (e.g. deck name empty), abort closing so user can fix it
        return;
      }
    }
    onClose();
  };

  // Adjust Occlusion Rectangle bounds securely
  const updateOcclusionBound = (prop: 'x' | 'y' | 'w' | 'h', val: number) => {
    if (!occlusionRect) return;
    const nextRect = { ...occlusionRect, [prop]: val };
    
    // Constraints validation
    if (prop === 'x') nextRect.x = Math.max(0, Math.min(100 - occlusionRect.w, val));
    if (prop === 'y') nextRect.y = Math.max(0, Math.min(100 - occlusionRect.h, val));
    if (prop === 'w') nextRect.w = Math.max(5, Math.min(100 - occlusionRect.x, val));
    if (prop === 'h') nextRect.h = Math.max(5, Math.min(100 - occlusionRect.y, val));

    setOcclusionRect(nextRect);
    pushHistory({
      ...getCurrentState(),
      occlusionRect: nextRect
    });
  };

  // Mouse drag handles inside container
  const occlusionContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number, y: number, rectX: number, rectY: number }>({ x: 0, y: 0, rectX: 0, rectY: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!occlusionRect || !occlusionContainerRef.current) return;
    
    const container = occlusionContainerRef.current.getBoundingClientRect();
    const clickX = ((e.clientX - container.left) / container.width) * 100;
    const clickY = ((e.clientY - container.top) / container.height) * 100;

    // Check if clicked inside the rectangle
    if (
      clickX >= occlusionRect.x && 
      clickX <= occlusionRect.x + occlusionRect.w &&
      clickY >= occlusionRect.y && 
      clickY <= occlusionRect.y + occlusionRect.h
    ) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        rectX: occlusionRect.x,
        rectY: occlusionRect.y
      };
      e.preventDefault();
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !occlusionRect || !occlusionContainerRef.current) return;

    const container = occlusionContainerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - dragStartRef.current.x) / container.width) * 100;
    const deltaY = ((e.clientY - dragStartRef.current.y) / container.height) * 100;

    let newX = Math.max(0, Math.min(100 - occlusionRect.w, dragStartRef.current.rectX + deltaX));
    let newY = Math.max(0, Math.min(100 - occlusionRect.h, dragStartRef.current.rectY + deltaY));

    setOcclusionRect({
      ...occlusionRect,
      x: Math.round(newX),
      y: Math.round(newY)
    });
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      pushHistory(getCurrentState());
    }
  };

  return (
    <div onPaste={handlePaste} className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden p-6 md:p-8 space-y-6" ref={containerRef}>
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
          <button 
            type="button"
            onClick={handleFinalize}
            className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-black uppercase tracking-wider rounded-xl transition"
          >
            Finalizar Deck
          </button>
          <button onClick={onClose} className="p-2 hover:bg-slate-50 text-slate-400 hover:text-slate-600 rounded-xl transition-all" title="Voltar / Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Fields Form */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Deck Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Layout className="w-3.5 h-3.5 text-indigo-500" /> Caderno / Deck
              </label>
            </div>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Selecione ou digite um novo caderno"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-700 font-bold"
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
                  <Image className="w-3.5 h-3.5" /> + Imagem (ou Ctrl+V)
                </button>
                <input
                  type="file"
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
            {/* Front Image Preview */}
            {frontImage && (
              <div className="relative inline-block mt-2 group border border-slate-100 rounded-xl p-1 bg-white shadow-sm">
                <img src={frontImage} alt="Frente Preview" className="max-h-24 rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setFrontImage('');
                    pushHistory({ ...getCurrentState(), frontImage: '' });
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow transition"
                  title="Remover Imagem"
                >
                  <X className="w-3 h-3" />
                </button>
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
                {occlusionImageUrl && (
                  <span className="text-[10px] text-emerald-600 font-extrabold uppercase tracking-wider flex items-center gap-1">
                    <Check className="w-3 h-3" /> Oclusão Ativa
                  </span>
                )}
                <span className="text-slate-200">|</span>
                <button
                  type="button"
                  onClick={() => backImageInputRef.current?.click()}
                  className="text-[10px] text-indigo-600 font-extrabold hover:underline uppercase tracking-wider flex items-center gap-1"
                >
                  <Image className="w-3.5 h-3.5" /> + Imagem (ou Ctrl+V)
                </button>
                <input
                  type="file"
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
              placeholder={occlusionImageUrl ? "Opcional: Detalhes adicionais da resposta sobre a imagem..." : "Digite a resposta do flashcard..."}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/20 text-slate-800 font-medium text-sm resize-none"
              value={back}
              onPaste={(e) => handleFieldPaste(e, 'back')}
              onChange={(e) => handleFieldChange('back', e.target.value)}
            />
            {/* Back Image Preview */}
            {backImage && (
              <div className="relative inline-block mt-2 group border border-slate-100 rounded-xl p-1 bg-white shadow-sm">
                <img src={backImage} alt="Verso Preview" className="max-h-24 rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={() => {
                    setBackImage('');
                    pushHistory({ ...getCurrentState(), backImage: '' });
                  }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center text-[10px] font-black shadow transition"
                  title="Remover Imagem"
                >
                  <X className="w-3 h-3" />
                </button>
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

          {/* Save & Reset Panel */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saveStatus === 'saving' || isUploading}
              className="flex-1 bg-indigo-600 text-white font-extrabold py-3.5 px-6 rounded-xl hover:bg-indigo-700 transition shadow-lg shadow-indigo-600/15 flex items-center justify-center gap-2.5 text-sm"
            >
              {saveStatus === 'saving' ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Salvar Flashcard <kbd className="hidden sm:inline bg-indigo-700 px-1.5 py-0.5 rounded text-[10px] font-bold">Ctrl + S</kbd>
                </>
              )}
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

        </div>

        {/* Right Side: Media Occlusion Workspace */}
        <div className="lg:col-span-5 space-y-6 border-l border-slate-100 lg:pl-8 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-indigo-500" /> Área de Oclusão Visual
              </label>
              {occlusionImageUrl && (
                <button 
                  onClick={() => {
                    setOcclusionImageUrl('');
                    setOcclusionRect(null);
                    setIsDrawingOcclusion(false);
                    pushHistory({
                      ...getCurrentState(),
                      occlusionImageUrl: '',
                      occlusionRect: null,
                      isDrawingOcclusion: false
                    });
                  }}
                  className="text-[10px] text-red-500 font-extrabold hover:underline uppercase tracking-wider"
                >
                  Excluir Imagem
                </button>
              )}
            </div>

            {/* Paste Canvas Frame */}
            {!occlusionImageUrl ? (
              <div 
                className="border-2 border-dashed border-slate-200 hover:border-indigo-400 bg-slate-50/50 rounded-2xl p-8 flex flex-col items-center justify-center text-center transition min-h-[250px] cursor-pointer"
                onClick={() => triggerNotification('Dê Ctrl+V com uma imagem copiada para fazer upload rápido!')}
              >
                <div className="w-14 h-14 bg-white shadow-sm border border-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-4">
                  <Clipboard className="w-6 h-6 animate-pulse" />
                </div>
                <h3 className="text-sm font-bold text-slate-800">Cole uma captura de tela</h3>
                <p className="text-xs text-slate-400 max-w-[200px] mt-1 leading-normal">
                  Aperte <kbd className="bg-slate-200 text-slate-700 px-1 rounded text-[10px] font-bold">Ctrl+V</kbd> com seu printscreen copiado para carregar direto para a oclusão.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Visual Canvas Display */}
                <div className="relative inline-block overflow-hidden rounded-xl border border-slate-200 bg-slate-100 max-w-full select-none">
                  {/* Container with relative sizing */}
                  <div 
                    ref={occlusionContainerRef}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    className="relative inline-block max-w-full"
                  >
                    <img 
                      src={occlusionImageUrl} 
                      alt="Pasted Workspace" 
                      className="max-w-full h-auto rounded-lg"
                      draggable={false}
                    />

                    {/* Mask Rectangle */}
                    {isDrawingOcclusion && occlusionRect && (
                      <div
                        onMouseDown={handleMouseDown}
                        style={{
                          position: 'absolute',
                          left: `${occlusionRect.x}%`,
                          top: `${occlusionRect.y}%`,
                          width: `${occlusionRect.w}%`,
                          height: `${occlusionRect.h}%`,
                          cursor: isDragging ? 'grabbing' : 'grab'
                        }}
                        className="bg-indigo-600/85 border-2 border-indigo-900 shadow-xl rounded flex items-center justify-center relative select-none animate-pulse"
                      >
                        <span className="text-[10px] text-white font-black uppercase tracking-widest bg-indigo-950/60 px-1.5 py-0.5 rounded">TAMPADO</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bounds Sliders Controls */}
                {isDrawingOcclusion && occlusionRect && (
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-4 shadow-inner">
                    <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Sliders className="w-3 h-3 text-indigo-500" /> Regulador da Tarja
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-xs font-bold text-slate-600">
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Posição X (%)</span>
                          <span className="font-mono text-indigo-600">{occlusionRect.x}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="95" 
                          value={occlusionRect.x} 
                          onChange={(e) => updateOcclusionBound('x', parseInt(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Posição Y (%)</span>
                          <span className="font-mono text-indigo-600">{occlusionRect.y}%</span>
                        </div>
                        <input 
                          type="range" min="0" max="95" 
                          value={occlusionRect.y} 
                          onChange={(e) => updateOcclusionBound('y', parseInt(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Largura (%)</span>
                          <span className="font-mono text-indigo-600">{occlusionRect.w}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" 
                          value={occlusionRect.w} 
                          onChange={(e) => updateOcclusionBound('w', parseInt(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Altura (%)</span>
                          <span className="font-mono text-indigo-600">{occlusionRect.h}%</span>
                        </div>
                        <input 
                          type="range" min="5" max="100" 
                          value={occlusionRect.h} 
                          onChange={(e) => updateOcclusionBound('h', parseInt(e.target.value))}
                          className="w-full accent-indigo-600"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Productivity shortcut cheatsheet */}
          <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4 space-y-2 text-[11px] font-medium text-slate-500 shadow-inner mt-6">
            <h4 className="font-extrabold uppercase tracking-widest text-slate-400 text-[9px] flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-indigo-500" /> Atalhos de Teclado (Ultra Produtividade)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
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
