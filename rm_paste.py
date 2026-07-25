import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    c = f.read()

c = re.sub(r'  // Upload Paste Listener \(Clipboard Image Paste - fallback/occlusion-specific\).*?// Save Card to Firebase Firestore', '// Save Card to Firebase Firestore', c, flags=re.DOTALL)
c = c.replace('onPaste={handlePaste} ', '')

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(c)
