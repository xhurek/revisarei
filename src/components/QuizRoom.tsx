import { apiFetch } from "../lib/firebase";
import React, { useState, useEffect } from 'react';
import { Quiz, Question, UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ChevronLeft, CheckCircle2, XCircle, ArrowLeft, Trophy, Brain, User as UserIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import confetti from 'canvas-confetti';
import { collection, query, where, getDocs, addDoc, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

function isUserAnswerCorrect(userAns: string, correctAns: string, options?: string[]): boolean {
  if (!userAns || !correctAns) return false;
  
  const cleanUser = userAns.trim().toLowerCase();
  const cleanCorrect = correctAns.trim().toLowerCase();
  
  if (cleanUser === cleanCorrect) return true;
  
  const getLetter = (text: string): string | null => {
    const trimmed = text.trim();
    if (/^[A-F]$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const match = trimmed.match(/^([A-F])[\)\.\-]/i);
    if (match) {
      return match[1].toUpperCase();
    }
    return null;
  };

  const userLetter = getLetter(userAns);
  const correctLetter = getLetter(correctAns);

  if (userLetter && correctLetter && userLetter === correctLetter) {
    return true;
  }

  if (options && options.length > 0) {
    const checkLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
    
    const userIndex = options.findIndex(opt => opt.trim().toLowerCase() === cleanUser);
    if (userIndex !== -1) {
      const userAssignedLetter = checkLetters[userIndex];
      
      if (correctLetter && userAssignedLetter === correctLetter) {
        return true;
      }
      
      const cleanOpt = (text: string) => {
        return text.replace(/^([A-F])[\)\.\-\s]+/i, '').trim().toLowerCase();
      };
      
      if (cleanOpt(userAns) === cleanOpt(correctAns)) {
        return true;
      }
    }
    
    if (correctLetter) {
      const correctIdx = checkLetters.indexOf(correctLetter);
      if (correctIdx !== -1 && correctIdx < options.length) {
        const correctOptionText = options[correctIdx];
        if (correctOptionText.trim().toLowerCase() === cleanUser) {
          return true;
        }
      }
    }
  }

  const cleanText = (text: string) => {
    return text.replace(/^([A-F])[\)\.\-\s]+/i, '').trim().toLowerCase();
  };
  if (cleanText(userAns) === cleanText(correctAns)) {
    return true;
  }

  return false;
}

function getFormattedCorrectAnswer(correctAns: string, options?: string[]): string {
  if (!correctAns) return '';
  if (!options || options.length === 0) return correctAns;
  
  const checkLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
  const cleanCorrect = correctAns.trim().toLowerCase();
  
  const getLetter = (text: string): string | null => {
    const trimmed = text.trim();
    if (/^[A-F]$/i.test(trimmed)) {
      return trimmed.toUpperCase();
    }
    const match = trimmed.match(/^([A-F])[\)\.\-]/i);
    if (match) {
      return match[1].toUpperCase();
    }
    return null;
  };

  const correctLetter = getLetter(correctAns);
  if (correctLetter) {
    const correctIdx = checkLetters.indexOf(correctLetter);
    if (correctIdx !== -1 && correctIdx < options.length) {
      const optionText = options[correctIdx];
      if (optionText.trim().toUpperCase().startsWith(correctLetter)) {
        return optionText;
      }
      return `${correctLetter}) ${optionText}`;
    }
  }

  const userIndex = options.findIndex(opt => opt.trim().toLowerCase() === cleanCorrect);
  if (userIndex !== -1) {
    const optionText = options[userIndex];
    const letter = checkLetters[userIndex];
    if (optionText.trim().toUpperCase().startsWith(letter)) {
      return optionText;
    }
    return `${letter}) ${optionText}`;
  }

  return correctAns;
}

