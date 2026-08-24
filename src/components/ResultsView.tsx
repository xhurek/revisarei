import { apiFetch, parseJsonResponse } from "../lib/firebase";
import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import { Trophy, Brain, RotateCcw, Sparkles, Plus, Check, Clock, AlertCircle, BookOpen } from 'lucide-react';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';
import { importFlashcardsBatchToSupabase } from '../lib/supabaseFlashcards';
import { Flashcard } from '../types';

interface ResultsViewProps {
  results: {
    score: number;
    total: number;
    missed: any[];
    tag?: string;
    title?: string;
    timeElapsed?: number;
  };
  onDone: () => void;
  onRetry: () => void;
}

export function extractTopicAndSubtopic(m: { question: string; answer: string; tag?: string; subtag?: string; subtags?: string[] }): { topic: string; subtopic: string } {
  const qText = m.question || '';
  const aText = m.answer || '';
  const fullText = `${qText} ${aText}`;

  let topic = m.tag || '';
  let subtopic = m.subtag || (m.subtags && m.subtags[0]) || '';

  const isGenericTag = !topic || ['Clínica Médica', 'Cirurgia Geral', 'Pediatria', 'Ginecologia', 'Obstetrícia', 'Medicina de Família e Comunidade', 'Outros', 'Assunto Geral', 'Geral'].includes(topic);

  if (isGenericTag) {
    const diseasePatterns = [
      { pattern: /Doença do Refluxo Gastroesof|DRGE/i, name: 'DRGE' },
      { pattern: /Anemia [Ff]alciforme|falciforme/i, name: 'Anemia Falciforme' },
      { pattern: /Infarto [Aa]gudo do [Mm]iocárdio|IAM\b|SCA\b|Síndrome [Cc]oronaria/i, name: 'IAM / Síndrome Coronariana' },
      { pattern: /Insuficiência [Cc]ardíaca|IC\b/i, name: 'Insuficiência Cardíaca' },
      { pattern: /Cetoacidose [Dd]iabética|CAD\b/i, name: 'Cetoacidose Diabética' },
      { pattern: /Hipertensão|HAS\b/i, name: 'Hipertensão Arterial' },
      { pattern: /Diabetes|DM\b/i, name: 'Diabetes Mellitus' },
      { pattern: /Apendicite/i, name: 'Apendicite Aguda' },
      { pattern: /Colecistite/i, name: 'Colecistite Aguda' },
      { pattern: /Pneumonia|PAC\b/i, name: 'Pneumonia' },
      { pattern: /Tuberculose|BK\b/i, name: 'Tuberculose' },
      { pattern: /Sarampo/i, name: 'Sarampo' },
      { pattern: /Dengue/i, name: 'Dengue' },
      { pattern: /Sepse/i, name: 'Sepse' },
      { pattern: /Asma/i, name: 'Asma' },
      { pattern: /DPOC/i, name: 'DPOC' },
      { pattern: /Acidente [Vv]ascular [Cc]erebral|AVC/i, name: 'AVC' },
      { pattern: /Artrite [Rr]eumatoide/i, name: 'Artrite Reumatoide' },
      { pattern: /Lúpus|LES\b/i, name: 'Lúpus Eritematoso Sistêmico' },
      { pattern: /Hepatite/i, name: 'Hepatite' },
      { pattern: /Cirrose/i, name: 'Cirrose Hepática' },
      { pattern: /Glomerulonefrite|GNDA/i, name: 'Glomerulonefrite' },
      { pattern: /Infecção do [Tt]rato [Uu]rinário|ITU/i, name: 'Infecção Urinária' },
      { pattern: /Pancreatite/i, name: 'Pancreatite Aguda' },
      { pattern: /Meningite/i, name: 'Meningite' },
      { pattern: /Tromboembolismo [Pp]ulmonar|TEP\b|TVP\b/i, name: 'TEP / TVP' },
      { pattern: /Hérnia/i, name: 'Hérnias Abdominais' }
    ];

    for (const dp of diseasePatterns) {
      if (dp.pattern.test(fullText)) {
        topic = dp.name;
        break;
      }
    }

    if (!topic || isGenericTag) {
      const match = qText.match(/(?:da|do|de|com|para)\s+([A-ZÁÉÍÓÚÂÊÔÃÕ][a-záéíóúâêôãõç\s\-]{3,30})(?:\s*\(([A-Z]{2,8})\))?/i);
      if (match) {
        topic = match[2] ? match[2] : match[1].trim();
      } else {
        topic = m.tag || 'Assunto Geral';
      }
    }
  }

  if (!subtopic || subtopic === 'Geral' || subtopic === 'Conceitos gerais e conduta') {
    if (/sequestro esplênico/i.test(fullText)) {
      subtopic = 'Sequestro esplênico';
    } else if (/tratamento|conduta|condutas|terapia|manejo|medicação|fármaco|esquema terapeutico/i.test(qText)) {
      subtopic = 'Tratamento';
    } else if (/diagnóstico|diagnostico|quadro clínico|sintoma|sintomas|sinais/i.test(qText)) {
      subtopic = 'Diagnóstico';
    } else if (/complicaç|crise/i.test(fullText)) {
      subtopic = 'Complicações';
    } else if (/fisiopatologia|mecanismo|causa|etiologia/i.test(qText)) {
      subtopic = 'Fisiopatologia';
    } else if (/prevenção|profilaxia|vacina/i.test(qText)) {
      subtopic = 'Profilaxia e Prevenção';
    } else {
      const cleanAns = aText.replace(/^[A-E]\)\s*/i, '').trim();
      if (cleanAns.length > 0 && cleanAns.length <= 35) {
        subtopic = cleanAns;
      } else {
        subtopic = 'Tratamento e Conduta';
      }
    }
  }

  return { topic, subtopic };
}

