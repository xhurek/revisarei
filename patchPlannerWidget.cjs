const fs = require('fs');
let code = fs.readFileSync('src/components/PlannerWidget.tsx', 'utf-8');

const effectMatch = /useEffect\(\(\) => \{[\s\S]*?return \(\) => unsubscribe\(\);\s*\}, \[selectedDate\]\);/m;
const effectReplacement = `useEffect(() => {
    if (!selectedDate || !auth.currentUser) return;
    setLoading(true);
    const dateStr = formatDateString(selectedDate);
    
    supabase.from('planner')
      .select('tasks')
      .eq('user_id', auth.currentUser.uid)
      .eq('date_str', dateStr)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setTasks(data.tasks || []);
        } else {
          setTasks([]);
        }
        setLoading(false);
      });
  }, [selectedDate]);`;

code = code.replace(effectMatch, effectReplacement);

const saveTaskMatch = /const dayRef = doc\(db, 'users', auth\.currentUser\.uid, 'planner', dateStr\);[\s\S]*?\} catch \(err\) \{\s*console\.error\("Error saving planner task:", err\);\s*\}/m;
const saveTaskReplacement = `try {
      await supabase.from('planner').upsert({
        id: toValidUUID(\`\${auth.currentUser.uid}_\${dateStr}\`),
        user_id: auth.currentUser.uid,
        date_str: dateStr,
        tasks: newTasks
      });
    } catch (err) {
      console.error("Error saving planner task:", err);
    }`;

code = code.replace(saveTaskMatch, saveTaskReplacement);

fs.writeFileSync('src/components/PlannerWidget.tsx', code);
