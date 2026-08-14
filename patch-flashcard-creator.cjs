const fs = require('fs');

let content = fs.readFileSync('src/components/FlashcardCreator.tsx', 'utf8');

content = content.replace(
  "interface FlashcardCreatorProps {",
  "interface FlashcardCreatorProps {\n  editingCard?: Flashcard;"
);

content = content.replace(
  "export function FlashcardCreator({ onClose, onCardSaved, existingDecks }: FlashcardCreatorProps) {",
  "export function FlashcardCreator({ onClose, onCardSaved, existingDecks, editingCard }: FlashcardCreatorProps) {"
);

content = content.replace(
  "const [deck, setDeck] = useState('');",
  "const [deck, setDeck] = useState(editingCard?.tag || '');"
);
content = content.replace(
  "const [subtag, setSubtag] = useState('');",
  "const [subtag, setSubtag] = useState(editingCard?.subtag || '');"
);
content = content.replace(
  "const [front, setFront] = useState('');",
  "const [front, setFront] = useState(editingCard?.question || '');"
);
content = content.replace(
  "const [back, setBack] = useState('');",
  "const [back, setBack] = useState(editingCard?.answer || '');"
);
content = content.replace(
  "const [explanation, setExplanation] = useState('');",
  "const [explanation, setExplanation] = useState(editingCard?.explanation || '');"
);

content = content.replace(
  "import { collection, addDoc } from 'firebase/firestore';",
  "import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';"
);

// update logic in handleSave
const oldSaveLogic = `    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'flashcards'), {
        question: finalQuestion,
        answer: finalAnswer,
        explanation: explanation.trim(),
        tag: finalDeck,
        subtag: subtag.trim(),
        createdAt: new Date().toISOString(),
        images: [...frontImages, ...backImages].map(img => img.url),
        needsReview: true,
        lastReviewed: null
      });`;

const newSaveLogic = `    try {
      if (editingCard?.id) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid, 'flashcards', editingCard.id), {
          question: finalQuestion,
          answer: finalAnswer,
          explanation: explanation.trim(),
          tag: finalDeck,
          subtag: subtag.trim(),
          images: [...frontImages, ...backImages].map(img => img.url)
        });
      } else {
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'flashcards'), {
          question: finalQuestion,
          answer: finalAnswer,
          explanation: explanation.trim(),
          tag: finalDeck,
          subtag: subtag.trim(),
          createdAt: new Date().toISOString(),
          images: [...frontImages, ...backImages].map(img => img.url),
          needsReview: true,
          lastReviewed: null
        });
      }`;

content = content.replace(oldSaveLogic, newSaveLogic);

// If editingCard, close on save, don't reset
const resetLogic = `      // Reset state for the next card, keeping the deck name intact!
      setFront('');
      setBack('');
      setExplanation('');
      setFrontImages([]);
      setBackImages([]);
      setIsOcclusionMode(false);
      
      // Focus back on front input for rapid creation
      setTimeout(() => {
        frontRef.current?.focus();
      }, 50);`;

const newResetLogic = `      if (editingCard) {
        onCardSaved();
        onClose();
        return true;
      }
      
      // Reset state for the next card, keeping the deck name intact!
      setFront('');
      setBack('');
      setExplanation('');
      setFrontImages([]);
      setBackImages([]);
      setIsOcclusionMode(false);
      
      // Focus back on front input for rapid creation
      setTimeout(() => {
        frontRef.current?.focus();
      }, 50);`;

content = content.replace(resetLogic, newResetLogic);

// Change label from "Salvar & Adicionar Outro" to "Salvar Alterações" if editingCard
content = content.replace(
  "{saveStatus === 'saving' ? (",
  "{saveStatus === 'saving' ? ("
); // Just placeholder, let's fix the button text
content = content.replace(
  "Salvar & Adicionar Outro",
  "{editingCard ? 'Salvar Alterações' : 'Salvar & Adicionar Outro'}"
);

// Hide 'Salvar Deck' if editingCard
content = content.replace(
  "<button\n              onClick={handleFinalizeDeck}\n              disabled={saveStatus === 'saving' || isUploading}\n              className=\"flex-1 bg-green-500 text-white font-extrabold py-3.5 px-6 rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-500/15 flex items-center justify-center gap-2 text-sm\"\n            >\n              <Check className=\"w-4 h-4\" />\n              Salvar Deck\n            </button>",
  "{!editingCard && (\n            <button\n              onClick={handleFinalizeDeck}\n              disabled={saveStatus === 'saving' || isUploading}\n              className=\"flex-1 bg-green-500 text-white font-extrabold py-3.5 px-6 rounded-xl hover:bg-green-600 transition shadow-lg shadow-green-500/15 flex items-center justify-center gap-2 text-sm\"\n            >\n              <Check className=\"w-4 h-4\" />\n              Salvar Deck\n            </button>\n            )}"
);

fs.writeFileSync('src/components/FlashcardCreator.tsx', content);
console.log('FlashcardCreator patched');
