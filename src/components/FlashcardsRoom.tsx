import { apiFetch, parseJsonResponse } from "../lib/firebase";
import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { collection, query, where, getDocs, updateDoc, doc, increment, getDoc, setDoc, addDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Flashcard } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Brain, Trophy, Check, X, ShieldAlert, Book, Tag as TagIcon, Play, Upload, Edit3, Trash2, Plus } from 'lucide-react';
import { cn } from '../lib/utils';
import { FlashcardCreator } from './FlashcardCreator';

// Cache for loaded media files to avoid duplicate Firestore queries
const mediaCache: Record<string, string> = {};

interface FlashcardHtmlProps {
  html: string;
  isAnswer?: boolean;
}

function FlashcardHtml({ html, isAnswer }: FlashcardHtmlProps) {
  const [processedHtml, setProcessedHtml] = useState(html);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    const loadImages = async () => {
      // Process Cloze deletion first!
      let currentHtml = html;
      if (isAnswer) {
        currentHtml = currentHtml.replace(/\{\{c\d+:{1,2}(.*?)\}\}/gi, '<span class="bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded shadow-sm inline-block">$1</span>');
      } else {
        currentHtml = currentHtml.replace(/\{\{c\d+:{1,2}(.*?)\}\}/gi, '<span class="bg-indigo-600 text-white font-mono font-bold px-3 py-0.5 rounded shadow-sm tracking-wider select-none inline-block animate-pulse">[...]</span>');
      }

      if (!auth.currentUser) {
        setProcessedHtml(currentHtml);
        setLoading(false);
        return;
      }

      setLoading(true);
      
      const imgTagRegex = /(<img[^>]+src=\s*(?:(["'])([^"']+)\2|([^\s>]+))[^>]*>)/gi;
      const matches: { fullTag: string; src: string }[] = [];
      let match;
      
      imgTagRegex.lastIndex = 0;
      while ((match = imgTagRegex.exec(currentHtml)) !== null) {
        const fullTag = match[1];
        const src = match[3] || match[4];
        if (src && !src.startsWith('data:') && !src.startsWith('http')) {
          matches.push({ fullTag, src });
        }
      }

      if (matches.length === 0) {
        setProcessedHtml(currentHtml);
        setLoading(false);
        return;
      }

      for (const m of matches) {
        const filename = m.src.split('/').pop() || m.src;
        const skeleton = `
          <div class="w-full max-w-sm h-32 rounded-xl bg-slate-100/50 dark:bg-slate-800/30 animate-pulse flex flex-col items-center justify-center text-xs text-slate-400 dark:text-slate-500 mx-auto my-4 border border-slate-200/50 dark:border-slate-700/30 gap-2">
            <svg class="animate-spin h-4 w-4 text-slate-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Carregando imagem "${filename}"...
          </div>
        `;
        currentHtml = currentHtml.replace(m.fullTag, skeleton);
      }
      
      if (isMounted) {
        setProcessedHtml(currentHtml);
      }

      let finalHtml = html;
      if (isAnswer) {
        finalHtml = finalHtml.replace(/\{\{c\d+::(.*?)\}\}/gi, '<span class="bg-indigo-100 dark:bg-indigo-950 border border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-300 font-extrabold px-2 py-0.5 rounded shadow-sm inline-block">$1</span>');
      } else {
        finalHtml = finalHtml.replace(/\{\{c\d+::(.*?)\}\}/gi, '<span class="bg-indigo-600 text-white font-mono font-bold px-3 py-0.5 rounded shadow-sm tracking-wider select-none inline-block animate-pulse">[...]</span>');
      }
      
      try {
        for (const m of matches) {
          const { fullTag, src } = m;
          let decodedSrc = src;
          try { decodedSrc = decodeURIComponent(src); } catch (e) {}
          
          const lowerSrc = decodedSrc.toLowerCase();
          const sanitizedId = lowerSrc.replace(/[^a-z0-9_.-]/g, '_');
          
          let replacement = '';
          
          if (mediaCache[sanitizedId]) {
            replacement = `<img src="${mediaCache[sanitizedId]}" alt="${decodedSrc}" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100 dark:border-slate-800" />`;
          } else {
            try {
              const docRef = doc(db, 'users', auth.currentUser.uid, 'ankiMedia', sanitizedId);
              const docSnap = await getDoc(docRef);
              
              if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.url) {
                  mediaCache[sanitizedId] = data.url;
                  replacement = `<img src="${data.url}" alt="${decodedSrc}" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100 dark:border-slate-800" />`;
                } else if (data && data.data) {
                  const dataUrl = `data:${data.mime || 'image/png'};base64,${data.data}`;
                  mediaCache[sanitizedId] = dataUrl;
                  replacement = `<img src="${dataUrl}" alt="${decodedSrc}" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100 dark:border-slate-800" />`;
                } else {
                  replacement = `
                    <div class="my-4 p-4 rounded-xl border border-dashed border-red-300 bg-red-50/80 text-red-700 flex flex-col items-center gap-2 text-center max-w-md mx-auto shadow-sm">
                      <div class="flex items-center gap-1.5 font-semibold text-sm">
                        <span class="text-base">⚠️</span> Registro de mídia corrompido
                      </div>
                      <div class="text-[10px] text-red-500 font-mono break-all px-2">
                        ID: "${sanitizedId}"
                      </div>
                    </div>
                  `;
                }
              } else {
                const unsanitizedId = decodedSrc.replace(/[^a-zA-Z0-9_.-]/g, '_');
                let unsanitizedSnap = null;
                if (unsanitizedId !== sanitizedId) {
                  const unsanitizedRef = doc(db, 'users', auth.currentUser.uid, 'ankiMedia', unsanitizedId);
                  unsanitizedSnap = await getDoc(unsanitizedRef);
                }
                
                if (unsanitizedSnap && unsanitizedSnap.exists()) {
                  const data = unsanitizedSnap.data();
                  if (data && data.url) {
                    mediaCache[sanitizedId] = data.url;
                    replacement = `<img src="${data.url}" alt="${decodedSrc}" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100 dark:border-slate-800" />`;
                  } else if (data && data.data) {
                    const dataUrl = `data:${data.mime || 'image/png'};base64,${data.data}`;
                    mediaCache[sanitizedId] = dataUrl;
                    replacement = `<img src="${dataUrl}" alt="${decodedSrc}" class="max-w-full h-auto rounded-xl mx-auto my-4 shadow-md border border-slate-100 dark:border-slate-800" />`;
                  }
                } else {
                  replacement = `
                    <div class="my-4 p-4 rounded-xl border border-dashed border-red-200 bg-red-50/60 dark:bg-red-950/20 text-red-700 dark:text-red-400 flex flex-col items-center gap-2 text-center max-w-md mx-auto shadow-sm">
                      <div class="flex items-center gap-1.5 font-semibold text-sm">
                        <span class="text-base">⚠️</span> Imagem não encontrada
                      </div>
                      <div class="text-[11px] font-mono break-all bg-red-100/50 dark:bg-red-900/30 px-2 py-1 rounded">
                        "${decodedSrc}"
                      </div>
                    </div>
                  `;
                }
              }
            } catch (err: any) {
              replacement = `
                <div class="my-4 p-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/80 text-amber-700 flex flex-col items-center gap-2 text-center max-w-md mx-auto shadow-sm">
                  <div class="flex items-center gap-1.5 font-semibold text-sm">
                    <span class="text-base">⚠️</span> Erro ao carregar do Firestore
                  </div>
                  <div class="text-[10px] text-amber-600 font-mono break-all">
                    ${err.message || err}
                  </div>
                </div>
              `;
            }
          }
          
          finalHtml = finalHtml.replace(fullTag, replacement);
        }
        
        if (isMounted) {
          // Remove any flickering animation classes and ensure solid occlusion
          const sanitizedHtml = finalHtml
            .replaceAll('animate-pulse', '')
            .replaceAll('background: #4f46e5;', 'background-color: #4f46e5; opacity: 1;')
            .replaceAll('background:#4f46e5;', 'background-color: #4f46e5; opacity: 1;');
          setProcessedHtml(sanitizedHtml);
        }
      } catch (err) {
        console.error("General error in loadImages:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadImages();

    return () => {
      isMounted = false;
    };
  }, [html, isAnswer]);

  return <div dangerouslySetInnerHTML={{ __html: processedHtml }} />;
}



export function FlashcardsRoom() {
  const [allCards, setAllCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [showTudoEmDia, setShowTudoEmDia] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [finished, setFinished] = useState(false);
  const [gradeFeedback, setGradeFeedback] = useState<'again' | 'hard' | 'good' | 'easy' | null>(null);

  const [openedDecks, setOpenedDecks] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('deck_opened_timestamps');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [deckEditModal, setDeckEditModal] = useState<{
    isOpen: boolean;
    oldTag: string;
    newTag: string;
    subtags: string;
  }>({ isOpen: false, oldTag: '', newTag: '', subtags: '' });

  const [cardEditModal, setCardEditModal] = useState<{
    isOpen: boolean;
    card: Flashcard | null;
    question: string;
    answer: string;
    explanation: string;
    tag: string;
    subtag: string;
  }>({ isOpen: false, card: null, question: '', answer: '', explanation: '', tag: '', subtag: '' });

  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    type: 'import' | 'edit' | 'delete' | 'delete-card' | 'message';
    title: string;
    message?: string;
    inputValue?: string;
    tag?: string;
    file?: File;
  }>({ isOpen: false, type: 'message', title: '' });

  useEffect(() => {
    fetchCards();
  }, []);

  const fetchCards = async (background = false) => {
    if (!auth.currentUser) return;
    
    if (!background) {
      setLoading(true);
      setSelectedTag(null);
      setCurrentIndex(0);
      setIsFlipped(false);
      setFinished(false);
    }
    
    try {
      const q = query(
        collection(db, 'users', auth.currentUser.uid, 'flashcards')
      );
      
      const snapshot = await getDocs(q);
      const fetchedCards = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as Flashcard));
      fetchedCards.sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
      
      setAllCards(fetchedCards);
      
      const dueCount = fetchedCards.filter(c => new Date(c.nextReview).getTime() <= Date.now()).length;
      if (dueCount === 0 && fetchedCards.length > 0) {
        setShowTudoEmDia(true);
      } else {
        setShowTudoEmDia(false);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'flashcards');
    } finally {
      if (!background) setLoading(false);
    }
  };

  const handleGrade = async (grade: 'again' | 'hard' | 'good' | 'easy') => {
    if (gradeFeedback !== null) return;

    const card = currentCards[currentIndex];
    if (!auth.currentUser || !card.id) return;

    // Trigger feedback state
    setGradeFeedback(grade);

    // Trigger confetti if good or easy
    if (grade === 'good' || grade === 'easy') {
      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      } catch (err) {
        console.error("Confetti error", err);
      }
    }

    let newInterval = card.interval === 0 ? 1 : card.interval;
    let newEase = card.easeFactor;

    switch (grade) {
      case 'again':
        newInterval = 0;
        newEase = Math.max(1.3, newEase - 0.2);
        break;
      case 'hard':
        newInterval = Math.max(1, Math.floor(newInterval * 1.2));
        newEase = Math.max(1.3, newEase - 0.15);
        break;
      case 'good':
        newInterval = Math.max(1, Math.floor(newInterval * newEase));
        break;
      case 'easy':
        newInterval = Math.max(1, Math.floor(newInterval * newEase * 1.3));
        newEase = Math.min(3.0, newEase + 0.15);
        break;
    }

    const nextReviewDate = new Date();
    nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

    // Smooth UI feedback transition (~450ms) - balanced between instant and slow
    setTimeout(() => {
      setGradeFeedback(null);
      if (currentIndex < currentCards.length - 1) {
        setCurrentIndex(v => v + 1);
        setIsFlipped(false);
      } else {
        setFinished(true);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    }, 450);

    // Save progress asynchronously in background
    const uid = auth.currentUser.uid;
    const cardId = card.id;

    updateDoc(doc(db, 'users', uid, 'flashcards', cardId), {
      interval: newInterval,
      easeFactor: newEase,
      nextReview: nextReviewDate.toISOString()
    }).catch(error => {
      console.error("Error updating flashcard:", error);
    });

    const statsRef = doc(db, 'users', uid, 'stats', 'main');
    getDoc(statsRef).then(docSnap => {
      if (docSnap.exists()) {
        updateDoc(statsRef, { flashcardsReviewed: increment(1) });
      } else {
        setDoc(statsRef, {
          questionsAnswered: 0,
          questionsCorrect: 0,
          flashcardsReviewed: 1
        });
      }
    }).catch(err => {
      console.error("Error updating stats", err);
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;

    const defaultName = file.name.replace('.apkg', '').replace('.colpkg', '');
    setModalState({
      isOpen: true,
      type: 'import',
      title: 'Nomear Deck Importado',
      message: 'Como você deseja nomear este deck importado?',
      inputValue: defaultName,
      file: file
    });
  };

  const processImport = async (deckName: string, file: File) => {
    setModalState({ ...modalState, isOpen: false });
    const finalDeckName = deckName.trim() || 'Importado: Anki';

    setIsImporting(true);
    const formData = new FormData();
    formData.append('ankiFile', file);

    try {
      const res = await apiFetch('/api/import-anki', { 
        method: 'POST', 
        body: formData 
      });
      const data = await parseJsonResponse(res);
      
      const cardsToImport = data.flashcards || [];
      if (cardsToImport.length === 0) {
        setModalState({
          isOpen: true,
          type: 'message',
          title: 'Importação falhou',
          message: 'Nenhum flashcard encontrado neste arquivo.'
        });
        setIsImporting(false);
        return;
      }

      // Auxiliar para converter base64 em Blob físico
      const base64ToBlob = (base64: string, mime: string) => {
        const byteCharacters = atob(base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type: mime });
      };

      // Auxiliar para substituir as origens de imagens (src) no HTML pelo link do Storage
      const replaceImageSources = (html: string, urls: Record<string, string>) => {
        if (!html) return html;
        return html.replace(/(<img[^>]+src=\s*(?:(["'])([^"']+)\2|([^\s>]+))[^>]*>)/gi, (match, fullTag, quote, src) => {
          let decodedSrc = src || '';
          try { decodedSrc = decodeURIComponent(src); } catch (e) {}
          const filename = decodedSrc.split('/').pop() || decodedSrc;
          const lowerFilename = filename.toLowerCase();
          
          if (urls[lowerFilename]) {
            return match.replace(src, urls[lowerFilename]);
          }
          const sanitizedId = lowerFilename.replace(/[^a-z0-9_.-]/g, '_');
          if (urls[sanitizedId]) {
            return match.replace(src, urls[sanitizedId]);
          }
          return match;
        });
      };

      // Fazer upload individual das mídias para o Firebase Storage
      let mediaSuccessCount = 0;
      let mediaFailCount = 0;
      const mediaUrls: Record<string, string> = {};
      const mediaEntries = Object.entries(data.media || {});
      
      if (mediaEntries.length > 0) {
        const mediaPromises = mediaEntries.map(async ([filename, mediaObj]: [string, any]) => {
          const lowerFilename = filename.toLowerCase();
          const sanitizedId = lowerFilename.replace(/[^a-z0-9_.-]/g, '_');
          try {
            const blob = base64ToBlob(mediaObj.base64, mediaObj.mime);
            const storageRef = ref(storage, `users/${auth.currentUser!.uid}/ankiMedia/${sanitizedId}`);
            
            // Fazer upload do blob físico para o Firebase Storage
            await uploadBytes(storageRef, blob);
            
            // Capturar a URL de download pública e segura
            const downloadUrl = await getDownloadURL(storageRef);
            
            mediaUrls[lowerFilename] = downloadUrl;
            mediaUrls[sanitizedId] = downloadUrl;
            mediaSuccessCount++;
            
            // Salvar uma referência simples (sem o base64 pesado) no Firestore para retrocompatibilidade
            await setDoc(doc(db, 'users', auth.currentUser!.uid, 'ankiMedia', sanitizedId), {
              url: downloadUrl,
              mime: mediaObj.mime,
              userId: auth.currentUser!.uid,
              isReferencedInStorage: true
            });
          } catch (err) {
            console.error("Erro ao fazer upload de mídia para o Firebase Storage:", filename, err);
            mediaFailCount++;
          }
        });
        await Promise.all(mediaPromises);
      }

      // Salvar flashcards no Firestore, já com as tags <img> apontadas para as URLs do Storage
      const promises = cardsToImport.map((card: any) => {
        const questionWithUrls = replaceImageSources(card.question, mediaUrls);
        const answerWithUrls = replaceImageSources(card.answer, mediaUrls);
        
        return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {
          question: questionWithUrls,
          answer: answerWithUrls,
          explanation: card.explanation || '',
          nextReview: new Date().toISOString(),
          interval: 0,
          easeFactor: 2.5,
          userId: auth.currentUser!.uid,
          createdAt: new Date().toISOString(),
          tag: finalDeckName
        }).catch(err => {
           handleFirestoreError(err, OperationType.CREATE, 'flashcards');
           throw err;
         });
      });

      await Promise.all(promises);
      
      let importMsg = `${cardsToImport.length} flashcards adicionados com sucesso.`;
      if (mediaEntries.length > 0) {
        importMsg += `\n\nImagens processadas: ${mediaSuccessCount} salvas com sucesso no Firebase Storage.`;
        if (mediaFailCount > 0) {
          importMsg += `\n⚠️ ${mediaFailCount} imagens falharam no upload para o Storage.`;
        }
      } else {
        importMsg += `\n\nNenhuma imagem encontrada para upload.`;
        if (data.debug) {
          importMsg += `\n\nDiagnóstico do arquivo .apkg:`;
          importMsg += `\n• Arquivo de mídia presente: ${data.debug.hasMediaEntry ? 'Sim' : 'Não'}`;
          importMsg += `\n• Entradas na tabela de mídias: ${data.debug.mediaMapKeysCount}`;
          importMsg += `\n• Arquivos extraídos com sucesso: ${data.debug.mediaFilesKeysCount}`;
          importMsg += `\n• Total de arquivos no ZIP: ${data.debug.zipEntriesCount}`;
          if (data.debug.mediaTextLength !== undefined) {
            importMsg += `\n• Tamanho do texto de mídia: ${data.debug.mediaTextLength} caracteres`;
          }
          if (data.debug.mediaTextSample) {
            importMsg += `\n• Conteúdo de mídia decodificado: "${data.debug.mediaTextSample}"`;
          }
          if (data.debug.zipEntriesSample && data.debug.zipEntriesSample.length > 0) {
            importMsg += `\n• Amostra de arquivos no ZIP: ${data.debug.zipEntriesSample.slice(0, 15).join(', ')}`;
          }
        }
      }

      setModalState({
        isOpen: true,
        type: 'message',
        title: 'Importação concluída',
        message: importMsg
      });
      fetchCards();
    } catch (err: any) {
      console.error(err);
      setModalState({
        isOpen: true,
        type: 'message',
        title: 'Erro na importação',
        message: err.message
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSelectDeck = (tag: string) => {
    setSelectedTag(tag);
    if (tag !== 'ALL' && tag !== 'CREATE_CARD') {
      const now = new Date().toISOString();
      setOpenedDecks(prev => {
        const updated = { ...prev, [tag]: now };
        try {
          localStorage.setItem('deck_opened_timestamps', JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      });
    }
  };

  const isDeckNew = (tag: string, deckCards: Flashcard[]) => {
    if (!deckCards || deckCards.length === 0) return false;
    const lastOpened = openedDecks[tag];
    if (!lastOpened) return true;

    const lastOpenedTime = new Date(lastOpened).getTime();
    return deckCards.some(card => {
      if (!card.createdAt) return false;
      return new Date(card.createdAt).getTime() > lastOpenedTime;
    });
  };

  const handleEditDeckInit = (e: React.MouseEvent, oldTag: string) => {
    e.stopPropagation();
    const cards = allCards.filter(c => (c.tag || 'Sem tag') === oldTag);
    const existingSubtagsSet = new Set<string>();
    cards.forEach(c => {
      if (c.subtag) existingSubtagsSet.add(c.subtag);
      if (c.subtags && Array.isArray(c.subtags)) c.subtags.forEach(st => existingSubtagsSet.add(st));
    });
    setDeckEditModal({
      isOpen: true,
      oldTag,
      newTag: oldTag,
      subtags: Array.from(existingSubtagsSet).join(', ')
    });
  };

  const processEditDeck = async () => {
    const { oldTag, newTag, subtags } = deckEditModal;
    if (!newTag || newTag.trim() === '' || !auth.currentUser) return;

    setLoading(true);
    try {
      const cardsToUpdate = allCards.filter(c => (c.tag || 'Sem tag') === oldTag);
      const cleanNewTag = newTag.trim();
      const cleanSubtag = subtags.trim();
      const subtagsList = cleanSubtag ? cleanSubtag.split(',').map(s => s.trim()).filter(Boolean) : [];

      let batch = writeBatch(db);
      let count = 0;
      for (const card of cardsToUpdate) {
        if (count > 0 && count % 500 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
        const docRef = doc(db, 'users', auth.currentUser.uid, 'flashcards', card.id!);
        batch.update(docRef, {
          tag: cleanNewTag,
          subtag: cleanSubtag,
          subtags: subtagsList
        });
        count++;
      }
      if (count > 0 && count % 500 !== 0) {
        await batch.commit();
      }

      setDeckEditModal({ isOpen: false, oldTag: '', newTag: '', subtags: '' });
      fetchCards(true);
    } catch (err) {
      console.error(err);
      setModalState({
        isOpen: true,
        type: 'message',
        title: 'Erro',
        message: 'Erro ao editar o deck.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCardInit = (cardToEdit?: Flashcard) => {
    const card = cardToEdit || currentCards[currentIndex];
    if (!card) return;
    setCardEditModal({
      isOpen: true,
      card,
      question: card.question || '',
      answer: card.answer || '',
      explanation: card.explanation || '',
      tag: card.tag || '',
      subtag: card.subtag || (card.subtags?.[0] || '')
    });
  };

  const processEditCard = async () => {
    const { card, question, answer, explanation, tag, subtag } = cardEditModal;
    if (!card || !card.id || !auth.currentUser) return;
    if (!question.trim() || !tag.trim()) {
      alert('A pergunta e o caderno/tag são obrigatórios.');
      return;
    }

    setLoading(true);
    try {
      const cleanSubtag = subtag.trim();
      const subtagsList = cleanSubtag ? cleanSubtag.split(',').map(s => s.trim()).filter(Boolean) : [];

      const docRef = doc(db, 'users', auth.currentUser.uid, 'flashcards', card.id);
      await updateDoc(docRef, {
        question: question.trim(),
        answer: answer.trim(),
        explanation: explanation.trim(),
        tag: tag.trim(),
        subtag: cleanSubtag,
        subtags: subtagsList
      });

      setCardEditModal({ isOpen: false, card: null, question: '', answer: '', explanation: '', tag: '', subtag: '' });
      fetchCards(true);
    } catch (err) {
      console.error(err);
      setModalState({
        isOpen: true,
        type: 'message',
        title: 'Erro',
        message: 'Erro ao editar o flashcard.'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDeckInit = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    setModalState({
      isOpen: true,
      type: 'delete',
      title: 'Excluir Deck',
      message: `Tem certeza que deseja excluir o deck "${tag}" e TODOS os seus cartões?`,
      tag: tag
    });
  };

  const processDeleteDeck = async (tag: string) => {
    if (!auth.currentUser) return;
    
    setLoading(true);
    try {
      const cardsToDelete = allCards.filter(c => (c.tag || 'Sem tag') === tag);
      
      let batch = writeBatch(db);
      let count = 0;
      for (const card of cardsToDelete) {
        if (count > 0 && count % 500 === 0) {
          await batch.commit();
          batch = writeBatch(db);
        }
        const docRef = doc(db, 'users', auth.currentUser.uid, 'flashcards', card.id!);
        batch.delete(docRef);
        count++;
      }
      if (count > 0 && count % 500 !== 0) {
        await batch.commit();
      }
      
      fetchCards();
    } catch (err) {
      console.error(err);
      setModalState({
        isOpen: true,
        type: 'message',
        title: 'Erro',
        message: 'Erro ao excluir o deck.'
      });
      setLoading(false);
    }
  };

  const handleDeleteCurrentCardInit = () => {
    const card = currentCards[currentIndex];
    if (!card) return;
    setModalState({
      isOpen: true,
      type: 'delete-card',
      title: 'Excluir Flashcard',
      message: 'Tem certeza que deseja excluir este flashcard permanentemente?',
      tag: card.id
    });
  };

  const processDeleteCard = async (cardId: string) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'flashcards', cardId));
      
      // Remove from allCards local state
      const updatedCards = allCards.filter(c => c.id !== cardId);
      setAllCards(updatedCards);
      
      // Check if we need to adjust index or finish review
      const remainingInDeck = selectedTag === 'ALL' 
        ? updatedCards 
        : updatedCards.filter(c => (c.tag || 'Sem tag') === selectedTag);
        
      if (remainingInDeck.length === 0) {
        setFinished(true);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      } else if (currentIndex >= remainingInDeck.length) {
        setCurrentIndex(remainingInDeck.length - 1);
      }
      setIsFlipped(false);
    } catch (err) {
      console.error(err);
      setModalState({
        isOpen: true,
        type: 'message',
        title: 'Erro',
        message: 'Erro ao excluir o flashcard.'
      });
    } finally {
      setLoading(false);
    }
  };


  const renderModal = () => (
    <>
    <AnimatePresence>
        {modalState.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200"
            >
              <h3 className="text-xl font-bold text-slate-900 mb-2">{modalState.title}</h3>
              <p className="text-slate-600 mb-6">{modalState.message}</p>
              
              {(modalState.type === 'import') && (
                <input
                  type="text"
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-slate-700"
                  value={modalState.inputValue || ''}
                  onChange={(e) => setModalState({ ...modalState, inputValue: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      if (modalState.type === 'import' && modalState.file) {
                        processImport(modalState.inputValue || '', modalState.file);
                      }
                    }
                  }}
                />
              )}

              <div className="flex justify-end gap-3">
                {modalState.type !== 'message' && (
                  <button
                    onClick={() => {
                      setModalState({ ...modalState, isOpen: false });
                      if (modalState.type === 'import' && fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                )}
                <button
                  onClick={() => {
                    if (modalState.type === 'import' && modalState.file) {
                      processImport(modalState.inputValue || '', modalState.file);
                    } else if (modalState.type === 'delete' && modalState.tag) {
                      processDeleteDeck(modalState.tag);
                      setModalState({ ...modalState, isOpen: false });
                    } else if (modalState.type === 'delete-card' && modalState.tag) {
                      processDeleteCard(modalState.tag);
                      setModalState({ ...modalState, isOpen: false });
                    } else {
                      setModalState({ ...modalState, isOpen: false });
                    }
                  }}
                  className={cn(
                    "px-6 py-2 rounded-lg font-bold text-white transition-colors",
                    (modalState.type === 'delete' || modalState.type === 'delete-card') ? "bg-red-500 hover:bg-red-600 shadow-md shadow-red-500/20" : "bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
                  )}
                >
                  {modalState.type === 'message' ? 'OK' : (modalState.type === 'delete' || modalState.type === 'delete-card') ? 'Excluir' : 'Confirmar'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deck Edit Modal */}
      <AnimatePresence>
        {deckEditModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md border border-slate-200 space-y-4"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Editar Deck / Caderno</h3>
                <button onClick={() => setDeckEditModal({ ...deckEditModal, isOpen: false })} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Nome do Deck / Tag Principal</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
                    value={deckEditModal.newTag}
                    onChange={(e) => setDeckEditModal({ ...deckEditModal, newTag: e.target.value })}
                    placeholder="Ex: Clínica Médica"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subtag(s) do Deck</label>
                  <input
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                    value={deckEditModal.subtags}
                    onChange={(e) => setDeckEditModal({ ...deckEditModal, subtags: e.target.value })}
                    placeholder="Ex: Cardiologia, ECG, Valvopatias"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeckEditModal({ ...deckEditModal, isOpen: false })}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processEditDeck}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-600/20 transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Card Edit Modal */}
      <AnimatePresence>
        {cardEditModal.isOpen && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">Editar Flashcard</h3>
                <button onClick={() => setCardEditModal({ ...cardEditModal, isOpen: false })} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Caderno / Tag</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
                      value={cardEditModal.tag}
                      onChange={(e) => setCardEditModal({ ...cardEditModal, tag: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Subtag</label>
                    <input
                      type="text"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                      value={cardEditModal.subtag}
                      onChange={(e) => setCardEditModal({ ...cardEditModal, subtag: e.target.value })}
                      placeholder="Ex: Cardiologia"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Frente (Pergunta)</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                    value={cardEditModal.question}
                    onChange={(e) => setCardEditModal({ ...cardEditModal, question: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Verso (Resposta)</label>
                  <textarea
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                    value={cardEditModal.answer}
                    onChange={(e) => setCardEditModal({ ...cardEditModal, answer: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Explicação (Opcional)</label>
                  <textarea
                    rows={2}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                    value={cardEditModal.explanation}
                    onChange={(e) => setCardEditModal({ ...cardEditModal, explanation: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={() => setCardEditModal({ ...cardEditModal, isOpen: false })}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processEditCard}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-600/20 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full"
        />
        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Acessando memória...</p>
      </div>
    );
  }

  // Tags grouping
  const tagGroups = allCards.reduce((acc, card) => {
    const tag = card.tag || 'Sem tag';
    if (!acc[tag]) acc[tag] = { total: 0, due: 0, cards: [], subtags: new Set<string>() };
    acc[tag].total++;
    acc[tag].cards.push(card);
    if (card.subtag) acc[tag].subtags.add(card.subtag);
    if (card.subtags && Array.isArray(card.subtags)) card.subtags.forEach((st: string) => acc[tag].subtags.add(st));
    if (new Date(card.nextReview).getTime() <= Date.now()) {
      acc[tag].due++;
    }
    return acc;
  }, {} as Record<string, { total: number, due: number, cards: Flashcard[], subtags: Set<string> }>);
  
  const totalDue = allCards.filter(c => new Date(c.nextReview).getTime() <= Date.now()).length;

  if (selectedTag === 'CREATE_CARD') {
    const existingDecks = Array.from(new Set(allCards.map(c => c.tag).filter(Boolean))) as string[];
    return (
      <FlashcardCreator 
        onClose={() => setSelectedTag(null)}
        onCardSaved={() => {
          fetchCards(true);
        }}
        existingDecks={existingDecks}
      />
    );
  }

  if (selectedTag === null) {
    if (allCards.length === 0) {
      return (
        <>
        <div className="text-center py-20 space-y-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-12 max-w-4xl mx-auto">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
              <Book className="w-10 h-10 animate-pulse" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Seu cérebro está limpo!</h2>
            <p className="text-slate-500 max-w-xs mx-auto text-sm">Crie seu primeiro flashcard manualmente ou faça uma importação simplificada de arquivos .apkg do Anki.</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <button
              onClick={() => setSelectedTag('CREATE_CARD')}
              className="bg-indigo-600 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-md border border-indigo-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Criar Primeiro Card
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="bg-slate-100 text-slate-700 px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition shadow-sm border border-slate-200 text-sm"
            >
              <Upload className="w-4 h-4" /> 
              {isImporting ? 'Importando...' : 'Importar do Anki'}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".apkg,.colpkg" />
          </div>
        </div>
        {renderModal()}
        </>
      );
    }

    return (
      <>
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Revisão</h2>
            <h1 className="text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4 mt-1">Meus Decks</h1>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setSelectedTag('CREATE_CARD')}
              className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-sm border border-indigo-700 text-sm"
            >
              <Plus className="w-4 h-4" />
              Criar Flashcard
            </button>
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="bg-white text-slate-700 px-4 py-2 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition shadow-sm border border-slate-200 text-sm"
            >
              <Upload className="w-4 h-4" /> 
              {isImporting ? 'Importando...' : 'Importar'}
            </button>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept=".apkg,.colpkg" />

          <AnimatePresence>
            {showTudoEmDia && (
              <motion.div 
                initial={{ opacity: 0, y: -20, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                className="fixed top-24 left-1/2 -translate-x-1/2 w-[calc(100%-3rem)] md:w-96 bg-white border border-slate-200 p-4 rounded-2xl shadow-2xl z-[60] flex items-center gap-4"
              >
                <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm">Tudo em dia!</p>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Flashcards revisados</p>
                </div>
                <button onClick={() => setShowTudoEmDia(false)} className="p-2 hover:bg-slate-100 text-slate-400 rounded-lg transition">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div 
            onClick={() => setSelectedTag('ALL')}
            className="bg-indigo-600 text-white p-6 rounded-2xl shadow-lg shadow-indigo-200 cursor-pointer hover:bg-indigo-700 transition flex flex-col justify-between min-h-[160px]"
          >
            <div className="flex items-start justify-between">
              <Brain className="w-8 h-8 text-indigo-200" />
            </div>
            <div className="mt-8">
              <h3 className="text-xl font-bold mb-1">Revisão Geral</h3>
              <p className="text-indigo-200 text-sm font-medium">{totalDue} pendentes de {allCards.length} totais</p>
            </div>
          </div>

          {Object.entries(tagGroups).map(([tag, group]: [string, any]) => {
            const isNew = isDeckNew(tag, group.cards);
            return (
              <div 
                key={tag}
                onClick={() => handleSelectDeck(tag)}
                className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:border-indigo-300 hover:shadow-md cursor-pointer transition flex flex-col justify-between min-h-[160px] relative overflow-hidden group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 max-w-[70%]">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-slate-100 text-slate-600 text-xs font-bold uppercase tracking-widest truncate">
                      <TagIcon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tag}</span>
                    </span>
                    {isNew && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-black uppercase tracking-wider shadow-sm shrink-0">
                        Novo (!)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Play className="w-5 h-5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                    <button onClick={(e) => handleEditDeckInit(e, tag)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-indigo-600 rounded-lg transition ml-1" title="Editar nome e tags do deck">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => handleDeleteDeckInit(e, tag)} className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-red-500 rounded-lg transition" title="Excluir deck">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-6 space-y-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{tag}</h3>
                    <p className="text-slate-500 font-medium text-sm">{group.due} pendentes de {group.total}</p>
                  </div>
                  {group.subtags && group.subtags.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {Array.from(group.subtags).slice(0, 4).map((st: any) => (
                        <span key={st} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-semibold">
                          #{st}
                        </span>
                      ))}
                      {group.subtags.size > 4 && (
                        <span className="text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded-md font-semibold">
                          +{group.subtags.size - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {renderModal()}
      </>
    );
  }

  const currentCards = selectedTag === 'ALL' 
    ? allCards 
    : allCards.filter(c => (c.tag || 'Sem tag') === selectedTag);

  if (finished || currentCards.length === 0) {
    return (
      <>
      <div className="text-center py-20 space-y-8 bg-white rounded-2xl border border-slate-200 shadow-sm p-12 max-w-4xl mx-auto">
        <div className="flex justify-center">
          <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
            <Trophy className="w-10 h-10" />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Deck Finalizado!</h2>
          <p className="text-slate-500 max-w-xs mx-auto">Você revisou este deck com sucesso.</p>
        </div>
        <button 
          onClick={() => { setFinished(false); setSelectedTag(null); }}
          className="px-8 py-3 bg-indigo-600 shadow-lg shadow-indigo-100 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          Voltar para Decks
        </button>
      </div>
      {renderModal()}
      </>
    );
  }

  const currentCard = currentCards[currentIndex];

  return (
    <div className="space-y-8 w-full max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedTag(null)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
             <X className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-200 text-slate-600 rounded-lg text-xs font-bold tracking-widest uppercase">
            {selectedTag === 'ALL' ? 'Revisão Geral' : selectedTag}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleEditCardInit(currentCard)} 
            className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-indigo-600 rounded-lg transition-colors"
            title="Editar este flashcard"
          >
            <Edit3 className="w-5 h-5" />
          </button>
          <button 
            onClick={() => handleDeleteCurrentCardInit()} 
            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-lg transition-colors"
            title="Excluir este flashcard permanentemente"
          >
            <Trash2 className="w-5 h-5" />
          </button>
          <div className="px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-bold tracking-widest">
            {currentIndex + 1} / {currentCards.length}
          </div>
        </div>
      </div>

      {/* Card Interface */}
      <div className="relative group perspective-1000">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ opacity: 0, rotateY: -20, scale: 0.95 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: 20, scale: 0.95 }}
              onClick={() => setIsFlipped(true)}
              className="bg-white border focus:outline-none focus:ring-4 focus:ring-indigo-100 border-slate-200 p-10 rounded-2xl shadow-sm min-h-[400px] flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-300 transition-colors relative overflow-hidden"
            >
              <div className="absolute top-6 left-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Card</span>
              </div>
              <div className="text-lg font-semibold leading-relaxed text-slate-900 max-w-2xl mt-8 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:mx-auto [&_img]:my-4 [&_img]:shadow-sm">
                <FlashcardHtml html={currentCard.question} isAnswer={false} />
              </div>
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs font-bold text-indigo-500/80 uppercase tracking-widest text-[9px] flex items-center gap-1 whitespace-nowrap bg-indigo-50 px-3 py-1 rounded-full">
                Clique para revelar a resposta
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ opacity: 0, rotateY: 20, scale: 0.95 }}
              animate={{ opacity: 1, rotateY: 0, scale: 1 }}
              exit={{ opacity: 0, rotateY: -20, scale: 0.95 }}
              className="bg-slate-900 text-white p-10 rounded-2xl shadow-lg min-h-[400px] flex flex-col items-center justify-center text-center relative overflow-hidden w-full"
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <Book className="w-48 h-48" />
              </div>

              <div className="absolute top-6 left-6 flex items-center gap-2 z-10">
                <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Resposta</span>
              </div>
              
              <div className="space-y-6 relative z-10 mt-8 w-full max-w-2xl">
                <div className="text-lg font-medium leading-relaxed text-white px-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-xl [&_img]:mx-auto [&_img]:my-4">
                  <FlashcardHtml html={currentCard.answer} isAnswer={true} />
                </div>
                {currentCard.explanation && (
                  <div className="text-sm text-slate-400 max-w-md mx-auto leading-relaxed border-t border-slate-800 pt-6">
                    <FlashcardHtml html={currentCard.explanation} />
                  </div>
                )}
              </div>

              {/* Feedback Overlay: ERREI (Again) */}
              {gradeFeedback === 'again' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-red-600 flex flex-col items-center justify-center z-30 text-white rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <X className="w-28 h-28 text-white stroke-[4]" />
                    <span className="text-2xl font-black tracking-widest mt-6 uppercase">ERREI</span>
                  </motion.div>
                </motion.div>
              )}

              {/* Feedback Overlay: DIFÍCIL (Hard) */}
              {gradeFeedback === 'hard' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-amber-500 flex flex-col items-center justify-center z-30 text-white rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <Brain className="w-28 h-28 text-white stroke-[2]" />
                    <span className="text-2xl font-black tracking-widest mt-6 uppercase">DIFÍCIL</span>
                  </motion.div>
                </motion.div>
              )}

              {/* Feedback Overlay: BOM (Good) */}
              {gradeFeedback === 'good' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-emerald-600 flex flex-col items-center justify-center z-30 text-white rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <Check className="w-28 h-28 text-white stroke-[4]" />
                    <span className="text-2xl font-black tracking-widest mt-6 uppercase">BOM</span>
                  </motion.div>
                </motion.div>
              )}

              {/* Feedback Overlay: FÁCIL (Easy) */}
              {gradeFeedback === 'easy' && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 bg-teal-600 flex flex-col items-center justify-center z-30 text-white rounded-2xl"
                >
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1.5, opacity: 1 }}
                    transition={{ duration: 0.1, ease: "easeOut" }}
                    className="flex flex-col items-center justify-center"
                  >
                    <Check className="w-28 h-28 text-white stroke-[4]" />
                    <span className="text-2xl font-black tracking-widest mt-6 uppercase">FÁCIL</span>
                  </motion.div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* SRS Controls */}
      <div className={cn(
        "grid grid-cols-4 gap-3 transition-opacity duration-300",
        !isFlipped ? "opacity-20 pointer-events-none blur-sm" : "opacity-100"
      )}>
        <button onClick={() => handleGrade('again')} className="bg-red-500/10 hover:bg-red-500/20 py-4 rounded-xl flex flex-col items-center justify-center transition-colors">
          <span className="text-xs font-bold text-red-500/80 mb-1 tracking-wide">ERREI</span>
          <span className="text-[10px] text-red-400/60 font-medium font-sans mb-1.5">Novo</span>
          <kbd className="bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 text-[9px] font-bold text-red-500 font-sans uppercase">Espaço / 1</kbd>
        </button>
        <button onClick={() => handleGrade('hard')} className="bg-orange-500/10 hover:bg-orange-500/20 py-4 rounded-xl flex flex-col items-center justify-center transition-colors">
          <span className="text-xs font-bold text-orange-500/80 mb-1 tracking-wide">DIFÍCIL</span>
          <span className="text-[10px] text-orange-400/60 font-medium font-sans mb-1.5">1 dia</span>
          <kbd className="bg-orange-500/10 px-1.5 py-0.5 rounded border border-orange-500/20 text-[9px] font-bold text-orange-500 font-sans uppercase">Tab / 2</kbd>
        </button>
        <button onClick={() => handleGrade('good')} className="bg-blue-500/10 hover:bg-blue-500/20 py-4 rounded-xl flex flex-col items-center justify-center transition-colors border border-blue-500/20">
          <span className="text-xs font-bold text-blue-600/80 mb-1 tracking-wide">BOM</span>
          <span className="text-[10px] text-blue-500/60 font-medium font-sans mb-1.5">3 dias</span>
          <kbd className="bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 text-[9px] font-bold text-blue-500 font-sans uppercase">Enter / 3</kbd>
        </button>
        <button onClick={() => handleGrade('easy')} className="bg-green-500/10 hover:bg-green-500/20 py-4 rounded-xl flex flex-col items-center justify-center transition-colors">
          <span className="text-xs font-bold text-green-600/80 mb-1 tracking-wide">FÁCIL</span>
          <span className="text-[10px] text-green-500/60 font-medium font-sans mb-1.5">7 dias</span>
          <kbd className="bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20 text-[9px] font-bold text-green-500 font-sans uppercase">Ctrl+Enter / 4</kbd>
        </button>
      </div>

      {/* Hidden hotkeys listener */}
      {renderModal()}
      <KeyDownListener 
        onSpace={isFlipped ? () => handleGrade('again') : () => setIsFlipped(true)} 
        onEnter={isFlipped ? () => handleGrade('good') : () => setIsFlipped(true)}
        onCtrlEnter={isFlipped ? () => handleGrade('easy') : () => setIsFlipped(true)}
        onTab={isFlipped ? () => handleGrade('hard') : undefined}
        on1={isFlipped ? () => handleGrade('again') : undefined}
        on2={isFlipped ? () => handleGrade('hard') : undefined}
        on3={isFlipped ? () => handleGrade('good') : undefined}
        on4={isFlipped ? () => handleGrade('easy') : undefined}
      />


    </div>
  );
}

function KeyDownListener({ onSpace, onEnter, onCtrlEnter, onTab, on1, on2, on3, on4 }: any) {
  useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        onTab?.();
      }
      if (e.code === 'Space') {
        e.preventDefault();
        onSpace?.();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) {
          onCtrlEnter?.();
        } else {
          onEnter?.();
        }
      }
      if (e.key === '1') on1?.();
      if (e.key === '2') on2?.();
      if (e.key === '3') on3?.();
      if (e.key === '4') on4?.();
    };
    window.addEventListener('keydown', handleDown);
    return () => window.removeEventListener('keydown', handleDown);
  }, [onSpace, onEnter, onCtrlEnter, onTab, on1, on2, on3, on4]);
  return null;
}
