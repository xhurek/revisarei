with open('src/components/AdminView.tsx', 'r') as f:
    c = f.read()

c = c.replace("saves_total: 'Total de Salvamentos'", "saves_total: 'Total de Salvamentos',\n  correctAnswers: 'Questões corretas',\n  quizzesCompleted: 'Provas concluídas',\n  studyHours: 'Horas de estudo',\n  daysStreak: 'Dias de ofensiva'")

with open('src/components/AdminView.tsx', 'w') as f:
    f.write(c)
