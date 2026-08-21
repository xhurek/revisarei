import React from 'react';
import { motion } from 'motion/react';
import { X, Download, Monitor, Smartphone } from 'lucide-react';

interface InstallAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onTriggerInstall: () => void;
}

export function InstallAppModal({ isOpen, onClose, deferredPrompt, onTriggerInstall }: InstallAppModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl border border-slate-100"
      >
        {/* Header with App Icon */}
        <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 p-4 text-white relative flex items-center gap-3">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 bg-white rounded-xl p-0.5 shadow-md flex items-center justify-center shrink-0">
            <img src="/favicon.svg" alt="Revisarei" className="w-full h-full rounded-lg" />
          </div>

          <div className="pr-6">
            <h3 className="text-sm sm:text-base font-bold leading-tight">Instalar ou Fixar o Revisarei</h3>
            <p className="text-indigo-100 text-[11px] mt-0.5">
              Acesso rápido na Barra de Tarefas e Área de Trabalho
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3 text-xs">
          {deferredPrompt && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 text-center space-y-2">
              <p className="font-bold text-indigo-900">
                Instalação direta disponível no seu navegador!
              </p>
              <button
                onClick={() => {
                  onTriggerInstall();
                  onClose();
                }}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" /> Instalar Aplicativo Agora
              </button>
            </div>
          )}

          {/* PC / Windows Instructions */}
          <div className="border border-slate-100 rounded-xl p-3 space-y-1.5 bg-slate-50/70">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold">
              <Monitor className="w-3.5 h-3.5 text-indigo-600" />
              <span>No Computador (Chrome / Edge)</span>
            </div>
            <ol className="text-slate-600 space-y-1 list-decimal list-inside pl-0.5 leading-relaxed text-[11px]">
              <li>
                Clique no ícone <b>Instalar</b> na barra de endereço ou nos <b>três pontos (⋮)</b>.
              </li>
              <li>
                Selecione <b>"Transmitir, salvar e compartilhar"</b> (ou <i>Mais ferramentas</i>) → <b>"Criar atalho..."</b> ou <b>"Instalar Revisarei"</b>.
              </li>
              <li>
                Marque <b>"Abrir como janela"</b> e clique em <b>Criar</b> para fixar na Barra de Tarefas.
              </li>
            </ol>
          </div>

          {/* Mobile Instructions */}
          <div className="border border-slate-100 rounded-xl p-3 space-y-1.5 bg-slate-50/70">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold">
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>No Celular (Android / iOS)</span>
            </div>
            <div className="text-slate-600 space-y-1 leading-relaxed text-[11px]">
              <p>
                <b>Android:</b> Toque nos três pontos <b>⋮</b> → <b>"Adicionar à tela inicial"</b> ou <b>"Instalar aplicativo"</b>.
              </p>
              <p>
                <b>iPhone/iPad:</b> Toque em <b>Compartilhar ⎋</b> → <b>"Adicionar à Tela de Início"</b>.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg transition"
          >
            Entendido
          </button>
        </div>
      </motion.div>
    </div>
  );
}

