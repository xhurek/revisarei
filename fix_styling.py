import re
with open('src/components/QuizzesView.tsx', 'r') as f:
    qv = f.read()

# Replace the motion.div styling
qv = qv.replace(
    'className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm space-y-6"',
    'className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6"'
)
with open('src/components/QuizzesView.tsx', 'w') as f:
    f.write(qv)
