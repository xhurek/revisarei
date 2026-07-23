import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { X, Send, AlertCircle, MessageSquare } from 'lucide-react';

interface ReportErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
}

export function ReportErrorModal({ isOpen, onClose, currentPage }: ReportErrorModalProps) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !auth.currentUser) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'error_reports'), {
        userId: auth.currentUser.uid,
        userName: auth.currentUser.displayName || 'Usuário',
        userEmail: auth.currentUser.email || '',
        message: message.trim(),
        page: currentPage,
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
        setMessage('');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'error_reports');
      alert('Erro ao enviar relatório. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden"
          >
            {success ? (
              <div className="p-12 text-center space-y-4">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Send className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900">Relatório Enviado!</h3>
                <p className="text-slate-500">Obrigado por nos ajudar a melhorar. Analisaremos o problema em breve.</p>
              </div>
            ) : (
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 text-red-600 rounded-xl flex items-center justify-center">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">Reportar Erro</h3>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Help us improve</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                       <MessageSquare className="w-4 h-4" /> Descreva o problema
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="O que aconteceu? Como podemos reproduzir o erro?"
                      rows={5}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:ring-2 focus:ring-indigo-600 focus:border-transparent outline-none transition resize-none text-slate-600 text-sm"
                      required
                    />
                  </div>

                  <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                      Informações de sistema serão incluídas automaticamente (URL, Usuário)
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !message.trim()}
                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 shadow-lg shadow-slate-200"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Enviar Relatório
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
