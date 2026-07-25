import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    content = f.read()

# Remove state and history entries
content = re.sub(r'\s*occlusionImageUrl,\s*', '\n    ', content)
content = re.sub(r'\s*occlusionRect,\s*', '\n    ', content)
content = re.sub(r'\s*isDrawingOcclusion,\s*', '\n    ', content)
content = re.sub(r'\s*setOcclusionImageUrl\(prevState\.occlusionImageUrl\);\s*', '', content)
content = re.sub(r'\s*setOcclusionRect\(prevState\.occlusionRect\);\s*', '', content)
content = re.sub(r'\s*setIsDrawingOcclusion\(prevState\.isDrawingOcclusion\);\s*', '', content)
content = re.sub(r'\s*occlusionImageUrl:\s*\'\',\s*', '\n        ', content)
content = re.sub(r'\s*occlusionRect:\s*null,\s*', '\n        ', content)
content = re.sub(r'\s*isDrawingOcclusion:\s*false,\s*', '\n        ', content)

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(content)
