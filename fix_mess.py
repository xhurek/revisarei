import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    c = f.read()

c = c.replace("frontRef.current?.focus();\n      setSaveStatus('idle');", "frontRef.current?.focus();")

c = c.replace("""      // Recalibrate and focus Frente input immediately
      frontRef.current?.focus();""", """      // Recalibrate and focus Frente input immediately
      frontRef.current?.focus();
      setSaveStatus('idle');""")

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(c)

