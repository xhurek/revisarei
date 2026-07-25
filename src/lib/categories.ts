export const DEFAULT_MAIN_AREAS = [
  'Clínica Médica',
  'Cirurgia Geral',
  'Pediatria',
  'Ginecologia',
  'Obstetrícia',
  'Medicina de Família e Comunidade'
];

export const SUBTAGS_BY_MAIN_AREA: Record<string, string[]> = {
  'Clínica Médica': ['Cardiologia', 'Neurologia', 'Pneumologia', 'Nefrologia', 'Infectologia', 'Endocrinologia', 'Gastroenterologia', 'Hematologia', 'Reumatologia', 'Dermatologia', 'Psiquiatria', 'Geriatria', 'Oncologia'],
  'Cirurgia Geral': ['Urologia', 'Traumatologia', 'Ortopedia', 'Cirurgia Vascular', 'Cirurgia Pediátrica', 'Gastrocirurgia', 'Cirurgia Torácica', 'Oftalmologia', 'Otorrinolaringologia'],
  'Pediatria': ['Neonatologia', 'Puericultura', 'Infectopediatria', 'Cardiopediatria', 'Pneumopediatria'],
  'Ginecologia': ['Ginecologia Geral', 'Climatério', 'Mastologia', 'Uroginecologia', 'Planejamento Familiar'],
  'Obstetrícia': ['Obstetrícia de Alto Risco', 'Pré-natal', 'Parto e Puerpério', 'Medicina Fetal'],
  'Medicina de Família e Comunidade': ['Atenção Primária', 'Epidemiologia', 'Saúde Coletiva', 'Medicina Preventiva', 'Preventiva']
};

export function getMainArea(tag?: string | null): string {
  if (!tag) return 'Outros';
  const cleanTag = tag.trim();
  if (!cleanTag) return 'Outros';

  if (DEFAULT_MAIN_AREAS.includes(cleanTag)) {
    return cleanTag;
  }

  for (const [mainArea, subtags] of Object.entries(SUBTAGS_BY_MAIN_AREA)) {
    if (subtags.some(s => s.toLowerCase() === cleanTag.toLowerCase())) {
      return mainArea;
    }
  }

  const lower = cleanTag.toLowerCase();
  if (lower.includes('clínica') || lower.includes('clinica')) return 'Clínica Médica';
  if (lower.includes('cirurgia')) return 'Cirurgia Geral';
  if (lower.includes('pediatri') || lower.includes('neonato')) return 'Pediatria';
  if (lower.includes('gineco') || lower.includes('masto')) return 'Ginecologia';
  if (lower.includes('obstetr') || lower.includes('pré-natal') || lower.includes('pre-natal') || lower.includes('parto')) return 'Obstetrícia';
  if (lower.includes('família') || lower.includes('familia') || lower.includes('comunidade') || lower.includes('preventiva') || lower.includes('saúde coletiva')) return 'Medicina de Família e Comunidade';

  return cleanTag;
}
