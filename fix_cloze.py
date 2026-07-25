import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    c = f.read()

c = c.replace("""        // Restore cursor/focus
          textarea.focus();
          textarea.setSelectionRange(start, start + selected.length + 8);
        }, 50);""", """        // Restore cursor/focus
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start + selected.length + 8);
        }, 50);""")

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(c)
