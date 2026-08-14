const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// import LoginView
content = content.replace(
  "import { Dashboard } from './components/Dashboard';",
  "import { LoginView } from './components/LoginView';\nimport { Dashboard } from './components/Dashboard';"
);

// replace unauthenticated block
const oldLoginBlock = `  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center font-sans">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md"
        >
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-200">
            <Brain className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4 font-sans">Revisarei</h1>
          <p className="text-slate-500 mb-2">
            Transforme seus PDFs em questionários inteligentes e estude com o método Anki de repetição espaçada.
          </p>
          <p className="text-xs text-slate-400 mb-8 font-medium">Nota: O acesso deve ser autorizado por um administrador.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full bg-indigo-600 text-white font-bold py-4 px-6 rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-3 shadow-lg shadow-indigo-100"
          >
            <img src="https://www.google.com/favicon.ico" className="w-5 h-5 invert" alt="Google" />
            Entrar com Google
          </button>
        </motion.div>
      </div>
    );
  }`;

content = content.replace(oldLoginBlock, `  if (!user) {
    return <LoginView />;
  }`);

fs.writeFileSync('src/App.tsx', content);
console.log('App.tsx patched');
