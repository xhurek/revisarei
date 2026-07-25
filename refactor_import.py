import re

with open('src/components/QuestionBankView.tsx', 'r') as f:
    qb = f.read()

# We need to find the definition of parseQuestionsFromText, normalizeText, AddQuestionsView, QuestionEditor
# These start at "function parseQuestionsFromText" and go up to the definition of "export function ManageTagsModal" or end of QuestionEditor.

# Let's find index of "function parseQuestionsFromText"
match1 = re.search(r'function parseQuestionsFromText', qb)
idx_start = match1.start()

# Let's find index of "export function ManageTagsModal"
match2 = re.search(r'export function ManageTagsModal', qb)
idx_end = match2.start()

components_str = qb[idx_start:idx_end]

# Now we need to modify AddQuestionsView to accept `onSave` instead of saving directly to `questionBank`.
# It currently has:
#   const saveToBank = async () => { ... }
# We want to change the props of AddQuestionsView:
# function AddQuestionsView({ onCancel, onSaveBase, availableTags, existingQuestions, submitLabel = "Salvar no Banco", checkDuplicates = true })
# wait, if we change the signature, it's easier to use regex.

new_components_str = components_str.replace(
    'onAdded: () => void,',
    'onSaveBase: (questions: BankQuestion[]) => Promise<void>,\n  submitLabel?: string,\n  checkDuplicates?: boolean,'
)
new_components_str = new_components_str.replace(
    'onAdded,',
    'onSaveBase,\n  submitLabel = "Salvar no Banco",\n  checkDuplicates = true,'
)

save_to_bank_orig = """  const saveToBank = async () => {
    if (staging.length === 0) return;
    if (hasAnyDuplicate) {
      alert('Por favor, remova as questões duplicadas (em vermelho) antes de salvar no banco de questões.');
      return;
    }
    if (hasAnyMissingImage) {
      const numsStr = missingImageNumbers.length > 0 ? ` (#${missingImageNumbers.join(', #')})` : '';
      alert(`Atenção: A(s) questão(ões)${numsStr} possui(em) aviso de imagem pendente. Por favor, anexe a imagem correspondente em cada questão destacada em vermelho (ou remova a questão) antes de salvar.`);
      return;
    }
    setSaving(true);
    try {
      for (const q of staging) {
        const docData = { ...q };
        delete docData.id;
        docData.createdAt = new Date().toISOString();
        docData.createdBy = auth.currentUser?.uid || 'unknown';
        await addDoc(collection(db, 'questionBank'), docData);
      }
      onAdded();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'questionBank');
    } finally {
      setSaving(false);
    }
  };"""

save_to_bank_new = """  const saveToBank = async () => {
    if (staging.length === 0) return;
    if (checkDuplicates && hasAnyDuplicate) {
      alert('Por favor, remova as questões duplicadas (em vermelho) antes de salvar.');
      return;
    }
    if (hasAnyMissingImage) {
      const numsStr = missingImageNumbers.length > 0 ? ` (#${missingImageNumbers.join(', #')})` : '';
      alert(`Atenção: A(s) questão(ões)${numsStr} possui(em) aviso de imagem pendente. Por favor, anexe a imagem correspondente em cada questão destacada em vermelho (ou remova a questão) antes de salvar.`);
      return;
    }
    setSaving(true);
    try {
      await onSaveBase(staging);
    } catch (err: any) {
      alert(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };"""

new_components_str = new_components_str.replace(save_to_bank_orig, save_to_bank_new)
new_components_str = new_components_str.replace('{saving ? \'Salvando...\' : \'Salvar no Banco\'}', '{saving ? \'Salvando...\' : submitLabel}')

# Also we need to disable the duplicate checks if checkDuplicates is false
check_dup_orig = """  const checkDuplicate = (q: BankQuestion) => {
    if (!q.text) return { isDup: false, type: null };
    const qNorm = normalizeText(q.text);
    
    // Check against existing questions in the database
    const inDb = existingQuestions.some(eq => eq.text && normalizeText(eq.text) === qNorm);
    if (inDb) return { isDup: true, type: 'db' };
    
    // Check against other questions in staging with different IDs
    const inStaging = staging.some(sq => sq.id !== q.id && sq.text && normalizeText(sq.text) === qNorm);
    if (inStaging) return { isDup: true, type: 'staging' };
    
    return { isDup: false, type: null };
  };"""

check_dup_new = """  const checkDuplicate = (q: BankQuestion) => {
    if (!checkDuplicates) return { isDup: false, type: null };
    if (!q.text) return { isDup: false, type: null };
    const qNorm = normalizeText(q.text);
    
    // Check against existing questions in the database
    const inDb = existingQuestions.some(eq => eq.text && normalizeText(eq.text) === qNorm);
    if (inDb) return { isDup: true, type: 'db' };
    
    // Check against other questions in staging with different IDs
    const inStaging = staging.some(sq => sq.id !== q.id && sq.text && normalizeText(sq.text) === qNorm);
    if (inStaging) return { isDup: true, type: 'staging' };
    
    return { isDup: false, type: null };
  };"""

new_components_str = new_components_str.replace(check_dup_orig, check_dup_new)

# Add exports
new_components_str = new_components_str.replace('function AddQuestionsView', 'export function AddQuestionsView')
new_components_str = new_components_str.replace('function QuestionEditor', 'export function QuestionEditor')
new_components_str = new_components_str.replace('function parseQuestionsFromText', 'export function parseQuestionsFromText')
new_components_str = new_components_str.replace('function normalizeText', 'export function normalizeText')

imports = """import React, { useState, useEffect, useRef } from 'react';
import { Upload, Plus, AlertTriangle, Save, X, Edit2, Trash2, Tag, Book, Search, ChevronRight, UploadCloud } from 'lucide-react';
import { apiFetch, parseJsonResponse, auth, db } from '../lib/firebase';
import { BankQuestion } from '../types';
import { cn } from '../lib/utils';
import { AdvancedPdfBatchImport } from './AdvancedPdfBatchImport';

"""

with open('src/components/QuestionImportView.tsx', 'w') as f:
    f.write(imports + new_components_str)

# Now remove these from QuestionBankView.tsx
new_qb = qb[:idx_start] + qb[idx_end:]
new_qb = "import { AddQuestionsView } from './QuestionImportView';\n" + new_qb

# Let's fix the onSave logic in QuestionBankView
usage_orig = """        <AddQuestionsView 
          onCancel={() => setIsAdding(false)} 
          onAdded={() => { setIsAdding(false); fetchQuestions(); }} 
          availableTags={availableTags}
          existingQuestions={questions}
        />"""

usage_new = """        <AddQuestionsView 
          onCancel={() => setIsAdding(false)} 
          onSaveBase={async (staging) => {
            for (const q of staging) {
              const docData = { ...q };
              delete docData.id;
              docData.createdAt = new Date().toISOString();
              docData.createdBy = auth.currentUser?.uid || 'unknown';
              await import('firebase/firestore').then(({ addDoc, collection }) => addDoc(collection(db, 'questionBank'), docData));
            }
            setIsAdding(false); 
            fetchQuestions();
          }} 
          availableTags={availableTags}
          existingQuestions={questions}
        />"""

new_qb = new_qb.replace(usage_orig, usage_new)

with open('src/components/QuestionBankView.tsx', 'w') as f:
    f.write(new_qb)

