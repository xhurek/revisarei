import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    c = f.read()

c = re.sub(r'^\s*setOcclusionImageUrl.*?\n', '', c, flags=re.MULTILINE)
c = re.sub(r'^\s*setOcclusionRect.*?\n', '', c, flags=re.MULTILINE)
c = re.sub(r'^\s*setIsDrawingOcclusion.*?\n', '', c, flags=re.MULTILINE)

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(c)
