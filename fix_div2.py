import re

with open('src/components/QuizzesView.tsx', 'r') as f:
    qv = f.read()

qv = qv.replace('<div className="pt-2">\n             <AddQuestionsView', '<AddQuestionsView')
qv = qv.replace('submitLabel="Criar Caderno com Estas Questões"\n             />\n          </div>\n        </motion.div>', 'submitLabel="Criar Caderno com Estas Questões"\n             />\n        </motion.div>')

with open('src/components/QuizzesView.tsx', 'w') as f:
    f.write(qv)