export function ResultsView({ results, onDone, onRetry }: ResultsViewProps) {
  const [savingCards, setSavingCards] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const [aiTopics, setAiTopics] = useState<Record<number, { topic: string; subtopic: string; flashcardQuestion?: string; flashcardAnswer?: string }>>({});
  const [isAnalyzing, setIsAnalyzing] = useState(results.missed && results.missed.length > 0);

  const totalQuestions = Number(results.total) || 0;
  const scoreCount = Number(results.score) || 0;
  const percentage = (totalQuestions > 0 && !isNaN(totalQuestions))
    ? Math.round((scoreCount / totalQuestions) * 100)
    : 0;

  // Asynchronously request precise AI topic analysis for missed questions
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (!results.missed || results.missed.length === 0) return;

    setIsAnalyzing(true);
    setSavingCards(true);

    apiFetch('/api/analyze-missed-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: results.missed.map(m => ({ question: m.question, answer: m.answer }))
      })
    })
      .then(async (res) => {
        const data = await parseJsonResponse(res);
        if (data.analysis && Array.isArray(data.analysis)) {
          const map: Record<number, { topic: string; subtopic: string; flashcardQuestion?: string; flashcardAnswer?: string }> = {};
          
          const generatedCards: Flashcard[] = [];
          
          data.analysis.forEach((item: any) => {
            if (item.topic && item.subtopic) {
              map[item.id] = { 
                topic: item.topic, 
                subtopic: item.subtopic,
                flashcardQuestion: item.flashcardQuestion,
                flashcardAnswer: item.flashcardAnswer
              };

              // Auto generate flashcard
              if (item.flashcardQuestion && item.flashcardAnswer && auth.currentUser) {
                const m = results.missed[item.id];
                if (m) {
                  generatedCards.push({
                    id: `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
                    question: item.flashcardQuestion,
                    answer: item.flashcardAnswer,
                    explanation: m.explanation || '',
                    nextReview: new Date().toISOString(),
                    interval: 0,
                    easeFactor: 2.5,
                    userId: auth.currentUser.uid,
                    createdAt: new Date().toISOString(),
                    tag: results.title || item.topic || results.tag || 'Caderno de Erros',
                    subtag: 'Erros',
                    subtags: ['Erros']
                  });
                }
              }
            }
          });
          
          setAiTopics(map);

          if (generatedCards.length > 0 && auth.currentUser) {
            importFlashcardsBatchToSupabase(auth.currentUser.uid, generatedCards)
              .then(() => setSaved(true))
              .catch(err => console.warn("Supabase auto-save flashcards error:", err));
          }
        }
      })
      .catch((err) => {
        console.warn("AI topic analysis fallback to heuristic:", err);
      })
      .finally(() => {
        setIsAnalyzing(false);
        setSavingCards(false);
      });
  }, [results.missed]);

  // Group missed topics and subtags for study recommendations
  const topicsToReviewMap = useMemo(() => {
    if (!results.missed || results.missed.length === 0) return [];
    
    const map: Record<string, Set<string>> = {};

    results.missed.forEach((m, idx) => {
      const info = aiTopics[idx] || extractTopicAndSubtopic(m);
      const topic = info.topic || 'Assunto Geral';
      const subtopic = info.subtopic || 'Geral';

      if (!map[topic]) {
        map[topic] = new Set();
      }
      map[topic].add(subtopic);
    });

    return Object.entries(map).map(([topic, subSet]) => ({
      topic,
      subtopics: Array.from(subSet)
    }));
  }, [results.missed, aiTopics]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
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
            Você acertou <span className="text-indigo-600 font-bold">{scoreCount}</span> de {totalQuestions} {totalQuestions === 1 ? 'questão' : 'questões'}
          </p>
          {results.timeElapsed !== undefined && (
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1.5 pt-2">
              <Clock className="w-3.5 h-3.5 text-indigo-500" /> Tempo total: <span className="text-slate-700 font-mono">{formatTime(results.timeElapsed)}</span>
            </p>
          )}
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

      {/* Assuntos a Revisar */}
      {topicsToReviewMap.length > 0 && (
        <section className="bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-50 rounded-xl border border-amber-200/80 text-amber-600">
              <AlertCircle className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Assuntos a revisar:</h3>
              <p className="text-xs text-slate-500 font-medium">Principais temas e subtemas identificados nas questões que precisam de reforço:</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 pt-1">
            {isAnalyzing ? (
              <div className="flex flex-wrap gap-2 animate-pulse w-full">
                <div className="h-10 w-32 bg-slate-200 rounded-xl"></div>
                <div className="h-10 w-48 bg-slate-200 rounded-xl"></div>
                <div className="h-10 w-40 bg-slate-200 rounded-xl"></div>
              </div>
            ) : topicsToReviewMap.map((item, idx) => {
              const isHoveredOrClicked = activeTooltip === item.topic;
              return (
                <div 
                  key={idx} 
                  className="relative group inline-block"
                  onMouseEnter={() => setActiveTooltip(item.topic)}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(prev => prev === item.topic ? null : item.topic)}
                >
                  <div className="cursor-pointer inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/90 text-amber-950 border border-amber-200 text-xs font-bold hover:bg-amber-100 transition-all shadow-2xs">
                    <BookOpen className="w-4 h-4 text-amber-600 shrink-0" />
                    <span className="font-black text-slate-900">{item.topic}</span>
                    <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200/60 ml-0.5">
                      {item.subtopics.join(', ')}
                    </span>
                  </div>

                  {/* Tooltip */}
                  <div className={cn(
                    "absolute bottom-full left-1/2 -translate-x-1/2 mb-2 transition-all duration-200 z-30 pointer-events-none",
                    isHoveredOrClicked ? "opacity-100 translate-y-0 flex flex-col items-center" : "opacity-0 translate-y-1 hidden group-hover:flex group-hover:opacity-100 group-hover:translate-y-0"
                  )}>
                    <div className="bg-slate-900 text-white text-[11px] font-medium py-2 px-3.5 rounded-xl shadow-xl whitespace-nowrap border border-slate-700 text-center">
                      <span className="text-amber-400 font-bold block mb-0.5">Assunto: {item.topic}</span>
                      <span className="text-slate-100 font-semibold">Subtema(s): {item.subtopics.join(', ')}</span>
                    </div>
                    <div className="w-2.5 h-2.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Missed Questions / Flashcards Action */}
      {results.missed.length > 0 && (
        <section className="bg-indigo-600 text-white p-8 rounded-2xl space-y-8 shadow-lg shadow-indigo-200 relative overflow-hidden">
          <div className="absolute -right-4 -top-8 w-40 h-40 bg-white/5 rounded-full blur-2xl"></div>
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <h3 className="text-xl font-bold">Consolidação do Erro</h3>
              <p className="text-sm text-indigo-100 opacity-90">
                Transformando seus erros em {results.missed.length} flashcards de memorização ativa.
              </p>
            </div>
            <Brain className="w-8 h-8 text-indigo-200" />
          </div>

          <div
            className={cn(
              "w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 relative z-10",
              saved ? "bg-green-500 text-white" : "bg-white/10 text-indigo-50 border border-white/20"
            )}
          >
            {saved ? (
              <>
                <Check className="w-5 h-5" />
                Flashcards Adicionados!
              </>
            ) : isAnalyzing || savingCards ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                />
                Analisando erros e gerando flashcards...
              </>
            ) : null}
          </div>
        </section>
      )}

      {/* Review List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="font-bold flex items-center gap-2 text-slate-900 border-l-4 border-indigo-600 pl-3">Revisão Rápida</h2>
        </div>
        <div className="space-y-4">
          {results.missed.map((m, idx) => {
            const info = aiTopics[idx] || extractTopicAndSubtopic(m);
            return (
              <div key={idx} className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-red-100 text-red-600 rounded-md flex items-center justify-center font-bold text-xs shrink-0">X</div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Questão {idx + 1}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-lg text-xs font-black">
                      Assunto: {isAnalyzing ? '...' : info.topic}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-bold">
                      Subtema: {isAnalyzing ? '...' : info.subtopic}
                    </span>
                  </div>
                </div>
                <p className="text-[15px] font-medium text-slate-800 leading-snug">{m.question}</p>
                <div className="flex items-start gap-2 bg-green-50 p-3 rounded-lg border border-green-100">
                  <Check className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Resposta Correta:</span>
                    <p className="text-sm text-green-900 font-semibold leading-snug">{m.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

