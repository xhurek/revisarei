import { apiFetch } from "../lib/firebase";
import { useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Brain, RotateCcw, Sparkles, Plus, Check } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface ResultsViewProps {
  results: {
    score: number;
    total: number;
    missed: any[];
    tag?: string;
    title?: string;
  };
  onDone: () => void;
  onRetry: () => void;
}

export function ResultsView({ results, onDone, onRetry }: ResultsViewProps) {
  const [savingCards, setSavingCards] = useState(false);
  const [saved, setSaved] = useState(false);

  const percentage = Math.round((results.score / results.total) * 100);

  const handleConvertToFlashcards = async () => {
    if (!auth.currentUser) return;
    setSavingCards(true);

    try {
      const promises = results.missed.map(async (m) => {
        try {
          const response = await apiFetch('/api/generate-flashcard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: m.question,
              expectedAnswer: m.answer,
              userAnswer: m.userAnswer || ''
            })
          });
          
          if (!response.ok) throw new Error('Falha na IA');
          
          const flashcardData = await response.json();
          
          return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {
            question: flashcardData.flashcardQuestion || m.question,
            answer: flashcardData.flashcardAnswer || m.answer,
            explanation: flashcardData.explanation || m.explanation || '',
            nextReview: new Date().toISOString(),
            interval: 0,
            easeFactor: 2.5,
            userId: auth.currentUser!.uid,
            createdAt: new Date().toISOString(),
            tag: results.tag || 'Geral'
          });
        } catch (e) {
          // Fallback to basic extraction if AI fails
          return addDoc(collection(db, 'users', auth.currentUser!.uid, 'flashcards'), {
            question: m.question,
            answer: m.answer,
            explanation: m.explanation || '',
            nextReview: new Date().toISOString(),
            interval: 0,
            easeFactor: 2.5,
            userId: auth.currentUser!.uid,
            createdAt: new Date().toISOString(),
            tag: results.tag || 'Geral'
          });
        }
      });

      await Promise.all(promises);
      setSaved(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'flashcards');
    } finally {
      setSavingCards(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-12">
      {/* Result Card */}
      <section className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center space-y-8">
        <div className="flex justify-center">
          <div className="relative">
            <motion.div 
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 12 }}
              className="w-24 h-24 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-100"
            >
              <Trophy className="w-10 h-10" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute -top-3 -right-3 bg-green-500 text-white p-1.5 rounded-full border-4 border-white"
            >
              <Sparkles className="w-4 h-4" />
            </motion.div>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight text-slate-900">{percentage}%</h1>
          <p className="text-slate-500 font-medium">
            Você acertou <span className="text-indigo-600 font-bold">{results.score}</span> de {results.total} questões
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={onRetry}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-6 border border-slate-200 rounded-xl font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            Refazer
          </button>
          <button
            onClick={onDone}
            className="flex-1 py-3 px-6 bg-slate-100 rounded-xl font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Sair
          </button>
        </div>
      </section>

      {/* Missed Questions / Flashcards Action */}
      {results.missed.length > 0 && (
        <section className="bg-indigo-600 text-white p-8 rounded-2xl space-y-8 shadow-lg shadow-indigo-200 relative overflow-hidden">
          <div className="absolute -right-4 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">Consolide seu Erro</h3>
              <p className="text-sm text-indigo-100 opacity-90">As {results.missed.length} questões que você errou podem virar flashcards agora.</p>
            </div>
            <Brain className="w-8 h-8 text-indigo-200" />
          </div>

          <button
            disabled={savingCards || saved}
            onClick={handleConvertToFlashcards}
            className={cn(
              "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors relative z-10",
              saved ? "bg-green-500 text-white" : "bg-white text-indigo-600 hover:bg-indigo-50"
            )}
          >
            {saved ? (
              <>
                <Check className="w-5 h-5" />
                Flashcards Adicionados!
              </>
            ) : savingCards ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                />
                Salvando...
              </>
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Criar Flashcards do Erro
              </>
            )}
          </button>
        </section>
      )}

      {/* Review List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-bold flex items-center gap-2 text-slate-900 border-l-4 border-indigo-600 pl-3">Revisão Rápida</h2>
        </div>
        <div className="space-y-4">
          {results.missed.slice(0, 3).map((m, idx) => (
            <div key={idx} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex gap-6">
              <div className="w-8 h-8 bg-red-100 text-red-600 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">X</div>
              <div className="space-y-2">
                <p className="text-[15px] font-medium text-slate-800 leading-snug line-clamp-2">{m.question}</p>
                <div className="flex items-start gap-2 bg-green-50 p-3 rounded-lg border border-green-100">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-green-800 font-medium leading-snug">{m.answer}</p>
                </div>
              </div>
            </div>
          ))}
          {results.missed.length > 3 && (
            <p className="text-center text-sm font-medium text-slate-400">... e mais {results.missed.length - 3} questões</p>
          )}
        </div>
      </section>
    </div>
  );
}
