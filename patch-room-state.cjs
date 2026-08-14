const fs = require('fs');

let content = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf8');

content = content.replace(
  "const [cardEditModal, setCardEditModal] = useState<{",
  "const [editingFlashcard, setEditingFlashcard] = useState<Flashcard | null>(null);\n  const [cardEditModal, setCardEditModal] = useState<{"
);

content = content.replace(
  "if (selectedTag === 'CREATE_CARD') {",
  `if (selectedTag === 'CREATE_CARD' || selectedTag === 'EDIT_CARD') {
    const existingDecks = Array.from(new Set(allCards.map(c => c.tag).filter(Boolean))) as string[];
    return (
      <FlashcardCreator 
        onClose={() => {
          setSelectedTag(null);
          setEditingFlashcard(null);
        }}
        onCardSaved={() => {
          fetchCards(true);
        }}
        existingDecks={existingDecks}
        editingCard={editingFlashcard || undefined}
      />
    );
  }

  if (selectedTag === 'CREATE_CARD') {` // The old block will be removed manually next step
);

fs.writeFileSync('src/components/FlashcardsRoom.tsx', content);
console.log('FlashcardsRoom patched');
