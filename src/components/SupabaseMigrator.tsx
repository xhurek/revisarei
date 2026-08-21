import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { supabase, toValidUUID } from '../lib/supabase';
import { Database, RefreshCcw, CheckCircle, AlertTriangle, Copy, Code, Check } from 'lucide-react';
import { showToast } from '../lib/toast';

export function SupabaseMigrator() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const log = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

  const startMigration = async () => {
    setLoading(true);
    setLogs([]);
    setSuccess(false);

    try {
      // 1. Users
      log('Iniciando migração de Usuários...');
      const usersSnap = await getDocs(collection(db, 'users'));
      const userRawDocs = new Map<string, any>();
      const usersData = usersSnap.docs.map(doc => {
        const data = doc.data();
        userRawDocs.set(doc.id, data);
        return {
          id: doc.id,
          email: data.email || null,
          name: data.name || data.displayName || null,
          photo_url: data.photoURL || data.photo || null,
          xp: data.xp || 0,
          streak_days: data.streak || data.streak_days || 0,
          title: data.title || 'Calouro',
          earned_titles: data.earnedTitles || [],
          questions_answered: data.questionsAnswered || data.questions_answered || 0,
          progression_questions: data.progressionQuestions || data.progression_questions || 0,
          questions_correct: isNaN(data.questionsCorrect) ? 0 : (data.questionsCorrect || data.questions_correct || 0),
          flashcards_reviewed: data.flashcardsReviewed || data.flashcards_reviewed || 0,
          daily_question_count: data.dailyQuestionCount || data.daily_question_count || 0,
          weekly_question_count: data.weeklyQuestionCount || data.weekly_question_count || 0,
          current_week: data.currentWeek || data.current_week || null,
          last_activity_date: data.lastActivityDate || data.last_activity_date || null,
          daily_goals_met: data.dailyGoalsMet || data.daily_goals_met || 0,
          weekly_goals_met: data.weeklyGoalsMet || data.weekly_goals_met || 0,
          responses_total: data.responses_total || 0,
          saves_total: data.saves_total || 0,
          category_stats: data.categoryStats || data.category_stats || {},
          folder_colors: data.folderColors || data.folder_colors || {},
          authorized: data.authorized === true || data.email === 'rmourari@ufpi.edu.br',
          created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
        };
      });

      if (usersData.length > 0) {
        const { error: userErr } = await supabase.from('users').upsert(usersData);
        if (userErr) throw new Error('Erro usuários: ' + userErr.message);
        log(`✓ ${usersData.length} usuários migrados.`);
      }

      // 2. Quizzes
      log('Iniciando migração de Quizzes...');
      const quizzesSnap = await getDocs(collection(db, 'quizzes'));
      const quizzesData = quizzesSnap.docs.map(doc => {
        const data = doc.data();
        return {
          id: toValidUUID(doc.id),
          user_id: data.userId || usersData[0]?.id || 'unknown',
          title: data.title || 'Quiz sem título',
          description: data.description || '',
          discipline: data.discipline || data.mainTag || data.tag || 'Geral',
          theme: data.theme || data.tag || data.mainTag || 'Geral',
          tags: data.tags || data.subtags || [],
          questions: data.questions || [],
          is_public: !!data.isPublic,
          likes_count: Array.isArray(data.likes) ? data.likes.length : 0,
          author_name: data.authorName || 'Anônimo',
          author_photo: data.authorPhoto || '',
          author_title: data.authorTitle || '',
          created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
        };
      });

      if (quizzesData.length > 0) {
        // Deduplicate
        const uniqueQuizzesMap = new Map<string, any>();
        quizzesData.forEach(q => {
          if (uniqueQuizzesMap.has(q.id)) {
            if (q.is_public) uniqueQuizzesMap.set(q.id, q);
          } else {
            uniqueQuizzesMap.set(q.id, q);
          }
        });
        const uniqueQuizzes = Array.from(uniqueQuizzesMap.values());
        
        const { error: qErr } = await supabase.from('quizzes').upsert(uniqueQuizzes);
        if (qErr) throw new Error('Erro quizzes: ' + qErr.message);
        log(`✓ ${uniqueQuizzes.length} quizzes migrados (de ${quizzesData.length} encontrados).`);
      }

      // 3. Flashcards (Group by Deck / Tag per user)
      log('Iniciando migração de Flashcards...');
      const usersList = usersData.map(u => u.id);
      
      let flashcardsCount = 0;
      let decksCount = 0;

      for (const uid of usersList) {
        try {
          const fcSnap = await getDocs(collection(db, `users/${uid}/flashcards`));
          if (!fcSnap.empty) {
            // Group by deck/tag
            const deckMap = new Map<string, any[]>();
            fcSnap.docs.forEach(doc => {
              const data = doc.data();
              const tag = (data.tag || 'Geral').trim();
              if (!deckMap.has(tag)) {
                deckMap.set(tag, []);
              }
              deckMap.get(tag)!.push({
                id: doc.id,
                question: data.question || '',
                answer: data.answer || '',
                explanation: data.explanation || '',
                tag: tag,
                subtag: data.subtag || '',
                subtags: data.subtags || (data.subtag ? [data.subtag] : []),
                nextReview: data.nextReview || new Date().toISOString(),
                interval: typeof data.interval === 'number' ? data.interval : 0,
                easeFactor: typeof data.easeFactor === 'number' ? data.easeFactor : 2.5,
                userId: uid,
                createdAt: data.createdAt || new Date().toISOString()
              });
            });

            for (const [deckTitle, cardsList] of deckMap.entries()) {
              const deckUUID = toValidUUID(`${uid}_deck_${deckTitle}`);
              const allTags = Array.from(new Set(cardsList.flatMap(c => c.subtags || [])));

              const { error: deckErr } = await supabase.from('flashcards').upsert({
                id: deckUUID,
                user_id: uid,
                title: deckTitle,
                tags: allTags,
                cards: cardsList,
                updated_at: new Date().toISOString()
              });

              if (!deckErr) {
                decksCount++;
                flashcardsCount += cardsList.length;
              }
            }
          }
        } catch (e) {
          console.warn(`Erro ao ler flashcards do usuário ${uid}:`, e);
        }
      }
      log(`✓ ${flashcardsCount} flashcards migrados em ${decksCount} baralhos.`);

      // 4. Study Notes (Public & Users)
      log('Iniciando migração de Cadernos de Resumos...');
      const allNotes: any[] = [];

      // A. Public notes
      try {
        const notesSnap = await getDocs(collection(db, 'publicStudyNotes'));
        notesSnap.docs.forEach(doc => {
          const data = doc.data();
          allNotes.push({
            id: toValidUUID(doc.id),
            user_id: data.userId || usersData[0]?.id || 'unknown',
            title: data.title || 'Caderno sem título',
            content: data.content || '',
            summary: data.summary || '',
            tags: data.folder ? [data.folder] : (data.tags || []),
            is_public: true,
            likes_count: Array.isArray(data.likes) ? data.likes.length : 0,
            author_name: data.authorName || 'Anônimo',
            author_photo: data.authorPhoto || '',
            author_title: data.authorTitle || '',
            created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
          });
        });
      } catch (e) {
        console.warn("Erro ao buscar publicStudyNotes:", e);
      }

      // B. Private notes per user
      for (const uid of usersList) {
        try {
          const userNotesSnap = await getDocs(collection(db, `users/${uid}/studyNotes`));
          userNotesSnap.docs.forEach(doc => {
            const data = doc.data();
            allNotes.push({
              id: toValidUUID(doc.id),
              user_id: uid,
              title: data.title || 'Caderno sem título',
              content: data.content || '',
              summary: data.folder || data.summary || 'Geral',
              tags: data.folder ? [data.folder] : (data.tags || []),
              is_public: !!data.isPublic,
              likes_count: Array.isArray(data.likes) ? data.likes.length : 0,
              author_name: data.authorName || 'Estudante',
              author_photo: data.authorPhoto || '',
              author_title: data.authorTitle || '',
              created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
            });
          });
        } catch (e) {
          console.warn(`Erro ao buscar studyNotes do usuário ${uid}:`, e);
        }
      }

      if (allNotes.length > 0) {
        // Remove duplicate IDs to prevent 'ON CONFLICT DO UPDATE command cannot affect row a second time'
        const uniqueNotesMap = new Map<string, any>();
        allNotes.forEach(note => {
           // Se já existe e o atual for público (ou o anterior não for), sobrescrevemos para garantir is_public = true
           if (uniqueNotesMap.has(note.id)) {
             if (note.is_public) {
                uniqueNotesMap.set(note.id, note);
             }
           } else {
             uniqueNotesMap.set(note.id, note);
           }
        });
        
        const uniqueNotes = Array.from(uniqueNotesMap.values());
        
        const { error: nErr } = await supabase.from('study_notes').upsert(uniqueNotes);
        if (nErr) throw new Error('Erro cadernos: ' + nErr.message);
        log(`✓ ${uniqueNotes.length} cadernos de anotações migrados (de ${allNotes.length} encontrados).`);
      }

      // 5. Notifications
      log('Iniciando migração de Notificações...');
      try {
        const notifSnap = await getDocs(collection(db, 'notifications'));
        const notifsData = notifSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: toValidUUID(doc.id),
            user_id: data.userId || usersData[0]?.id || 'unknown',
            title: data.title || 'Notificação',
            message: data.message || '',
            type: data.type || 'system',
            is_read: !!data.read,
            created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
          };
        });

        if (notifsData.length > 0) {
          const { error: notifErr } = await supabase.from('notifications').upsert(notifsData);
          if (!notifErr) {
            log(`✓ ${notifsData.length} notificações migradas.`);
          }
        }
      } catch (e) {
        console.warn("Erro ao migrar notificações:", e);
      }

      // 6. Error Reports
      log('Iniciando migração de Relatórios de Erro...');
      try {
        const repSnap = await getDocs(collection(db, 'error_reports'));
        const reportsData = repSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: toValidUUID(doc.id),
            item_id: toValidUUID(data.page || 'general'),
            item_type: 'error_report',
            reporter_id: data.userId || null,
            reason: `Erro relatado em: ${data.page || 'Geral'}`,
            details: typeof data.message === 'string' ? data.message : JSON.stringify(data),
            status: data.status || 'pending',
            created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
          };
        });

        if (reportsData.length > 0) {
          const { error: repErr } = await supabase.from('reports').upsert(reportsData);
          if (!repErr) {
            log(`✓ ${reportsData.length} relatórios de erro migrados.`);
          }
        }
      } catch (e) {
        console.warn("Erro ao migrar relatórios:", e);
      }

      // 7. Question Bank
      log('Iniciando migração do Banco de Questões...');
      try {
        let qbSnap = await getDocs(collection(db, 'questionBank'));
        if (qbSnap.docs.length === 0) {
          log('0 questões em questionBank. Tentando question_bank...');
          qbSnap = await getDocs(collection(db, 'question_bank'));
        }
        if (qbSnap.docs.length === 0) {
          log('0 questões em question_bank. Tentando questions...');
          qbSnap = await getDocs(collection(db, 'questions'));
        }

        const uniqueQbMap = new Map<string, any>();
        
        qbSnap.docs.forEach(doc => {
          const data = doc.data();
          uniqueQbMap.set(toValidUUID(doc.id), {
            id: toValidUUID(doc.id),
            discipline: data.mainTag || data.discipline || 'Geral',
            main_tag: data.mainTag || data.discipline || 'Geral',
            theme: data.subtag || data.theme || 'Geral',
            subtag: data.subtag || data.theme || 'Geral',
            subtheme: (data.subtags && data.subtags.length > 0) ? data.subtags[0] : (data.subtheme || ''),
            subtags: data.subtags || [],
            institution: data.institution || 'Desconhecida',
            year: data.year ? parseInt(data.year) : new Date().getFullYear(),
            text: data.text || 'Sem texto',
            options: data.options || [],
            correct_answer: data.correctAnswer || '',
            explanation: data.explanation || '',
            tags: data.tags || [],
            image_url: (data.images && data.images.length > 0) ? data.images[0] : (data.imageUrl || null),
            images: data.images || [],
            has_image_warning: !!data.hasImageWarning,
            comments_count: typeof data.commentsCount === 'number' ? data.commentsCount : 0,
            created_by: data.createdBy || usersData[0]?.id || 'unknown',
            created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString()
          });
        });
        
        const qbData = Array.from(uniqueQbMap.values());

        if (qbData.length > 0) {
          // Process in chunks of 100 to avoid too large payload (PostgREST limit)
          const chunkSize = 100;
          let totalMigrated = 0;
          for (let i = 0; i < qbData.length; i += chunkSize) {
            const chunk = qbData.slice(i, i + chunkSize);
            const { error: qbErr } = await supabase.from('question_bank').upsert(chunk);
            if (qbErr) throw qbErr;
            totalMigrated += chunk.length;
            log(`Migrando questões... (${totalMigrated}/${qbData.length})`);
          }
          log(`✓ ${qbData.length} questões do banco migradas com sucesso.`);
        }
      } catch (e: any) {
        log(`ERRO na migração do banco de questões: ${e.message || JSON.stringify(e)}`);
        console.warn("Erro ao migrar banco de questões:", e);
      }

      // 8. Bank Tags
      log('Iniciando migração de Tags/Áreas do Banco (bank_tags)...');
      try {
        const btSnap = await getDocs(collection(db, 'bankTags'));
        const tagsData = btSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: toValidUUID(doc.id),
            name: data.name || '',
            subtags: Array.isArray(data.subtags) ? data.subtags : []
          };
        });

        if (tagsData.length > 0) {
          const { error: btErr } = await supabase.from('bank_tags').upsert(tagsData);
          if (!btErr) {
            log(`✓ ${tagsData.length} áreas/tags do banco migradas com sucesso.`);
          }
        }
      } catch (e) {
        console.warn("Erro ao migrar bankTags:", e);
      }

      // 9. Planner
      log('Iniciando migração de Cronograma/Metas (planner)...');
      try {
        for (const uid of usersList) {
          const plannerSnap = await getDocs(collection(db, `users/${uid}/planner`));
          if (!plannerSnap.empty) {
            const plannerItems = plannerSnap.docs.map(doc => {
              const data = doc.data();
              return {
                id: toValidUUID(`${uid}_${doc.id}`),
                user_id: uid,
                date_str: data.date_str || doc.id,
                tasks: data.tasks || [],
                updated_at: new Date().toISOString()
              };
            });
            await supabase.from('planner').upsert(plannerItems);
            log(`✓ ${plannerItems.length} tarefas de cronograma migradas para o usuário.`);
          }
        }
      } catch (e) {
        console.warn("Erro ao migrar planner:", e);
      }

      // 10. User Stats / Status
      log('Iniciando migração de Estatísticas do Usuário (user_stats)...');
      try {
        let statsCount = 0;
        for (const uid of usersList) {
          const userRaw = userRawDocs.get(uid) || {};
          let mergedData: any = {
            questionsAnswered: userRaw.questionsAnswered || userRaw.questions_answered || 0,
            progressionQuestions: userRaw.progressionQuestions || userRaw.progression_questions || 0,
            questionsCorrect: isNaN(userRaw.questionsCorrect) ? (userRaw.questions_correct || 0) : (userRaw.questionsCorrect || 0),
            flashcardsReviewed: userRaw.flashcardsReviewed || userRaw.flashcards_reviewed || 0,
            dailyQuestionCount: userRaw.dailyQuestionCount || userRaw.daily_question_count || 0,
            weeklyQuestionCount: userRaw.weeklyQuestionCount || userRaw.weekly_question_count || 0,
            currentWeek: userRaw.currentWeek || userRaw.current_week || null,
            lastActivityDate: userRaw.lastActivityDate || userRaw.last_activity_date || null,
            streak: userRaw.streak || userRaw.streak_days || 1,
            dailyGoalsMet: userRaw.dailyGoalsMet || userRaw.daily_goals_met || 0,
            weeklyGoalsMet: userRaw.weeklyGoalsMet || userRaw.weekly_goals_met || 0,
            responses_total: userRaw.responses_total || 0,
            saves_total: userRaw.saves_total || 0,
            categoryStats: userRaw.categoryStats || userRaw.category_stats || {}
          };

          // 10.1 Check subcollections: users/{uid}/status, users/{uid}/stats, users/{uid}/user_stats
          const subcollectionsToCheck = ['status', 'stats', 'user_stats', 'userStats'];
          for (const subCol of subcollectionsToCheck) {
            try {
              const subSnap = await getDocs(collection(db, `users/${uid}/${subCol}`));
              if (!subSnap.empty) {
                for (const subDoc of subSnap.docs) {
                  const d = subDoc.data();
                  if (d) {
                    if ((d.questionsAnswered || d.questions_answered || 0) >= (mergedData.questionsAnswered || 0)) {
                      mergedData.questionsAnswered = d.questionsAnswered || d.questions_answered || mergedData.questionsAnswered;
                    }
                    if ((d.questionsCorrect || d.questions_correct || 0) >= (mergedData.questionsCorrect || 0)) {
                      mergedData.questionsCorrect = isNaN(d.questionsCorrect) ? (d.questions_correct || mergedData.questionsCorrect) : (d.questionsCorrect || d.questions_correct || mergedData.questionsCorrect);
                    }
                    mergedData.progressionQuestions = d.progressionQuestions || d.progression_questions || mergedData.progressionQuestions;
                    mergedData.flashcardsReviewed = Math.max(mergedData.flashcardsReviewed, d.flashcardsReviewed || d.flashcards_reviewed || 0);
                    mergedData.dailyQuestionCount = Math.max(mergedData.dailyQuestionCount, d.dailyQuestionCount || d.daily_question_count || 0);
                    mergedData.weeklyQuestionCount = Math.max(mergedData.weeklyQuestionCount, d.weeklyQuestionCount || d.weekly_question_count || 0);
                    mergedData.currentWeek = d.currentWeek || d.current_week || mergedData.currentWeek;
                    mergedData.lastActivityDate = d.lastActivityDate || d.last_activity_date || mergedData.lastActivityDate;
                    mergedData.streak = d.streak || d.streak_days || mergedData.streak;
                    mergedData.dailyGoalsMet = Math.max(mergedData.dailyGoalsMet, d.dailyGoalsMet || d.daily_goals_met || 0);
                    mergedData.weeklyGoalsMet = Math.max(mergedData.weeklyGoalsMet, d.weeklyGoalsMet || d.weekly_goals_met || 0);
                    mergedData.responses_total = Math.max(mergedData.responses_total, d.responses_total || 0);
                    mergedData.saves_total = Math.max(mergedData.saves_total, d.saves_total || 0);
                    const incomingCatStats = d.categoryStats || d.category_stats;
                    if (incomingCatStats && Object.keys(incomingCatStats).length > 0) {
                      mergedData.categoryStats = { ...mergedData.categoryStats, ...incomingCatStats };
                    }
                  }
                }
              }
            } catch (e) {
              // Ignore subcollection access error
            }
          }

          // 10.2 Fallback: check localStorage for current session if exists
          try {
            const localKey = `revisarei_user_stats_${uid}`;
            const localSaved = localStorage.getItem(localKey);
            if (localSaved) {
              const localData = JSON.parse(localSaved);
              if (localData && (localData.questions_answered || 0) > (mergedData.questionsAnswered || 0)) {
                mergedData.questionsAnswered = localData.questions_answered;
                mergedData.questionsCorrect = localData.questions_correct || mergedData.questionsCorrect;
                mergedData.progressionQuestions = localData.progression_questions || mergedData.progressionQuestions;
                mergedData.flashcardsReviewed = localData.flashcards_reviewed || mergedData.flashcardsReviewed;
                mergedData.dailyQuestionCount = localData.daily_question_count || mergedData.dailyQuestionCount;
                mergedData.weeklyQuestionCount = localData.weekly_question_count || mergedData.weeklyQuestionCount;
                mergedData.streak = localData.streak || mergedData.streak;
                mergedData.categoryStats = localData.category_stats || mergedData.categoryStats;
              }
            }
          } catch (e) {
            // Ignore localStorage parse error
          }

          const statsPayload = {
            user_id: uid,
            questions_answered: mergedData.questionsAnswered || 0,
            progression_questions: mergedData.progressionQuestions || 0,
            questions_correct: isNaN(mergedData.questionsCorrect) ? 0 : (mergedData.questionsCorrect || 0),
            flashcards_reviewed: mergedData.flashcardsReviewed || 0,
            daily_question_count: mergedData.dailyQuestionCount || 0,
            weekly_question_count: mergedData.weeklyQuestionCount || 0,
            current_week: mergedData.currentWeek || null,
            last_activity_date: mergedData.lastActivityDate || null,
            streak: mergedData.streak || 1,
            daily_goals_met: mergedData.dailyGoalsMet || 0,
            weekly_goals_met: mergedData.weeklyGoalsMet || 0,
            responses_total: mergedData.responses_total || 0,
            saves_total: mergedData.saves_total || 0,
            category_stats: mergedData.categoryStats || {},
            updated_at: new Date().toISOString()
          };

          const userName = userRaw.name || userRaw.displayName || userRaw.email || uid;

          // Upsert into user_stats table
          const { error: statsErr } = await supabase.from('user_stats').upsert(statsPayload);
          if (statsErr) {
            log(`⚠️ Erro ao inserir na tabela user_stats (${userName}): ${statsErr.message}`);
          } else {
            statsCount++;
            log(`✓ [user_stats] ${statsPayload.questions_answered} questões e ${Object.keys(statsPayload.category_stats).length} categorias salvas para ${userName}.`);
          }

          // Also update users table directly
          const { error: usersUpdateErr } = await supabase.from('users').update({
            questions_answered: statsPayload.questions_answered,
            progression_questions: statsPayload.progression_questions,
            questions_correct: statsPayload.questions_correct,
            flashcards_reviewed: statsPayload.flashcards_reviewed,
            daily_question_count: statsPayload.daily_question_count,
            weekly_question_count: statsPayload.weekly_question_count,
            current_week: statsPayload.current_week,
            last_activity_date: statsPayload.last_activity_date,
            streak_days: statsPayload.streak,
            daily_goals_met: statsPayload.daily_goals_met,
            weekly_goals_met: statsPayload.weekly_goals_met,
            responses_total: statsPayload.responses_total,
            saves_total: statsPayload.saves_total,
            category_stats: statsPayload.category_stats,
            updated_at: new Date().toISOString()
          }).eq('id', uid);

          if (usersUpdateErr) {
            log(`⚠️ Erro ao atualizar colunas na tabela users (${userName}): ${usersUpdateErr.message}`);
          }
        }

        if (statsCount > 0) {
          log(`✓ ${statsCount} registros de estatísticas (user_stats) concluídos com sucesso.`);
        }
      } catch (e: any) {
        log(`⚠️ Exceção ao migrar user_stats: ${e?.message || e}`);
      }

      setSuccess(true);
      log('🚀 MIGRAÇÃO COMPLETA (TODAS AS TABELAS) CONCLUÍDA COM SUCESSO!');
      
    } catch (err: any) {
      log('ERRO: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const [copiedSql, setCopiedSql] = useState(false);
  const [showSql, setShowSql] = useState(false);

  const sqlScript = `-- 1. Adicionar colunas de estatísticas e personalização na tabela USERS
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS authorized BOOLEAN DEFAULT FALSE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS questions_answered INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS progression_questions INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS questions_correct INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS flashcards_reviewed INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_question_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_question_count INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS current_week DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_activity_date DATE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS daily_goals_met INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS weekly_goals_met INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS responses_total INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS saves_total INTEGER DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS category_stats JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS folder_colors JSONB DEFAULT '{}'::jsonb;

-- 2. Criar tabela de Cronograma e Metas (PLANNER)
CREATE TABLE IF NOT EXISTS public.planner (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.users(id) ON DELETE CASCADE,
  date_str TEXT NOT NULL,
  tasks JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Criar tabela de Estatísticas (USER_STATS)
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id TEXT PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  questions_answered INTEGER DEFAULT 0,
  progression_questions INTEGER DEFAULT 0,
  questions_correct INTEGER DEFAULT 0,
  flashcards_reviewed INTEGER DEFAULT 0,
  daily_question_count INTEGER DEFAULT 0,
  weekly_question_count INTEGER DEFAULT 0,
  current_week DATE,
  last_activity_date DATE,
  streak INTEGER DEFAULT 0,
  daily_goals_met INTEGER DEFAULT 0,
  weekly_goals_met INTEGER DEFAULT 0,
  responses_total INTEGER DEFAULT 0,
  saves_total INTEGER DEFAULT 0,
  category_stats JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Habilitar Row Level Security (RLS) e Políticas
ALTER TABLE public.planner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'planner' AND policyname = 'Allow all operations for now') THEN
    CREATE POLICY "Allow all operations for now" ON public.planner FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_stats' AND policyname = 'Allow all operations for now') THEN
    CREATE POLICY "Allow all operations for now" ON public.user_stats FOR ALL USING (true);
  END IF;
END $$;`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    showToast('Script SQL copiado com sucesso!', 'Cole e execute no SQL Editor do Supabase.');
    setTimeout(() => setCopiedSql(false), 3000);
  };

  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-indigo-600">
          <Database className="w-6 h-6" />
          <h3 className="text-lg font-bold">Ferramenta de Migração (Supabase)</h3>
        </div>
        <button
          onClick={() => setShowSql(!showSql)}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition"
        >
          <Code className="w-3.5 h-3.5" />
          {showSql ? 'Ocultar Script SQL' : 'Ver / Copiar Script SQL do Banco'}
        </button>
      </div>

      {showSql && (
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-700">
              Execute este comando no <strong>SQL Editor</strong> do Supabase para criar as colunas de stats e tabela planner:
            </p>
            <button
              onClick={copySql}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
            >
              {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copiedSql ? 'Copiado!' : 'Copiar SQL'}
            </button>
          </div>
          <pre className="text-[11px] font-mono bg-slate-900 text-slate-200 p-3.5 rounded-xl overflow-x-auto max-h-56 leading-relaxed">
            {sqlScript}
          </pre>
        </div>
      )}

      <p className="text-sm text-slate-500">
        Transfira todos os dados do Firebase Firestore para o PostgreSQL (Supabase) configurado.
      </p>
      
      <button 
        onClick={startMigration} 
        disabled={loading}
        className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition disabled:opacity-50"
      >
        {loading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
        {loading ? 'Migrando...' : 'Iniciar Migração de Dados'}
      </button>

      {logs.length > 0 && (
        <div className="bg-slate-900 text-green-400 p-4 rounded-xl text-xs font-mono max-h-60 overflow-y-auto space-y-1">
          {logs.map((l, i) => (
            <div key={i}>{l}</div>
          ))}
        </div>
      )}
    </div>
  );
}

