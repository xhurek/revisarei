const fs = require('fs');
let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

// handleRestoreDefaults
content = content.replace(
  "if (!confirm('Atenção: Isso excluirá todas as conquistas atuais e restaurará os padrões do sistema (Calouro, Café-com-leite, etc). Deseja continuar?')) return;",
  "// removed confirm"
);
content = content.replace(
  "alert('Conquistas restauradas com sucesso!');",
  "// removed alert"
);
content = content.replace(
  "alert('Erro ao restaurar');",
  "// removed alert"
);

// handleDeleteTitleDef
content = content.replace(
  "if (!confirm('Excluir esta conquista?')) return;",
  "// removed confirm"
);

// handleAddTitleDef
content = content.replace(
  "alert('Conquista atualizada com sucesso!');",
  "// removed alert"
);
content = content.replace(
  "alert('Conquista criada com sucesso!');",
  "// removed alert"
);

// handleDeleteUser
content = content.replace(
  "if (!confirm('Tem certeza que deseja remover este usuário?')) return;",
  "// removed confirm"
);

// handleUpdateTitle
content = content.replace(
  "alert('Título atualizado!');",
  "// removed alert"
);
content = content.replace(
  "alert('Erro ao atualizar título.');",
  "// removed alert"
);

fs.writeFileSync('src/components/AdminView.tsx', content);
console.log('removed alerts and confirms');
