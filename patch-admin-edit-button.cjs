const fs = require('fs');
let content = fs.readFileSync('src/components/AdminView.tsx', 'utf8');

const targetStr = '<button onClick={() => handleDeleteTitleDef(title.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors">\n                        <Trash2 className="w-5 h-5" />\n                      </button>';
const replacementStr = `
  <div className="flex items-center gap-1">
    <button onClick={() => handleEditTitleDef(title)} className="p-2 text-slate-300 hover:text-amber-500 transition-colors" title="Editar">
      <Edit3 className="w-5 h-5" />
    </button>
    <button onClick={() => handleDeleteTitleDef(title.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Excluir">
      <Trash2 className="w-5 h-5" />
    </button>
  </div>
`;

content = content.replace(targetStr, replacementStr);

fs.writeFileSync('src/components/AdminView.tsx', content);
console.log('patched edit button');
