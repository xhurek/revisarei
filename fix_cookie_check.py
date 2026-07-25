import re

with open('src/lib/firebase.ts', 'r') as f:
    content = f.read()

# Replace the throw new Error in parseJsonResponse
orig = "throw new Error(`Resposta do servidor inválida (${cleanText.substring(0, 100)})`);"
new_err = """if (cleanText.includes('Cookie check')) {
      throw new Error(`O upload falhou devido a restrições do navegador. Por favor, abra o aplicativo em uma nova guia (botão no canto superior direito) para fazer envios de arquivos.`);
    }
    throw new Error(`Resposta do servidor inválida (${cleanText.substring(0, 100)})`);"""

content = content.replace(orig, new_err)

with open('src/lib/firebase.ts', 'w') as f:
    f.write(content)
