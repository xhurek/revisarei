import re

with open('src/components/QuizzesView.tsx', 'r') as f:
    qv = f.read()

# Replace the inner div with just a div with some spacing if needed, but no borders/background
qv = qv.replace('<div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">', '<div className="pt-2">')

with open('src/components/QuizzesView.tsx', 'w') as f:
    f.write(qv)
