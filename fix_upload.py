import re

with open('src/components/FlashcardCreator.tsx', 'r') as f:
    c = f.read()

replacement = """  const uploadAndGetUrl = async (file: File, subFolder: string): Promise<string> => {
    return new Promise<string>((resolve, reject) => {
      const img = new window.Image();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target?.result) return reject(new Error("Falha ao ler arquivo"));
        
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;
          
          const MAX_SIZE = 800;
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
          
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.7);
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

with open('src/components/FlashcardCreator.tsx', 'w') as f:
    f.write(c)
