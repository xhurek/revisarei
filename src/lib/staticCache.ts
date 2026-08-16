import { TitleDefinition } from '../types';

export const DEFAULT_TITLES: TitleDefinition[] = [
  { id: 't1', name: 'Calouro', requirement: 0, criteria: 'total_questions', icon: 'User', color: 'bg-slate-50|text-slate-600|border-slate-200' },
  { id: 't2', name: 'Café-com-leite', requirement: 250, criteria: 'total_questions', icon: 'Sparkles', color: 'bg-orange-50|text-orange-600|border-orange-100' },
  { id: 't3', name: 'Aprendiz', requirement: 500, criteria: 'total_questions', icon: 'GraduationCap', color: 'bg-emerald-50|text-emerald-600|border-emerald-100' },
  { id: 't4', name: 'Estudante', requirement: 1000, criteria: 'total_questions', icon: 'Brain', color: 'bg-blue-50|text-blue-600|border-blue-100' },
  { id: 't5', name: 'Interno de Plantão', requirement: 2000, criteria: 'total_questions', icon: 'Stethoscope', color: 'bg-indigo-50|text-indigo-600|border-indigo-100' },
  { id: 't6', name: 'Sabe muito', requirement: 4000, criteria: 'total_questions', icon: 'Flame', color: 'bg-rose-50|text-rose-600|border-rose-100' },
  { id: 't7', name: 'Lenda', requirement: 7000, criteria: 'total_questions', icon: 'Trophy', color: 'bg-amber-50|text-amber-600|border-amber-100' },
  { id: 't8', name: 'Gênio', requirement: 10000, criteria: 'total_questions', icon: 'Zap', color: 'bg-violet-50|text-violet-600|border-violet-100' }
];

export interface BankTagItem {
  id: string;
  name: string;
  subtags: string[];
}

export const DEFAULT_BANK_TAGS: BankTagItem[] = [
  { id: 'tag-1', name: 'Clínica Médica', subtags: ['Cardiologia', 'Neurologia', 'Pneumologia', 'Nefrologia', 'Infectologia', 'Endocrinologia', 'Gastroenterologia', 'Hematologia', 'Reumatologia'] },
  { id: 'tag-2', name: 'Cirurgia Geral', subtags: ['Urologia', 'Traumatologia', 'Cirurgia Vascular', 'Cirurgia Pediátrica', 'Gastrocirurgia', 'Cirurgia Torácica'] },
  { id: 'tag-3', name: 'Pediatria', subtags: ['Neonatologia', 'Puericultura', 'Infectopediatria', 'Cardiopediatria', 'Pneumopediatria'] },
  { id: 'tag-4', name: 'Ginecologia', subtags: ['Ginecologia Geral', 'Climatério', 'Mastologia', 'Uroginecologia', 'Planejamento Familiar'] },
  { id: 'tag-5', name: 'Obstetrícia', subtags: ['Obstetrícia de Alto Risco', 'Pré-natal', 'Parto e Puerpério', 'Medicina Fetal'] },
  { id: 'tag-6', name: 'Medicina de Família e Comunidade', subtags: ['Atenção Primária', 'Epidemiologia', 'Saúde Coletiva', 'Medicina Preventiva'] },
  { id: 'tag-7', name: 'Outros', subtags: [] }
];

const STORAGE_KEYS = {
  BANK_TAGS: 'cached_bank_tags',
  TITLES: 'cached_titles_list',
  QUESTION_BANK: 'cached_questionBank'
};

// Memory cache references
let memoryBankTags: BankTagItem[] | null = null;
let memoryTitles: TitleDefinition[] | null = null;

// ==================== BANK TAGS ====================
export function getCachedBankTags(): BankTagItem[] {
  if (memoryBankTags && memoryBankTags.length > 0) {
    return memoryBankTags;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BANK_TAGS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryBankTags = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached bank tags from localStorage:', e);
  }
  memoryBankTags = DEFAULT_BANK_TAGS;
  return DEFAULT_BANK_TAGS;
}

export function hasCachedBankTags(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.BANK_TAGS);
    return Boolean(raw && JSON.parse(raw)?.length > 0);
  } catch {
    return false;
  }
}

export function setCachedBankTags(tags: BankTagItem[]): void {
  memoryBankTags = tags;
  try {
    localStorage.setItem(STORAGE_KEYS.BANK_TAGS, JSON.stringify(tags));
    window.dispatchEvent(new CustomEvent('bank_tags_updated', { detail: tags }));
  } catch (e) {
    console.warn('Error writing bank tags to localStorage:', e);
  }
}

// ==================== TITLES ====================
export function getCachedTitles(): TitleDefinition[] {
  if (memoryTitles && memoryTitles.length > 0) {
    return memoryTitles;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TITLES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryTitles = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Error reading cached titles from localStorage:', e);
  }
  memoryTitles = DEFAULT_TITLES;
  return DEFAULT_TITLES;
}

export function hasCachedTitles(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TITLES);
    return Boolean(raw && JSON.parse(raw)?.length > 0);
  } catch {
    return false;
  }
}

export function setCachedTitles(titles: TitleDefinition[]): void {
  memoryTitles = titles;
  try {
    localStorage.setItem(STORAGE_KEYS.TITLES, JSON.stringify(titles));
    window.dispatchEvent(new CustomEvent('titles_updated', { detail: titles }));
  } catch (e) {
    console.warn('Error writing titles to localStorage:', e);
  }
}
