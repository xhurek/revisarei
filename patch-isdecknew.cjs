const fs = require('fs');

let content = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf8');

content = content.replace(
  `  const isDeckNew = (tag: string, deckCards: Flashcard[]) => {
    if (!deckCards || deckCards.length === 0) return false;
    const lastOpened = openedDecks[tag];
    if (!lastOpened) return true;

    const lastOpenedTime = new Date(lastOpened).getTime();
    return deckCards.some(card => {
      if (!card.createdAt) return false;
      return new Date(card.createdAt).getTime() > lastOpenedTime;
    });
  };`,
  `  const isDeckNew = (tag: string, deckCards: Flashcard[]) => {
    if (!deckCards || deckCards.length === 0) return false;
    const lastOpened = openedDecks[tag];
    if (!lastOpened) return true;
    return false; // Nunca mostra "Novo" se já foi aberto, conforme requisitado
  };`
);

fs.writeFileSync('src/components/FlashcardsRoom.tsx', content);
console.log('isDeckNew patched');
