const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

// 1. Change the wrapper grid
content = content.replace(
  '<div className="grid grid-cols-1 xl:grid-cols-3 gap-8 w-full max-w-7xl mx-auto">\n      <div className="xl:col-span-2 space-y-8">',
  '<div className="space-y-6 w-full max-w-7xl mx-auto">'
);

// 2. We need to find the profile div and replace it with the slim one, and open the grid.
const oldProfileDivRegex = /<div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

// Let's use string operations carefully.
// First, find the beginning of profile div:
const profileStart = content.indexOf('<div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-6 sm:gap-8 relative overflow-hidden">');
if (profileStart === -1) { console.error("Could not find profileStart"); process.exit(1); }

// Find the end of profile div by searching for the next grid:
const gridStart = content.indexOf('<div className="grid grid-cols-2 md:grid-cols-4 gap-4">', profileStart);
if (gridStart === -1) { console.error("Could not find gridStart"); process.exit(1); }

const oldProfile = content.slice(profileStart, gridStart);

const newProfile = `
      {/* Slim Profile Div */}
      <div className="bg-white rounded-2xl p-4 sm:px-6 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4 sm:gap-6 relative overflow-hidden">
        <button 
          onClick={() => {
            setEditName(auth.currentUser?.displayName || "");
            setEditPhotoUrl(auth.currentUser?.photoURL || "");
            setSelectedTitle(userData?.title || "");
            setIsEditingProfile(true);
          }}
          className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-50 rounded-full transition-colors"
        >
          <Edit2 className="w-4 h-4" />
        </button>
        
        <div className="relative">
          <div className="w-16 h-16 bg-slate-100 rounded-full border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center">
            {auth.currentUser?.photoURL ? (
              <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-slate-400" />
            )}
          </div>
          {currentTitleDef && (
            <div className={cn("absolute -top-1 -right-1 p-1 rounded-full shadow-sm border", colorParts[0], colorParts[2])}>
                {renderIcon(currentTitleDef.icon, cn("w-3.5 h-3.5", colorParts[1]))}
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between w-full gap-4">
          <div>
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <h2 className="text-lg font-bold text-slate-900">Olá, {auth.currentUser?.displayName?.split(' ')[0] || 'Estudante'}!</h2>
              <span className={cn("inline-flex text-[10px] font-black uppercase px-2 py-0.5 rounded-full border shadow-2xs", colorParts[0], colorParts[1], colorParts[2])}>
                {userData?.title || nextTitleInfo.currentTitle}
              </span>
            </div>
            {auth.currentUser?.email === 'rmourari@ufpi.edu.br' && (
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mt-0.5">Soberano Administrador</p>
            )}
          </div>
          
          <div className="w-full md:w-1/3 space-y-1 mt-2 md:mt-0 mr-4">
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
               <span>Nível: <strong className="text-indigo-600">{nextTitleInfo.currentTitle}</strong></span>
               <span>Próximo: <strong className="text-slate-800">{nextTitleInfo.nextTitle}</strong> ({Math.floor(progressToNext)}%)</span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200 p-px">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: \`\${progressToNext}%\` }}
                 className="h-full bg-indigo-600 rounded-full shadow-xs shadow-indigo-200"
               />
            </div>
            <p className="text-[9px] font-extrabold text-slate-400 text-right uppercase tracking-wider">
               {nextTitleInfo.nextTitle !== 'Nível Máximo' ? \`\${nextTitleInfo.currentVal} / \${nextTitleInfo.req} (\${Math.max(0, nextTitleInfo.req - nextTitleInfo.currentVal)} faltam)\` : 'Máximo!'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 w-full">
        <div className="xl:col-span-2 space-y-6">
`;

content = content.replace(oldProfile, newProfile);

fs.writeFileSync('src/components/Dashboard.tsx', content);
console.log('patched top layout');
