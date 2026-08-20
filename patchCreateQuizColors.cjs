const fs = require('fs');
let code = fs.readFileSync('src/components/CreateQuizModal.tsx', 'utf-8');

const match = /const userRef = doc\(db, 'users', auth\.currentUser\.uid\);\s*await setDoc\(userRef, \{[\s\S]*?\} catch \(colorErr\) \{/m;

const repl = `const { data: supaUser } = await supabase.from('users').select('folder_colors').eq('id', auth.currentUser.uid).single();
          const currentColors = supaUser?.folder_colors || {};
          await supabase.from('users').update({
            folder_colors: { ...currentColors, [finalFolder]: newQuizColor }
          }).eq('id', auth.currentUser.uid);
        } catch (colorErr) {`;

code = code.replace(match, repl);
fs.writeFileSync('src/components/CreateQuizModal.tsx', code);
