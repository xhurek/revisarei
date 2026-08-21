import { supabase } from './supabase';
import { Flashcard } from '../types';

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Carrega todos os flashcards do usuário a partir dos decks no Supabase.
 */
export async function fetchUserFlashcardsFromSupabase(uid: string): Promise<Flashcard[]> {
  try {
    const { data: decks, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', uid);

    if (error) {
      console.warn('Supabase fetch flashcards error:', error);
      return [];
    }

    if (!decks || decks.length === 0) return [];

    const allCards: Flashcard[] = [];
    for (const deck of decks) {
      const deckCards = Array.isArray(deck.cards) ? deck.cards : [];
      for (const card of deckCards) {
        if (!card) continue;
        allCards.push({
          id: card.id || `${deck.id}_${Math.random().toString(36).substring(2, 7)}`,
          question: card.question || '',
          answer: card.answer || '',
          explanation: card.explanation || '',
          tag: card.tag || deck.title || 'Sem tag',
          subtag: card.subtag || (deck.tags && deck.tags[0]) || '',
          subtags: Array.isArray(card.subtags) ? card.subtags : (deck.tags || []),
          nextReview: card.nextReview || card.next_review || new Date().toISOString(),
          interval: typeof card.interval === 'number' ? card.interval : 0,
          easeFactor: typeof card.easeFactor === 'number' ? card.easeFactor : (typeof card.ease_factor === 'number' ? card.ease_factor : 2.5),
          userId: uid,
          createdAt: card.createdAt || card.created_at || deck.created_at || new Date().toISOString()
        });
      }
    }

    allCards.sort((a, b) => new Date(a.nextReview).getTime() - new Date(b.nextReview).getTime());
    return allCards;
  } catch (err) {
    console.warn('Erro ao carregar flashcards do Supabase:', err);
    return [];
  }
}

/**
 * Salva um único flashcard no Supabase agrupado em seu deck correspondente.
 */
export async function saveSingleFlashcardToSupabase(uid: string, card: Flashcard): Promise<void> {
  try {
    const deckName = (card.tag || 'Sem tag').trim();
    const { data: existingDecks } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', uid)
      .eq('title', deckName);

    const targetDeck = existingDecks && existingDecks.length > 0 ? existingDecks[0] : null;
    const deckId = targetDeck ? targetDeck.id : generateUUID();
    const currentCards: Flashcard[] = targetDeck && Array.isArray(targetDeck.cards) ? targetDeck.cards : [];

    const cardWithId: Flashcard = {
      ...card,
      id: card.id || `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: uid,
      createdAt: card.createdAt || new Date().toISOString()
    };

    // Remove if already exists with same id, then add
    const updatedCards = currentCards.filter(c => c.id !== cardWithId.id);
    updatedCards.push(cardWithId);

    const existingTags = targetDeck && Array.isArray(targetDeck.tags) ? targetDeck.tags : [];
    const newTags = Array.from(new Set([...existingTags, ...(card.subtags || (card.subtag ? [card.subtag] : []))]));

    await supabase.from('flashcards').upsert({
      id: deckId,
      user_id: uid,
      title: deckName,
      tags: newTags,
      cards: updatedCards,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Erro ao salvar flashcard individual no Supabase:', err);
  }
}

/**
 * Atualiza o progresso de revisão/SM-2 de um flashcard no Supabase.
 */
export async function updateFlashcardGradeInSupabase(
  uid: string,
  cardId: string,
  interval: number,
  easeFactor: number,
  nextReview: string
): Promise<void> {
  try {
    const { data: decks } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', uid);

    if (!decks || decks.length === 0) return;

    for (const deck of decks) {
      const cards: Flashcard[] = Array.isArray(deck.cards) ? deck.cards : [];
      let found = false;
      const updatedCards = cards.map(c => {
        if (c.id === cardId) {
          found = true;
          return {
            ...c,
            interval,
            easeFactor,
            nextReview
          };
        }
        return c;
      });

      if (found) {
        await supabase.from('flashcards').update({
          cards: updatedCards,
          updated_at: new Date().toISOString()
        }).eq('id', deck.id);
        break;
      }
    }
  } catch (err) {
    console.warn('Erro ao atualizar nota do flashcard no Supabase:', err);
  }
}

/**
 * Atualiza o conteúdo (pergunta, resposta, tag, subtags) de um flashcard no Supabase.
 */
export async function updateFlashcardContentInSupabase(
  uid: string,
  cardId: string,
  updates: Partial<Flashcard>
): Promise<void> {
  try {
    const { data: decks } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', uid);

    if (!decks || decks.length === 0) return;

    let targetCard: Flashcard | null = null;
    let oldDeck: any = null;

    for (const deck of decks) {
      const cards: Flashcard[] = Array.isArray(deck.cards) ? deck.cards : [];
      const found = cards.find(c => c.id === cardId);
      if (found) {
        targetCard = found;
        oldDeck = deck;
        break;
      }
    }

    if (!targetCard || !oldDeck) return;

    const updatedCard: Flashcard = {
      ...targetCard,
      ...updates
    };

    const oldDeckTitle = oldDeck.title || 'Sem tag';
    const newDeckTitle = (updatedCard.tag || 'Sem tag').trim();

    if (oldDeckTitle === newDeckTitle) {
      // Mesma pasta/deck
      const updatedCards = (oldDeck.cards as Flashcard[]).map(c => c.id === cardId ? updatedCard : c);
      await supabase.from('flashcards').update({
        cards: updatedCards,
        updated_at: new Date().toISOString()
      }).eq('id', oldDeck.id);
    } else {
      // Mudou de deck: remove do deck antigo e adiciona no novo deck
      const remainingOldCards = (oldDeck.cards as Flashcard[]).filter(c => c.id !== cardId);
      if (remainingOldCards.length === 0) {
        await supabase.from('flashcards').delete().eq('id', oldDeck.id);
      } else {
        await supabase.from('flashcards').update({
          cards: remainingOldCards,
          updated_at: new Date().toISOString()
        }).eq('id', oldDeck.id);
      }

      await saveSingleFlashcardToSupabase(uid, updatedCard);
    }
  } catch (err) {
    console.warn('Erro ao atualizar conteúdo do flashcard no Supabase:', err);
  }
}

/**
 * Exclui um flashcard individual de seu deck no Supabase.
 */
export async function deleteFlashcardFromSupabase(uid: string, cardId: string): Promise<void> {
  try {
    const { data: decks } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', uid);

    if (!decks || decks.length === 0) return;

    for (const deck of decks) {
      const cards: Flashcard[] = Array.isArray(deck.cards) ? deck.cards : [];
      if (cards.some(c => c.id === cardId)) {
        const remainingCards = cards.filter(c => c.id !== cardId);
        if (remainingCards.length === 0) {
          await supabase.from('flashcards').delete().eq('id', deck.id);
        } else {
          await supabase.from('flashcards').update({
            cards: remainingCards,
            updated_at: new Date().toISOString()
          }).eq('id', deck.id);
        }
        break;
      }
    }
  } catch (err) {
    console.warn('Erro ao excluir flashcard no Supabase:', err);
  }
}

/**
 * Exclui um deck inteiro (e todos os seus flashcards) do Supabase.
 */
export async function deleteDeckFromSupabase(uid: string, deckTag: string): Promise<void> {
  try {
    const cleanTag = deckTag.trim();
    await supabase
      .from('flashcards')
      .delete()
      .eq('user_id', uid)
      .eq('title', cleanTag);
  } catch (err) {
    console.warn('Erro ao excluir deck no Supabase:', err);
  }
}

/**
 * Atualiza o nome, subtags ou status público de um deck no Supabase.
 */
export async function updateDeckInSupabase(
  uid: string,
  oldTag: string,
  newTag: string,
  subtags: string[],
  isPublic?: boolean,
  authorInfo?: { name?: string; photo?: string; title?: string }
): Promise<void> {
  try {
    const cleanOldTag = oldTag.trim();
    const cleanNewTag = newTag.trim();

    const { data: existing } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', uid)
      .eq('title', cleanOldTag);

    if (!existing || existing.length === 0) return;

    for (const deck of existing) {
      const updatedCards = (Array.isArray(deck.cards) ? deck.cards : []).map((c: Flashcard) => ({
        ...c,
        tag: cleanNewTag,
        subtags: subtags,
        subtag: subtags[0] || ''
      }));

      const updatePayload: any = {
        title: cleanNewTag,
        tags: subtags,
        cards: updatedCards,
        updated_at: new Date().toISOString()
      };

      if (typeof isPublic === 'boolean') {
        updatePayload.is_public = isPublic;
      }
      if (authorInfo?.name) updatePayload.author_name = authorInfo.name;
      if (authorInfo?.photo !== undefined) updatePayload.author_photo = authorInfo.photo;
      if (authorInfo?.title) updatePayload.author_title = authorInfo.title;

      await supabase.from('flashcards').update(updatePayload).eq('id', deck.id);
    }
  } catch (err) {
    console.warn('Erro ao atualizar deck no Supabase:', err);
  }
}

/**
 * Busca todos os decks de flashcards públicos disponíveis na comunidade.
 */
export async function fetchPublicFlashcardsFromSupabase(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('flashcards')
      .select('*')
      .eq('is_public', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Erro ao buscar flashcards públicos:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('Erro ao buscar flashcards públicos:', err);
    return [];
  }
}

/**
 * Salva um lote de flashcards (importação Anki, exportação de erros do quiz, etc.) no Supabase.
 */
export async function importFlashcardsBatchToSupabase(uid: string, cards: Flashcard[]): Promise<void> {
  try {
    if (!cards || cards.length === 0) return;

    // Agrupa por deck
    const deckGroups = new Map<string, Flashcard[]>();
    for (const card of cards) {
      const deckName = (card.tag || 'Sem tag').trim();
      const list = deckGroups.get(deckName) || [];
      list.push({
        ...card,
        id: card.id || `fc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId: uid,
        createdAt: card.createdAt || new Date().toISOString()
      });
      deckGroups.set(deckName, list);
    }

    for (const [deckName, newCards] of deckGroups.entries()) {
      const { data: existingDecks } = await supabase
        .from('flashcards')
        .select('*')
        .eq('user_id', uid)
        .eq('title', deckName);

      const targetDeck = existingDecks && existingDecks.length > 0 ? existingDecks[0] : null;
      const deckId = targetDeck ? targetDeck.id : generateUUID();
      const existingCards: Flashcard[] = targetDeck && Array.isArray(targetDeck.cards) ? targetDeck.cards : [];

      const mergedCards = [...existingCards, ...newCards];
      const uniqueCards = Array.from(new Map(mergedCards.map(c => [c.id, c])).values());

      const subtagsSet = new Set<string>(targetDeck?.tags || []);
      newCards.forEach(c => {
        if (c.subtag) subtagsSet.add(c.subtag);
        if (c.subtags && Array.isArray(c.subtags)) c.subtags.forEach(st => subtagsSet.add(st));
      });

      await supabase.from('flashcards').upsert({
        id: deckId,
        user_id: uid,
        title: deckName,
        tags: Array.from(subtagsSet),
        cards: uniqueCards,
        updated_at: new Date().toISOString()
      });
    }
  } catch (err) {
    console.warn('Erro ao importar lote de flashcards no Supabase:', err);
  }
}
