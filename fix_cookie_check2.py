import re

with open('src/lib/firebase.ts', 'r') as f:
    content = f.read()

orig = "errorMessage = cleanText ? `Erro ${res.status}: ${cleanText.substring(0, 120)}` : `Erro ${res.status}`;"
new_err = """if (cleanText.includes('Cookie check')) {
        errorMessage = 'Restrição de iFrame: Por favor, abra o app em uma nova guia para fazer o upload.';
      } else {
        errorMessage = cleanText ? `Erro ${res.status}: ${cleanText.substring(0, 120)}` : `Erro ${res.status}`;
      }"""

content = content.replace(orig, new_err)

with open('src/lib/firebase.ts', 'w') as f:
    f.write(content)
