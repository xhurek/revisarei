import React from 'react';
import { motion } from 'motion/react';
import { Brain, Sparkles } from 'lucide-react';
import { signInWithGoogle } from '../lib/firebase';

export function LoginView() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-50 font-sans">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, -50, 0],
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-300 rounded-full mix-blend-multiply filter blur-[100px] opacity-40"
        />
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.4, 0.3],
            x: [0, -30, 0],
            y: [0, 50, 0],
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-violet-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-40"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-md p-6 sm:p-10"
      >
        <div className="bg-white/70 backdrop-blur-3xl border border-white p-8 sm:p-10 rounded-[2.5rem] shadow-2xl shadow-indigo-900/5 flex flex-col items-center text-center relative overflow-hidden">
          {/* Inner subtle glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 20 }}
            className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-[1.25rem] flex items-center justify-center mx-auto mb-8 shadow-xl shadow-indigo-600/30 relative group"
          >
            <Brain className="text-white w-10 h-10 relative z-10 drop-shadow-md" />
            <Sparkles className="w-4 h-4 text-indigo-200 absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity" />
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent rounded-[1.25rem]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="relative z-10"
          >
            <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 mb-3 font-sans">
              Revisarei
            </h1>
            <p className="text-slate-500 font-medium mb-10 text-sm max-w-[280px] mx-auto leading-relaxed">
              Sua plataforma inteligente de estudos com inteligência artificial e repetição espaçada.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="w-full space-y-5 relative z-10"
          >
            <button
              onClick={signInWithGoogle}
              className="w-full bg-indigo-600 text-white font-bold py-4 px-6 rounded-2xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-3 shadow-[0_8px_30px_-4px_rgba(79,70,229,0.3)] hover:shadow-[0_12px_40px_-4px_rgba(79,70,229,0.4)] hover:-translate-y-0.5 active:translate-y-0"
            >
              <img src="https://www.google.com/favicon.ico" className="w-5 h-5 bg-white rounded-full p-0.5" alt="Google" />
              Continuar com Google
            </button>
            <p className="text-xs text-slate-400 font-medium">
              Nota: O acesso deve ser autorizado por um administrador.
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
