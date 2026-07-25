import { useState } from 'react';
import { Quiz, Question } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';

interface ReviewQuizProps {
  quiz: Quiz;
  onConfirm: (quiz: Quiz) => void;
}

export function ReviewQuiz({ quiz, onConfirm }: ReviewQuizProps) {
  const [editedQuiz, setEditedQuiz] = useState<Quiz>(quiz);
  const [saving, setSaving] = useState(false);

  const handleCorrectAnswerChange = (questionId: string, newCorrectAnswer: string) => {
    setEditedQuiz(prev => ({
      ...prev,
      questions: prev.questions.map(q => 
        q.id === questionId ? { ...q, correctAnswer: newCorrectAnswer } : q
      )
    }));
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      if (auth.currentUser) {
        if (editedQuiz.id) {
          await updateDoc(doc(db, 'quizzes', editedQuiz.id), {
            ...editedQuiz,
            updatedAt: new Date().toISOString()
          });
          onConfirm(editedQuiz);
        } else {
          const docRef = await addDoc(collection(db, 'quizzes'), {
             ...editedQuiz,
             userId: auth.currentUser.uid,
             createdAt: new Date().toISOString()
          });
          onConfirm({ ...editedQuiz, id: docRef.id });
        }
     } else {
        onConfirm(editedQuiz);
     }
    } catch (e) {
      handleFirestoreError(e, OperationType.CREATE, 'quizzes');
      onConfirm(editedQuiz);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-400">Revisar Caderno</h2>
        <h1 className="text-3xl font-bold text-slate-900 border-l-4 border-indigo-600 pl-4">{editedQuiz.title || "Caderno"}</h1>
        <p className="text-slate-500 mt-2 font-medium leading-relaxed">
          O gabarito abaixo foi detectado automaticamente. Você pode revisá-lo e selecionar manualmente as respostas corretas caso haja algum erro.
        </p>
      </div>

      <div className="space-y-6">
        {editedQuiz.questions.map((q, qIndex) => (
          <div key={q.id} className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
             <div className="flex items-start gap-4">
               <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-lg shrink-0 mt-0.5">Q{qIndex + 1}</span>
               <h3 className="text-[17px] font-semibold text-slate-900 leading-snug">{q.text}</h3>
             </div>
             
             <div className="flex flex-col gap-3 ml-0 md:ml-12">
               {q.type === 'discursive' ? (
                 <div className="space-y-3">
                   <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">Gabarito Esperado:</p>
                   <textarea
                     value={q.correctAnswer}
                     onChange={(e) => handleCorrectAnswerChange(q.id, e.target.value)}
                     rows={5}
                     className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-700 outline-none focus:border-indigo-500 font-medium leading-relaxed resize-y"
                   />
                 </div>
               ) : (
                 q.options?.map((opt, optIndex) => {
                   const isCorrect = q.correctAnswer === opt;
                   const checkLetters = ['A', 'B', 'C', 'D', 'E', 'F'];
                   const letter = checkLetters[optIndex] || (optIndex + 1).toString();
                   
                   return (
                     <button
                       key={optIndex}
                       onClick={() => handleCorrectAnswerChange(q.id, opt)}
                       className={cn(
                         "flex items-center gap-4 p-4 rounded-xl border text-left transition-colors group",
                         isCorrect ? "border-2 border-green-500 bg-green-50 text-green-900 font-medium" : "border-slate-200 hover:border-indigo-300 hover:bg-slate-50 text-slate-600"
                       )}
                     >
                       <div className={cn(
                          "w-7 h-7 shrink-0 flex items-center justify-center text-xs font-bold rounded-full",
                          isCorrect ? "bg-green-500 text-white" : "border border-slate-300 text-slate-500 group-hover:border-indigo-500 group-hover:text-indigo-600"
                        )}>
                          {isCorrect ? <Check className="w-4 h-4" /> : letter}
                        </div>
                        <span className="flex-1 text-[15px]">{opt}</span>
                     </button>
                   );
                 })
               )}
             </div>
          </div>
        ))}
      </div>

      <button
        disabled={saving}
        onClick={handleConfirm}
        className="w-full bg-indigo-600 text-white py-5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
            />
            Salvando...
          </span>
        ) : (
          <>
            <span className="flex-1 text-center ml-8 tracking-tight">Confirmar Gabarito e Iniciar</span>
            <ChevronRight className="w-6 h-6 mr-4" />
          </>
        )}
      </button>
    </div>
  );
}