function SimpleMarkdown({ text }: { text: string }) {
  if (!text) return null;

  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

  const parseInlineMarkdown = (lineText: string): React.ReactNode[] => {
    const parts = lineText.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const flushList = (key: number) => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${key}`} className="list-disc pl-5 my-2 space-y-1 text-slate-700">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith('### ')) {
      flushList(idx);
      renderedElements.push(
        <h4 key={idx} className="text-base font-bold text-slate-900 mt-4 mb-2">
          {parseInlineMarkdown(trimmed.substring(4))}
        </h4>
      );
    } else if (trimmed.startsWith('## ')) {
      flushList(idx);
      renderedElements.push(
        <h3 key={idx} className="text-lg font-bold text-slate-900 mt-4 mb-2">
          {parseInlineMarkdown(trimmed.substring(3))}
        </h3>
      );
    } else if (trimmed.startsWith('# ')) {
      flushList(idx);
      renderedElements.push(
        <h2 key={idx} className="text-xl font-bold text-slate-900 mt-6 mb-3">
          {parseInlineMarkdown(trimmed.substring(2))}
        </h2>
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(
        <li key={idx} className="text-sm">
          {parseInlineMarkdown(trimmed.substring(2))}
        </li>
      );
    } else if (trimmed === '') {
      flushList(idx);
      renderedElements.push(<div key={idx} className="h-2" />);
    } else {
      flushList(idx);
      renderedElements.push(
        <p key={idx} className="text-sm text-slate-700 leading-relaxed mb-2">
          {parseInlineMarkdown(line)}
        </p>
      );
    }
  });

  flushList(lines.length);

  return <div className="space-y-1">{renderedElements}</div>;
}

interface QuizRoomProps {
  quiz: Quiz;
  userData: UserProfile | null;
  onFinish: (score: number, total: number, missed: any[], categoryStats?: Record<string, { correct: number, total: number }>) => void;
  onCancel: () => void;
}

export function QuizRoom({ quiz, userData, onFinish, onCancel }: QuizRoomProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [revealed, setRevealed] = useState<{ [key: string]: boolean }>({});
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  
  // For discursive questions
  const [discursiveText, setDiscursiveText] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [discursiveFeedback, setDiscursiveFeedback] = useState<{ [key: string]: { score: number, feedback: string } }>({});

  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationStream, setExplanationStream] = useState('');

  const currentQuestion = quiz.questions[currentIndex];
  const progress = ((currentIndex) / quiz.questions.length) * 100;

  useEffect(() => {
    // Reset explanation stream when question changes
    setExplanationStream('');
    setIsExplaining(false);
  }, [currentIndex]);

  useEffect(() => {
    if (quiz.isPublic && quiz.id && currentQuestion) {
      setComments([]);
      const fetchComments = async () => {
        try {
          const q = query(
            collection(db, 'comments'),
            where('quizId', '==', quiz.id),
            where('questionId', '==', currentQuestion.id),
            // ordering by createdAt gives an error if no index, so we do client-side sorting
          );
          const snapshot = await getDocs(q);
          const fetched = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
          fetched.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          setComments(fetched);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'comments');
          console.error(err);
        }
      };
      fetchComments();
    }
  }, [currentIndex, quiz.id, currentQuestion, quiz.isPublic]);

  const handleSendComment = async () => {
    if (!newComment.trim() || !quiz.id || !auth.currentUser) return;
    try {
      const commentData = {
        quizId: quiz.id,
        questionId: currentQuestion.id,
        quizTitle: quiz.title,
        text: newComment.trim(),
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Usuário',
        userPhoto: auth.currentUser.photoURL || '',
        userTitle: (userData as any)?.title || '',
        createdAt: new Date().toISOString()
      };
      try {
        const docRef = await addDoc(collection(db, 'comments'), commentData);
        setComments(prev => [...prev, { ...commentData, id: docRef.id }]);
        setNewComment('');
        
        // We could ideally trigger a notification creation here for the quiz owner
        if (quiz.userId && quiz.userId !== auth.currentUser.uid) {
           try {
             await addDoc(collection(db, 'notifications'), {
               userId: quiz.userId, // quiz owner
               type: 'comment',
               quiz: quiz,
               message: `${auth.currentUser.displayName || 'Usuário'} comentou: "${newComment.substring(0, 30)}..." na sua questão pública.`,
               time: new Date().toLocaleTimeString(),
               read: false,
               createdAt: new Date().toISOString()
             });
           } catch (notifErr) {
             handleFirestoreError(notifErr, OperationType.CREATE, 'notifications');
           }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'comments');
        console.error(err);
        alert('Erro ao enviar comentário.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectOption = (option: string) => {
    if (revealed[currentQuestion.id]) return;
    setSelectedOption(option);
  };

  const handleConfirmOption = () => {
    if (!selectedOption) return;
    
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: selectedOption }));
    setRevealed(prev => ({ ...prev, [currentQuestion.id]: true }));
    
    const isCorrect = isUserAnswerCorrect(selectedOption, currentQuestion.correctAnswer, currentQuestion.options);

    if (isCorrect) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#4F46E5', '#10B981', '#F59E0B', '#EF4444']
      });
    }
  };

  const handleExplainQuestion = async () => {
    setIsExplaining(true);
    setExplanationStream('');
    
    try {
      const response = await apiFetch('/api/explain-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion.text,
          options: currentQuestion.options,
          correctAnswer: currentQuestion.correctAnswer,
          userAnswer: answers[currentQuestion.id],
          knowledgeBase: quiz.knowledgeBase || []
        })
      });

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let text = '';
        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
             text += decoder.decode(value, { stream: !done });
             setExplanationStream(text);
          }
        }
      }
    } catch (e) {
       console.error("Explanation error:", e);
       setExplanationStream("Houve um erro ao gerar a explicação.");
    } finally {
       setIsExplaining(false);
    }
  };

  const handleEvaluateDiscursive = async () => {
    if (!discursiveText.trim()) return;
    setIsEvaluating(true);
    
    try {
      const response = await apiFetch('/api/evaluate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion.text,
          expectedAnswer: currentQuestion.correctAnswer,
          userAnswer: discursiveText,
          knowledgeBase: quiz.knowledgeBase || []
        })
      });
      
      if (!response.ok) {
         const errText = await response.text();
         throw new Error(`Server error: ${response.status} ${errText.substring(0, 100)}`);
      }
      
      const data = await response.json();
      setDiscursiveFeedback(prev => ({ ...prev, [currentQuestion.id]: data }));
      setAnswers(prev => ({ ...prev, [currentQuestion.id]: discursiveText }));
      setRevealed(prev => ({ ...prev, [currentQuestion.id]: true }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleNext = () => {
    setDiscursiveText('');
    setSelectedOption(null);
    
    if (currentIndex < quiz.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Calculate results
      let score = 0;
      const missed: any[] = [];
      const categoryStats: Record<string, { correct: number, total: number }> = {};

      quiz.questions.forEach(q => {
        const cat = q.category || quiz.mainTag || 'Outros';
        if (!categoryStats[cat]) categoryStats[cat] = { correct: 0, total: 0 };
        categoryStats[cat].total += 1;

        if (q.type === 'discursive') {
          const evalData = discursiveFeedback[q.id];
          if (evalData) {
            score += evalData.score;
            if (evalData.score >= 1.0) {
              categoryStats[cat].correct += 1;
            } else {
              missed.push({
                question: q.text,
                answer: q.correctAnswer,
                explanation: evalData.feedback,
                userAnswer: answers[q.id]
              });
            }
          }
        } else {
          if (isUserAnswerCorrect(answers[q.id], q.correctAnswer, q.options)) {
            score++;
            categoryStats[cat].correct += 1;
          } else {
            missed.push({
              question: q.text,
              answer: q.correctAnswer,
              explanation: q.explanation,
              userAnswer: answers[q.id]
            });
          }
        }
      });
      onFinish(score, quiz.questions.length, missed, categoryStats);
    }
  };

  return (
    <div className="space-y-8">
      {/* Quiz Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onCancel}
          className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-indigo-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Abandonar
        </button>
        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Questão <span className="text-indigo-600">{currentIndex + 1}</span> / {quiz.questions.length}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          className="h-full bg-indigo-500"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 md:p-6 flex flex-col space-y-4"
        >
          {/* Question Text */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest flex items-center gap-2">
              Questão {currentIndex + 1} 
              {currentQuestion.type === 'discursive' && (
                <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-[10px]">Discursiva</span>
              )}
            </span>
            <h1 className="text-lg md:text-xl font-semibold leading-snug text-slate-900 mt-1">
              {currentQuestion.text}
            </h1>
          </div>

          {/* Options / Input */}
          <div className="grid grid-cols-1 gap-3 flex-1">
            {currentQuestion.type === 'discursive' ? (
              <div className="space-y-4">
                <textarea
                  disabled={revealed[currentQuestion.id] || isEvaluating}
                  value={revealed[currentQuestion.id] ? answers[currentQuestion.id] : discursiveText}
                  onChange={(e) => setDiscursiveText(e.target.value)}
                  placeholder="Digite sua resposta aqui..."
                  className="w-full h-32 bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:border-indigo-500 font-medium leading-relaxed resize-none disabled:opacity-75 text-sm"
                />
                {!revealed[currentQuestion.id] && (
                  <button
                    onClick={handleEvaluateDiscursive}
                    disabled={isEvaluating || !discursiveText.trim()}
                    className="w-full bg-indigo-600 text-white rounded-xl py-3 text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isEvaluating ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        />
                        A IA está corrigindo...
                      </>
                    ) : (
                      <>
                        <Brain className="w-5 h-5" /> Corrigir resposta
                      </>
                    )}
                  </button>
                )}
              </div>
            ) : (
              currentQuestion.options?.map((option, idx) => {
                const checkLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
                const letter = checkLetters[idx] || (idx + 1).toString();
                const isSelected = selectedOption === option;
                const isSubmitted = answers[currentQuestion.id] === option;
                
                const isCorrect = isUserAnswerCorrect(option, currentQuestion.correctAnswer, currentQuestion.options);

                const hasRevealed = revealed[currentQuestion.id];
                const submittedWrong = hasRevealed && isSubmitted && !isCorrect;

                return (
                  <motion.button
                    key={idx}
                    onClick={() => handleSelectOption(option)}
                    disabled={hasRevealed}
                    animate={
                      hasRevealed && isCorrect && submittedWrong ? { x: [-5, 5, -5, 5, 0] } : {}
                    }
                    transition={{ duration: 0.4 }}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border text-left group transition-all",
                      !hasRevealed && !isSelected && "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600 bg-white",
                      !hasRevealed && isSelected && "border-2 border-indigo-500 bg-indigo-50 text-indigo-900 shadow-sm",
                      hasRevealed && isCorrect && "border-2 border-green-500 bg-green-50 text-green-900 font-medium",
                      hasRevealed && isSubmitted && !isCorrect && "border-2 border-red-500 bg-red-50 text-red-900 font-medium",
                      hasRevealed && !isCorrect && !isSubmitted && "border-slate-100 bg-white opacity-50 text-slate-400 cursor-default"
                    )}
                  >
                    <div className={cn(
                      "w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold rounded-full transition-colors",
                      !hasRevealed && !isSelected && "border border-slate-300 text-slate-500 group-hover:border-indigo-500 group-hover:text-indigo-600",
                      !hasRevealed && isSelected && "bg-indigo-600 text-white border-0",
                      hasRevealed && isCorrect && "bg-green-500 text-white border-0",
                      hasRevealed && isSubmitted && !isCorrect && "bg-red-500 text-white border-0",
                      hasRevealed && !isCorrect && !isSubmitted && "border border-slate-200 text-slate-400"
                    )}>
                      {letter}
                    </div>
                    <span className="flex-1 text-sm">{option}</span>
                    {hasRevealed && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                    {hasRevealed && isSubmitted && !isCorrect && <XCircle className="w-5 h-5 text-red-500 shrink-0" />}
                  </motion.button>
                );
              })
            )}

            {!revealed[currentQuestion.id] && currentQuestion.type !== 'discursive' && (
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleConfirmOption}
                  disabled={!selectedOption}
                  className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Marcar e enviar
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>

          {/* Explanation / Footer */}
          {revealed[currentQuestion.id] && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-3 border-t border-slate-100 space-y-3"
            >
              {currentQuestion.type !== 'discursive' && (
                <div className={cn(
                  "p-5 rounded-xl border flex items-start gap-3",
                  isUserAnswerCorrect(answers[currentQuestion.id], currentQuestion.correctAnswer, currentQuestion.options)
                    ? "bg-green-50 border-green-200 text-green-800" 
                    : "bg-red-50 border-red-200 text-red-800"
                )}>
                  {isUserAnswerCorrect(answers[currentQuestion.id], currentQuestion.correctAnswer, currentQuestion.options) ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-bold text-green-900">Resposta Correta!</p>
                        <p className="text-sm">Você acertou esta questão.</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-bold text-red-900">Resposta Incorreta.</p>
                        <p className="text-sm">
                          A alternativa correta é: <span className="font-bold underline">{getFormattedCorrectAnswer(currentQuestion.correctAnswer, currentQuestion.options)}</span>
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentQuestion.type === 'discursive' ? (
                <div className="space-y-4">
                   <div className={cn(
                     "p-6 rounded-xl border flex flex-col gap-3",
                     discursiveFeedback[currentQuestion.id]?.score >= 0.8 ? "bg-green-50 border-green-200" :
                     discursiveFeedback[currentQuestion.id]?.score >= 0.5 ? "bg-yellow-50 border-yellow-200" :
                     "bg-red-50 border-red-200"
                   )}>
                     <div className="flex items-center gap-2 font-bold mb-2">
                       {discursiveFeedback[currentQuestion.id]?.score >= 0.8 ? <CheckCircle2 className="w-5 h-5 text-green-600" /> :
                        discursiveFeedback[currentQuestion.id]?.score >= 0.5 ? <Trophy className="w-5 h-5 text-yellow-600" /> :
                        <XCircle className="w-5 h-5 text-red-600" />}
                       <span className={cn(
                          discursiveFeedback[currentQuestion.id]?.score >= 0.8 ? "text-green-700" :
                          discursiveFeedback[currentQuestion.id]?.score >= 0.5 ? "text-yellow-700" :
                          "text-red-700"
                       )}>Pontuação IA: {Math.round(discursiveFeedback[currentQuestion.id]?.score * 100)}%</span>
                     </div>
                     <div className="text-slate-800 leading-relaxed font-medium">
                       <SimpleMarkdown text={discursiveFeedback[currentQuestion.id]?.feedback} />
                     </div>
                   </div>
                   
                   <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                     <p className="text-xs font-bold flex items-center gap-2 text-indigo-600 mb-2 font-sans"><Brain className="w-4 h-4" /> Gabarito esperado</p>
                     <p className="text-slate-700 leading-relaxed font-medium">{currentQuestion.correctAnswer}</p>
                   </div>
                </div>
              ) : (
                currentQuestion.explanation && (
                  <div className="p-6 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold flex items-center gap-2 text-indigo-600 mb-2 font-sans"><Trophy className="w-4 h-4" /> Explicação Original</p>
                    <p className="text-slate-700 leading-relaxed font-medium">{currentQuestion.explanation}</p>
                  </div>
                )
              )}

              {(isExplaining || explanationStream) && (
                 <div className="w-full mt-4 p-6 bg-indigo-50/50 rounded-xl border border-indigo-100">
                    <p className="text-xs font-bold flex items-center gap-2 text-indigo-600 mb-4 font-sans uppercase tracking-widest"><Brain className="w-4 h-4" /> Explicação Inteligente</p>
                    {isExplaining && !explanationStream ? (
                      <div className="flex gap-2 items-center text-sm font-medium text-indigo-400">
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full" />
                        Analisando a questão...
                      </div>
                    ) : (
                      <div className="text-slate-700 leading-relaxed font-medium markdown-body text-sm">
                        <SimpleMarkdown text={explanationStream} />
                      </div>
                    )}
                 </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end items-center mt-6 pt-6 gap-3 border-t border-slate-100">
                 {!explanationStream && !isExplaining && (
                    <button
                      onClick={handleExplainQuestion}
                      className="text-sm font-bold text-indigo-600 bg-indigo-50 px-5 py-3 rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 w-full sm:w-auto"
                    >
                      <Brain className="w-4 h-4" /> 
                      {quiz.knowledgeBase && quiz.knowledgeBase.length > 0 ? "Explicar com IA (Material)" : "Explicar com IA"}
                    </button>
                 )}
                 <button
                   onClick={handleNext}
                   className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors w-full sm:w-auto"
                 >
                   {currentIndex < quiz.questions.length - 1 ? "Próxima pergunta" : "Ver resultados"}
                   <ChevronRight className="w-5 h-5" />
                 </button>
              </div>

              {quiz.isPublic && (
                <div className="mt-8 pt-8 border-t border-slate-100">
                  <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">Notas e Comentários da Comunidade</h3>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Adicione uma nota ou comentário para esta questão..." 
                      className="flex-1 bg-white border border-slate-200 rounded-xl p-3 text-sm outline-none focus:border-indigo-500" 
                      onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                    />
                    <button onClick={handleSendComment} className="bg-slate-100 text-slate-600 px-4 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors">Enviar</button>
                  </div>
                  <div className="mt-4 space-y-4">
                    {comments.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium">Os comentários aparecerão aqui. Seja o primeiro a comentar!</p>
                    ) : (
                      comments.map(c => (
                        <div key={c.id} className="flex gap-3 animate-in fade-in slide-in-from-top-1 duration-300">
                          <div className="w-10 h-10 bg-slate-100 rounded-full overflow-hidden shrink-0 shadow-sm border border-white">
                            {c.userPhoto ? (
                              <img src={c.userPhoto} alt={c.userName} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-400">
                                <UserIcon className="w-5 h-5" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-sm font-bold text-slate-900 leading-none">{c.userName}</span>
                              {c.userTitle && (
                                <span className="bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded-full border border-indigo-100">
                                  {c.userTitle}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(c.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-2xl rounded-tl-none border border-slate-100 shadow-sm">
                              <p className="text-sm text-slate-700 leading-relaxed">{c.text}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
