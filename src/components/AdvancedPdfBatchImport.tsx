import { apiFetch } from "../lib/firebase";
import React, { useState, useRef } from 'react';
import { UploadCloud, Check, Save, FileText, Loader2, Play, Square, AlertTriangle } from 'lucide-react';
import { BankQuestion } from '../types';



export function AdvancedPdfBatchImport({ 
  onQuestionsExtracted, 
  existingQuestions,
  availableTags
}: { 
  onQuestionsExtracted: (questions: BankQuestion[]) => void,
  existingQuestions: BankQuestion[],
  availableTags: { id: string, name: string, subtags: string[] }[]
}) {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [totalQuestions, setTotalQuestions] = useState<number>(0);
  const [institution, setInstitution] = useState('');
  const [year, setYear] = useState('');
  const [mainTag, setMainTag] = useState('Clínica Médica');
  const [batchSubtags, setBatchSubtags] = useState<string[]>([]);
  const [subtagInput, setSubtagInput] = useState('');
  const [shouldStop, setShouldStop] = useState(false);
  const shouldStopRef = useRef(false);
  
  // Stats
  const [addedCount, setAddedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);

  const normalizeText = (text: string) => text.toLowerCase().replace(/[\s\r\n\t]+/g, ' ').trim();

  const handleProcess = async () => {
    if (!file) return alert('Selecione um arquivo PDF.');
    if (totalQuestions <= 0) return alert('Informe o total de questões do simulado.');

    setIsProcessing(true);
    setShouldStop(false);
    shouldStopRef.current = false;
    setProgress(0);
    setAddedCount(0);
    setSkippedCount(0);
    setStatusText('Fazendo upload do PDF...');

    let fileUri = '';
    let fileName = '';
    let answerKey: Record<string, string> = {};

    try {
      // 1. Upload PDF
      const formData = new FormData();
      formData.append('files', file);
      
      let uploadRes;
      try {
        uploadRes = await apiFetch('/api/upload-context', {
          method: 'POST',
          body: formData
        });
      } catch (e: any) {
        throw new Error(`Erro de rede no upload: ${e.message}`);
      }
      
      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        throw new Error(`Falha no upload do arquivo: ${uploadRes.status} ${text.substring(0, 100)}`);
      }
      
      const uploadData = await uploadRes.json();
      
      if (!uploadData.files || uploadData.files.length === 0) {
        throw new Error('Falha no upload do arquivo: Nenhum arquivo retornado');
      }

      fileUri = uploadData.files[0].uri;
      fileName = uploadData.files[0].name;
      const fileMimeType = uploadData.files[0].mimeType;

      if (shouldStopRef.current) throw new Error('Parado pelo usuário');

      // 2. Extração do Gabarito
      setStatusText('Extraindo gabarito do final do documento...');
      let gabaritoRes;
      try {
        gabaritoRes = await apiFetch('/api/extract-answer-key-from-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileUri, fileMimeType })
        });
      } catch (e: any) {
        throw new Error(`Erro de rede ao extrair gabarito: ${e.message}`);
      }
      
      if (!gabaritoRes.ok) {
        const text = await gabaritoRes.text();
        throw new Error(`Falha ao extrair gabarito: ${gabaritoRes.status} ${text.substring(0, 100)}`);
      }
      
      answerKey = await gabaritoRes.json();
      
      if (Object.keys(answerKey).length === 0) {
         console.warn("Nenhum gabarito estruturado foi encontrado. As respostas corretas poderão ficar vazias.");
      } else {
         console.log("Gabarito extraído:", answerKey);
      }

      // 3. Processamento em Lotes (10 em 10)
      let currentIdx = 1;
      let localAdded = 0;
      let localSkipped = 0;

      while (currentIdx <= totalQuestions) {
        // Break early if user stopped
        if (shouldStopRef.current) break;

        const endIdx = Math.min(currentIdx + 4, totalQuestions);
        setStatusText(`Processando lote de questões ${currentIdx} a ${endIdx}...`);

        // A) Checagem Anti-Duplicados
        // Não temos o texto exato antes de transcrever, mas podemos confiar no "Institution + Year + Index" 
        // ou verificar após transcrever. O prompt pede para verificar ANTES usando 'simulados/{id}/questoes'. 
        // Como o app usa bankQuestions, vamos ter que verificar após a transcrição ou deduzir.
        // O prompt original diz: "Se as questões daquele intervalo já existirem no banco de dados, o script exibe no console... e pula".
        // Uma forma de simular isso é ver se já temos questões suficientes dessa Instituição/Ano.
        // Vamos extrair primeiro, e ao extrair, checamos duplicatas exatas pelo texto ou número se possível.

        setStatusText(`Transcrevendo questões ${currentIdx} a ${endIdx} via IA...`);
        let batchRes;
        try {
          batchRes = await apiFetch('/api/extract-questions-batch-from-file', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ fileUri, fileMimeType, startIdx: currentIdx, endIdx: endIdx })
          });
        } catch (e: any) {
           console.error(`Erro de rede no lote ${currentIdx}-${endIdx}:`, e);
           // Aguardar um pouco e tentar novamente na próxima iteração seria o ideal, mas por hora vamos pular o lote ou encerrar
           throw new Error(`Erro de conexão durante o processamento do lote ${currentIdx}-${endIdx}. A extração foi interrompida.`);
        }

        if (!batchRes.ok) {
           const errText = await batchRes.text();
           console.error(`Erro no lote ${currentIdx}-${endIdx}: ${batchRes.status} ${errText.substring(0, 100)}`);
           currentIdx = endIdx + 1;
           continue;
        }

        let batchData;
        try {
           batchData = await batchRes.json();
        } catch (e: any) {
           console.error(`Falha ao ler JSON do lote ${currentIdx}-${endIdx}:`, e);
           currentIdx = endIdx + 1;
           continue;
        }
        
        const extracted = batchData.questoes || [];

        // Vincular gabarito e checar duplicatas
        const validQuestions: BankQuestion[] = [];
        
        for (const q of extracted) {
           const answer = answerKey[q.numero] || '';
           
           const newQ: BankQuestion = {
              id: Math.random().toString(36).substring(2, 9),
              type: 'multiple_choice',
              text: q.enunciado || '',
              options: q.alternativas || [],
              correctAnswer: answer,
              mainTag: q.area_medica || mainTag,
              subtags: batchSubtags.length > 0 ? batchSubtags : (q.topicos || []), // Usar subtags inseridas manualmente
              institution: q.banca || institution,
              year: q.ano || year,
              hasImageWarning: !!q.descricao_da_imagem,
              createdAt: new Date().toISOString(),
              createdBy: 'API_BATCH'
           };

           // Checar duplicata
           const qNorm = normalizeText(newQ.text);
           const isDuplicate = existingQuestions.some(eq => eq.text && normalizeText(eq.text) === qNorm);

           if (isDuplicate) {
              console.log(`Questão ${q.numero} (Lote ${currentIdx}-${endIdx}) já existe. Pulando...`);
              localSkipped++;
           } else {
              validQuestions.push(newQ);
              localAdded++;
           }
        }

        if (validQuestions.length > 0) {
           onQuestionsExtracted(validQuestions);
        }

        setAddedCount(localAdded);
        setSkippedCount(localSkipped);
        setProgress(Math.round((endIdx / totalQuestions) * 100));

        currentIdx = endIdx + 1;

        if (currentIdx <= totalQuestions && !shouldStopRef.current) {
           setStatusText(`Pausa de 3 segundos para evitar limites da API...`);
           await new Promise(r => setTimeout(r, 3000));
        }
      }

      setStatusText(`Processamento concluído. ${localAdded} novas adicionadas (na fila), ${localSkipped} puladas.`);

    } catch (err: any) {
      console.error(err);
      setStatusText('Erro: ' + err.message);
    } finally {
      // 4. Limpeza
      if (fileName) {
         setStatusText('Limpando arquivo temporário da API...');
         try {
           await apiFetch('/api/delete-file', {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ name: fileName })
           });
         } catch (e) {
           console.error("Falha ao deletar arquivo", e);
         }
      }
      setIsProcessing(false);
      setProgress(100);
      setTimeout(() => setStatusText(''), 5000);
    }
  };

  return (
    <div className="border border-indigo-200 bg-indigo-50/50 rounded-2xl p-5 mt-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
          <UploadCloud className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-slate-900 tracking-tight">Importação Avançada de PDF (Com Imagens)</h3>
          <p className="text-sm text-slate-600 mt-1 mb-4 leading-relaxed">
            Use a IA do Gemini para ler o PDF nativamente. Extrairemos o gabarito automaticamente e transcreveremos as questões em lotes, incluindo as descrições detalhadas de gráficos e tabelas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Arquivo PDF</label>
              <input 
                type="file" 
                accept=".pdf"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total de Questões no PDF</label>
              <input 
                type="number" 
                value={totalQuestions || ''}
                onChange={e => setTotalQuestions(parseInt(e.target.value) || 0)}
                placeholder="Ex: 90"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Instituição (Opcional)</label>
              <input 
                type="text" 
                value={institution}
                onChange={e => setInstitution(e.target.value)}
                placeholder="Ex: USP, SUS-SP..."
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Ano (Opcional)</label>
              <input 
                type="text" 
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="Ex: 2024"
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500"
                disabled={isProcessing}
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Tag Principal</label>
              <select 
                value={mainTag} 
                onChange={e => setMainTag(e.target.value)} 
                className="w-full bg-white border border-slate-200 rounded-lg p-2 text-sm outline-none focus:border-indigo-500"
                disabled={isProcessing}
              >
                {availableTags.map(t => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Subtags (Digite e pressione enter ou vírgula)</label>
              <div className="flex flex-wrap items-center gap-2 bg-white border border-slate-200 rounded-lg p-2">
                {batchSubtags.map(sub => (
                  <span key={sub} className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-1 rounded-md flex items-center gap-1">
                    {sub}
                    <button type="button" onClick={() => setBatchSubtags(batchSubtags.filter(s => s !== sub))} className="hover:text-rose-600 transition">
                      &times;
                    </button>
                  </span>
                ))}
                <input 
                  type="text" 
                  value={subtagInput}
                  onChange={e => setSubtagInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault();
                      const val = subtagInput.trim().replace(/,$/, '').trim();
                      if (val && !batchSubtags.includes(val)) {
                        setBatchSubtags([...batchSubtags, val]);
                        setSubtagInput('');
                      }
                    }
                  }}
                  onBlur={() => {
                      const val = subtagInput.trim().replace(/,$/, '').trim();
                      if (val && !batchSubtags.includes(val)) {
                        setBatchSubtags([...batchSubtags, val]);
                        setSubtagInput('');
                      }
                  }}
                  placeholder="Nova subtag..."
                  className="flex-1 bg-transparent text-sm outline-none min-w-[100px]"
                  disabled={isProcessing}
                  list="batch-subtags-datalist"
                />
                <datalist id="batch-subtags-datalist">
                  {availableTags.find(t => t.name === mainTag)?.subtags.map(sub => (
                    <option key={sub} value={sub} />
                  ))}
                </datalist>
              </div>
            </div>

          </div>

          {isProcessing ? (
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> 
                  {statusText}
                </span>
                <span className="text-sm font-black text-indigo-600">{progress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }}></div>
              </div>
              
              <div className="flex items-center justify-between mt-4 border-t border-slate-100 pt-3">
                <div className="flex gap-4 text-xs font-medium text-slate-500">
                  <span><strong className="text-emerald-600">{addedCount}</strong> na fila</span>
                  <span><strong className="text-slate-400">{skippedCount}</strong> puladas (duplicadas)</span>
                </div>
                <button 
                  onClick={() => {
                    setShouldStop(true);
                    shouldStopRef.current = true;
                  }}
                  className="text-xs bg-rose-50 text-rose-600 hover:bg-rose-100 px-3 py-1.5 rounded font-bold flex items-center gap-1.5 transition"
                >
                  <Square className="w-3 h-3 fill-current" />
                  Parar Extração
                </button>
              </div>
            </div>
          ) : (
            <div>
              <button 
                onClick={handleProcess}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 transition disabled:opacity-50"
                disabled={!file || totalQuestions <= 0}
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Processamento em Lotes
              </button>
              {statusText && (
                <p className="text-sm text-emerald-600 font-bold mt-3 flex items-center gap-1">
                  <Check className="w-4 h-4" /> {statusText}
                </p>
              )}
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
