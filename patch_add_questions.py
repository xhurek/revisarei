import re

with open('src/components/QuestionBankView.tsx', 'r') as f:
    qb = f.read()

# Add export to AddQuestionsView
qb = qb.replace('function AddQuestionsView({ \n  onCancel, \n  onAdded, \n  availableTags,\n  existingQuestions\n}: { \n  onCancel: () => void, \n  onAdded: () => void, \n  availableTags: { id: string, name: string, subtags: string[] }[],\n  existingQuestions: BankQuestion[]\n}) {', 
'''export function AddQuestionsView({ 
  onCancel, 
  onAdded, 
  availableTags,
  existingQuestions,
  onSaveToDatabase,
  submitLabel = 'Salvar no Banco'
}: { 
  onCancel: () => void, 
  onAdded: () => void, 
  availableTags: { id: string, name: string, subtags: string[] }[],
  existingQuestions: BankQuestion[],
  onSaveToDatabase?: (staging: BankQuestion[]) => Promise<void>,
  submitLabel?: string
}) {''')

# Now find saveToBank inside AddQuestionsView
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
    if (hasAnyDuplicate) {
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
      if (onSaveToDatabase) {
        await onSaveToDatabase(staging);
        onAdded();
      } else {
        for (const q of staging) {
          const docData = { ...q };
          delete docData.id;
          docData.createdAt = new Date().toISOString();
          docData.createdBy = auth.currentUser?.uid || 'unknown';
          await addDoc(collection(db, 'questionBank'), docData);
        }
        onAdded();
      }
    } catch (err: any) {
      if (!onSaveToDatabase) {
        handleFirestoreError(err, OperationType.CREATE, 'questionBank');
      } else {
        alert(err.message || 'Erro ao salvar');
      }
    } finally {
      setSaving(false);
    }
  };"""

qb = qb.replace(save_to_bank_orig, save_to_bank_new)
qb = qb.replace("{saving ? 'Salvando...' : 'Salvar no Banco'}", "{saving ? 'Salvando...' : submitLabel}")

with open('src/components/QuestionBankView.tsx', 'w') as f:
    f.write(qb)

