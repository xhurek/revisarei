const fs = require('fs');

let content = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf8');

// The replacement created a duplicate block. Let's fix it by replacing the whole thing.
content = content.replace(
  `  if (selectedTag === 'CREATE_CARD') {
    const existingDecks = Array.from(new Set(allCards.map(c => c.tag).filter(Boolean))) as string[];
    return (
      <FlashcardCreator 
        onClose={() => setSelectedTag(null)}
        onCardSaved={() => {
          fetchCards(true);
        }}
        existingDecks={existingDecks}
      />
    );
  }`,
  "" // Remove the duplicate
);

fs.writeFileSync('src/components/FlashcardsRoom.tsx', content);
console.log('Dupe fixed');
