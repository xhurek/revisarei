const fs = require('fs');

let content = fs.readFileSync('src/components/FlashcardsRoom.tsx', 'utf8');

// The Deck Edit modal has this snippet:
const deckEditButtons = `              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => setDeckEditModal({ ...deckEditModal, isOpen: false })}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processEditDeck}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-600/20 transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>`;

// We will insert the list of cards just above the buttons.
const newDeckEditButtons = `              
              <div className="mt-6 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2"><Layout className="w-4 h-4 text-indigo-500" /> Flashcards neste Caderno</h4>
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                  {allCards.filter(c => (c.tag || 'Sem tag') === deckEditModal.oldTag).map((card, idx) => (
                    <div 
                      key={card.id || idx}
                      onClick={() => {
                         setDeckEditModal({ ...deckEditModal, isOpen: false });
                         setEditingFlashcard(card);
                         setSelectedTag('EDIT_CARD');
                      }}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/50 cursor-pointer transition-colors group flex justify-between items-center"
                    >
                      <div className="flex-1 truncate pr-4">
                        <p className="text-xs font-bold text-slate-800 truncate" title={card.question.replace(/<[^>]+>/g, '')}>{card.question.replace(/<[^>]+>/g, '') || '(Sem frente)'}</p>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5" title={card.answer.replace(/<[^>]+>/g, '')}>{card.answer.replace(/<[^>]+>/g, '')}</p>
                      </div>
                      <div className="shrink-0 p-1.5 bg-white text-indigo-600 rounded-md shadow-sm border border-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Edit3 className="w-3 h-3" />
                      </div>
                    </div>
                  ))}
                  {allCards.filter(c => (c.tag || 'Sem tag') === deckEditModal.oldTag).length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">Nenhum flashcard neste caderno.</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-4">
                <button
                  onClick={() => setDeckEditModal({ ...deckEditModal, isOpen: false })}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={processEditDeck}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold shadow-md shadow-indigo-600/20 transition-colors"
                >
                  Salvar Alterações
                </button>
              </div>
            </motion.div>`;

content = content.replace(deckEditButtons, newDeckEditButtons);

fs.writeFileSync('src/components/FlashcardsRoom.tsx', content);
console.log('Deck Edit modal patched');
