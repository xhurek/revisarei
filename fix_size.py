import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    c = f.read()

replacement = """  const uploadAndGetUrl = async (file: File, subFolder: string, totalCount: number = 1): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target?.result) return reject(new Error("Falha ao ler arquivo"));
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          let MAX_SIZE = 800;
          let quality = 0.7;
          if (totalCount > 4) {
            MAX_SIZE = 400;
            quality = 0.5;
          } else if (totalCount > 2) {
            MAX_SIZE = 600;
            quality = 0.6;
          }
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round(height * (MAX_SIZE / width));
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round(width * (MAX_SIZE / height));
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target!.result as string);
          
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL('image/webp', quality);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error("Erro ao carregar imagem para compressão"));
        img.src = e.target.result as string;
      };
      
      reader.onerror = () => reject(reader.error || new Error("Erro ao ler arquivo de imagem"));
      reader.readAsDataURL(file);
    });
  };"""

c = re.sub(r'  const uploadAndGetUrl = async \(file: File, subFolder: string\): Promise<string> => \{.*?\n  \};\n', replacement + '\n', c, flags=re.DOTALL)

# Now update the invocations of uploadAndGetUrl
c = c.replace(
    "const urls = await Promise.all(imageFiles.map(file => uploadAndGetUrl(file, 'flashcardMedia')));",
    "const totalCount = frontImages.length + backImages.length + imageFiles.length;\n        const urls = await Promise.all(imageFiles.map(file => uploadAndGetUrl(file, 'flashcardMedia', totalCount)));"
)

c = c.replace(
    "const urls = await Promise.all(fileArray.map(file => uploadAndGetUrl(file, 'flashcardMedia')));",
    "const totalCount = frontImages.length + backImages.length + fileArray.length;\n      const urls = await Promise.all(fileArray.map(file => uploadAndGetUrl(file, 'flashcardMedia', totalCount)));"
)

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(c)
