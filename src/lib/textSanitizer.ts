// Utility to fix PDF extraction artifacts like ligatures replaced by '+', OCR errors where 'V' replaced 'FL'/'FI', isolated accents, header clutter, and embedded options.

export function fixPdfLigatures(text: string): string {
  if (!text) return text;

  let cleaned = text;

  // 1. Convert explicit Unicode ligatures
  cleaned = cleaned
    .replace(/\uFB01/g, 'fi')
    .replace(/\uFB02/g, 'fl')
    .replace(/\uFB00/g, 'ff')
    .replace(/\uFB03/g, 'ffi')
    .replace(/\uFB04/g, 'ffl');

  // 2. Remove spaces between letters and combining or spacing diacritics
  // e.g., "c ̧" -> "c\u0327", "a ̃" -> "a\u0303", "mama ́ rio" -> "mamá\u0301rio"
  cleaned = cleaned.replace(/([a-zA-Zà-úÀ-Ú\+])\s+([\u0300-\u036f\u00b4\u00b8\u02dc\u02c6])/g, '$1$2');
  cleaned = cleaned.replace(/([\u0300-\u036f\u00b4\u00b8\u02dc\u02c6])\s+([a-zA-Zà-úÀ-Ú])/g, '$1$2');

  // 3. Normalize Unicode (NFC) to fuse combining accents with preceding characters
  cleaned = cleaned.normalize('NFC');

  // 4. Fix specific isolated accent + letter patterns (spacing accents)
  // Cedilla: c ̧ or c¸ or c \u0327
  cleaned = cleaned.replace(/c\s*[̧¸\u0327]/gi, (m) => m[0] === 'C' ? 'Ç' : 'ç');
  // Tilde: a ̃ or a˜, o ̃ or o˜
  cleaned = cleaned.replace(/a\s*[̃˜\u0303]/gi, (m) => m[0] === 'A' ? 'Ã' : 'ã');
  cleaned = cleaned.replace(/o\s*[̃˜\u0303]/gi, (m) => m[0] === 'O' ? 'Õ' : 'õ');
  // Acute: a ́, e ́, i ́, o ́, u ́
  cleaned = cleaned.replace(/a\s*[́´\u0301]/gi, (m) => m[0] === 'A' ? 'Á' : 'á');
  cleaned = cleaned.replace(/e\s*[́´\u0301]/gi, (m) => m[0] === 'E' ? 'É' : 'é');
  cleaned = cleaned.replace(/i\s*[́´\u0301]/gi, (m) => m[0] === 'I' ? 'Í' : 'í');
  cleaned = cleaned.replace(/o\s*[́´\u0301]/gi, (m) => m[0] === 'O' ? 'Ó' : 'ó');
  cleaned = cleaned.replace(/u\s*[́´\u0301]/gi, (m) => m[0] === 'U' ? 'Ú' : 'ú');
  // Circumflex: a ̂, e ̂, o ̂
  cleaned = cleaned.replace(/a\s*[̂ˆ\u0302]/gi, (m) => m[0] === 'A' ? 'Â' : 'â');
  cleaned = cleaned.replace(/e\s*[̂ˆ\u0302]/gi, (m) => m[0] === 'E' ? 'Ê' : 'ê');
  cleaned = cleaned.replace(/o\s*[̂ˆ\u0302]/gi, (m) => m[0] === 'O' ? 'Ô' : 'ô');

  // 5. Handle '+' preceding acute accent or 'sico'/'sica' (e.g. "+ ́ sico", "+sico", "+sica")
  cleaned = cleaned.replace(/\+\s*[́´\u0301]\s*/g, 'fí');
  cleaned = cleaned.replace(/\+\s*([sS]ic[oa])/g, 'fí$1');

  // 6. Fix specific 'fl' patterns where '+' substituted 'fl' in Portuguese medical terminology
  const flPlusPatterns: [RegExp, string][] = [
    [/(\b|in)\+am/gi, '$1flam'],       // inflama, inflamatório, inflamação
    [/re\+ux/gi, 'reflux'],            // refluxo, refluxos
    [/\+uxo/gi, 'fluxo'],              // fluxo
    [/\+uíd/gi, 'fluíd'],              // fluído, fluídos
    [/\+uên/gi, 'fluên'],              // influência, efluente
    [/a\+uên/gi, 'afluên'],            // afluência
    [/a\+ux/gi, 'aflux'],              // afluxo
    [/pro\+lax/gi, 'profilax'],        // profilaxia, profilático
    [/\+utu/gi, 'flutu'],              // flutuação
    [/\+ore/gi, 'flore'],              // florescer
    [/\+or\b/gi, 'flor'],              // flor
  ];

  for (const [regex, replacement] of flPlusPatterns) {
    cleaned = cleaned.replace(regex, replacement);
  }

  // 7. Fix OCR errors where 'V' or 'v' replaced 'FL' or 'FI'
  // 7.1. Invam -> Inflam (e.g. invamação -> inflamação, INVAMAÇÃO -> INFLAMAÇÃO)
  cleaned = cleaned.replace(/\b(in)v(am[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === m[0].toUpperCase() && m[1] === m[1].toLowerCase();
    if (isUpper) return `${p1.toUpperCase()}FL${p2.toUpperCase()}`;
    if (isTitle) return `Infl${p2.toLowerCase()}`;
    return `${p1.toLowerCase()}fl${p2.toLowerCase()}`;
  });

  // 7.2. Vutu -> Flutu (vutuação -> flutuação, VUTUAÇÃO -> FLUTUAÇÃO)
  cleaned = cleaned.replace(/\bv(utu[a-zà-ú]*)/gi, (m, p1) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === 'V';
    if (isUpper) return `FL${p1.toUpperCase()}`;
    if (isTitle) return `Fl${p1.toLowerCase()}`;
    return `fl${p1.toLowerCase()}`;
  });

  // 7.3. Revux -> Reflux (revuxo -> refluxo, REVUXO -> REFLUXO)
  cleaned = cleaned.replace(/\b(re)v(ux[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === 'R';
    if (isUpper) return `REFL${p2.toUpperCase()}`;
    if (isTitle) return `Refl${p2.toLowerCase()}`;
    return `refl${p2.toLowerCase()}`;
  });

  // 7.4. Vuxo -> Fluxo
  cleaned = cleaned.replace(/\bv(ux[oas]*)/gi, (m, p1) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === 'V';
    if (isUpper) return `FL${p1.toUpperCase()}`;
    if (isTitle) return `Fl${p1.toLowerCase()}`;
    return `fl${p1.toLowerCase()}`;
  });

  // 7.5. Vuíd / Vuid -> Fluíd / Fluid
  cleaned = cleaned.replace(/\bv(u[íi]d[a-zà-ú]*)/gi, (m, p1) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === 'V';
    if (isUpper) return `FL${p1.toUpperCase()}`;
    if (isTitle) return `Fl${p1.toLowerCase()}`;
    return `fl${p1.toLowerCase()}`;
  });

  // 7.6. Provilax -> Profilax
  cleaned = cleaned.replace(/\b(pro)v(ilax[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `PROFILAX${p2.substring(4).toUpperCase()}`;
    return `${p1}filax${p2.substring(4)}`;
  });

  // 7.7. Avuên -> Afluên, Invuên -> Influên, Evuên -> Efluên
  cleaned = cleaned.replace(/\b(a|in|e)v(uên[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `${p1.toUpperCase()}FL${p2.toUpperCase()}`;
    return `${p1}fl${p2}`;
  });

  // 7.8. Insuviciên -> Insuficiên
  cleaned = cleaned.replace(/\b(insu)v(iciê[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `INSUF${p2.toUpperCase()}`;
    return `${p1}f${p2}`;
  });

  // 7.9. Diviculd -> Dificuld
  cleaned = cleaned.replace(/\b(di)v(iculd[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `DIF${p2.toUpperCase()}`;
    return `${p1}f${p2}`;
  });

  // 7.10. Evicác / Evicac -> Eficác / Eficac
  cleaned = cleaned.replace(/\b(e)v(icá[a-zà-ú]*|icac[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `EF${p2.toUpperCase()}`;
    return `${p1}f${p2}`;
  });

  // 7.11. Signivicat -> Significat
  cleaned = cleaned.replace(/\b(signi)v(icat[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `SIGNIF${p2.toUpperCase()}`;
    return `${p1}f${p2}`;
  });

  // 7.12. Visiolog -> Fisiolog
  cleaned = cleaned.replace(/\bv(isiolog[a-zà-ú]*)/gi, (m, p1) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === 'V';
    if (isUpper) return `F${p1.toUpperCase()}`;
    if (isTitle) return `F${p1}`;
    return `f${p1}`;
  });

  // 7.13. Vísic / Visic -> Físic / Fisic
  cleaned = cleaned.replace(/\bv([íi]sic[oa][s]?)/gi, (m, p1) => {
    const isUpper = m === m.toUpperCase();
    const isTitle = m[0] === 'V';
    if (isUpper) return `F${p1.toUpperCase()}`;
    if (isTitle) return `F${p1}`;
    return `f${p1}`;
  });

  // 7.14. Mamogravia -> Mamografia
  cleaned = cleaned.replace(/\b(mamo)g?ra?v(ia[s]?)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `MAMOGRAFIA`;
    return `mamografia`;
  });

  // 7.15. Grávica -> Gráfica, Grávico -> Gráfico, Ultrassonográvica -> Ultrassonográfica, Radiográvica -> Radiográfica
  cleaned = cleaned.replace(/\b([a-zà-ú]*grá)v(ic[oa][s]?)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `${p1.toUpperCase()}F${p2.toUpperCase()}`;
    return `${p1}f${p2}`;
  });

  // 7.16. Inviltr -> Infiltr
  cleaned = cleaned.replace(/\b(in)v(iltr[a-zà-ú]*)/gi, (m, p1, p2) => {
    const isUpper = m === m.toUpperCase();
    if (isUpper) return `INFILTR${p2.substring(4).toUpperCase()}`;
    return `${p1}filtr${p2.substring(4)}`;
  });

  // 8. Any '+' directly surrounded by letters or followed by a letter
  // Inside a word: letter + '+' + letter -> letter + 'fi' + letter (e.g. ultrassonográ+ca, mamogra+a)
  cleaned = cleaned.replace(/([a-zA-Zà-úÀ-Ú])\+([a-zA-Zà-úÀ-Ú])/g, '$1fi$2');

  // Word-initial '+' attached to or preceding a letter: '+' + letter -> 'fi' + letter (e.g. +siologia, +lho, +gura)
  cleaned = cleaned.replace(/(^|\s)\+\s*([a-zA-Zà-úÀ-Ú])/g, '$1fi$2');

  // Clean any remaining double spaces created by accent merge
  cleaned = cleaned.replace(/[ \t]{2,}/g, ' ');

  return cleaned;
}

// Clean leading headers, years, institution names, "Questão 12." clutter from start of question statement
export function hasImageReferenceKeywords(text: string): boolean {
  if (!text) return false;
  // Exclude false positives from gabarito references
  const clean = text.replace(/tabela\s+de\s+gabarito|lista\s+de\s+gabarito|gabarito\s+a\s+seguir|gabarito\s+abaixo/gi, '');
  const regex = /\b(a seguir|seguinte|seguintes|abaixo|figura|figuras|imagem|imagens|esquema|esquemas|gr[áa]fico|grafico|gr[áa]ficos|graficos|tabela|tabelas|quadro|quadros|ecg|eletrocardiograma|radiografia|raio\-?x|tomografia|resson[âa]ncia|ultrassom|ultrassonografia|fotografia|foto|exame abaixo|mostrad[oa] abaixo|conforme [ao] [a-z]+)\b/i;
  return regex.test(clean);
}

// Clean leading headers, years, institution names, "Questão 12." clutter from start of question statement
export function cleanEnunciadoHeader(text: string): { cleanedText: string; extractedYear?: string; extractedBanca?: string } {
  if (!text) return { cleanedText: text };

  let trimmed = text.trim();
  let extractedYear: string | undefined;
  let extractedBanca: string | undefined;

  // 1. Extract leading Year (e.g. "2024 - ", "2023. ", "(2022) - ")
  const yearMatch = trimmed.match(/^(?:\(?\s*(19\d\d|20\d\d)\s*\)?)\s*[\.\-\–\—\:\/]?\s*/);
  if (yearMatch) {
    extractedYear = yearMatch[1];
    trimmed = trimmed.substring(yearMatch[0].length).trim();
  } else {
    const parenYearMatch = trimmed.match(/^\(\s*([^)]*?\b(19\d\d|20\d\d)\b[^)]*?)\)\s*[\.\-\–\—\:\/]?\s*/);
    if (parenYearMatch) {
      extractedYear = parenYearMatch[2];
      const bancaCandidate = parenYearMatch[1].replace(parenYearMatch[2], '').replace(/[\/\-\,\s]+/, ' ').trim();
      if (bancaCandidate && bancaCandidate.length < 30) {
        extractedBanca = bancaCandidate;
      }
      trimmed = trimmed.substring(parenYearMatch[0].length).trim();
    }
  }

  // 2. Extract leading Banca / Institution e.g. "USP - ", "HSPE / SP - ", "ENARE - "
  const bancaMatch = trimmed.match(/^([A-Z0-9\/\-\s\.]{2,25})\s*[\.\-\–\—\:\/]\s*(?=[A-ZÀ-Ú0-9\(\"\'Questão])/i);
  if (bancaMatch) {
    const candidate = bancaMatch[1].trim();
    const commonStartWords = ['SE', 'NO', 'EM', 'AO', 'UM', 'UMA', 'SOBRE', 'PARA', 'COM', 'APÓS', 'QUAL', 'CONSIDERE', 'SOBRE'];
    if (!commonStartWords.includes(candidate.toUpperCase())) {
      if (!extractedBanca && candidate.length > 1) {
        extractedBanca = candidate;
      }
      trimmed = trimmed.substring(bancaMatch[0].length).trim();
    }
  }

  // 3. Remove leading "Questão 12 - " or "QUESTÃO 05:" or "Q. 12"
  const qNumMatch = trimmed.match(/^(?:Quest[ãa]o|QUEST[ÃA]O|Q\.|q\.)\s*\d+\s*[\.\-\–\—\:\)]\s*/i);
  if (qNumMatch) {
    trimmed = trimmed.substring(qNumMatch[0].length).trim();
  }

  // 4. Remove leading standalone number prefix "12. " or "01 - " if followed by uppercase
  const numPrefixMatch = trimmed.match(/^\d{1,3}\s*[\.\-\–\—\:]\s*(?=[A-ZÀ-Ú])/);
  if (numPrefixMatch) {
    trimmed = trimmed.substring(numPrefixMatch[0].length).trim();
  }

  // 5. Remove leading page header clutter e.g. "PROVA RESIDÊNCIA MÉDICA 2024 - "
  const provaMatch = trimmed.match(/^(?:PROVA|SIMULADO|PROCESSO SELETIVO|RESIDÊNCIA MÉDICA)\s*(?:DE\s*)?[A-ZÀ-Ú0-9\s\-\/\.]*?[\.\-\–\—\:]\s*/i);
  if (provaMatch) {
    trimmed = trimmed.substring(provaMatch[0].length).trim();
  }

  return {
    cleanedText: trimmed,
    extractedYear,
    extractedBanca
  };
}

// Extract embedded inline options (A) ... B) ... C) ... D) ...) from question text if options array is empty or lacks text
export function extractOptionsFromText(
  text: string, 
  currentOptions: string[] = []
): { text: string; options: string[] } {
  if (!text) return { text, options: currentOptions };

  // Check if we have valid non-empty options
  const validOpts = Array.isArray(currentOptions) 
    ? currentOptions.map(o => String(o).trim()).filter(o => o.replace(/^[a-eA-E][\)\.\-\s]+/, '').trim().length > 0)
    : [];

  if (validOpts.length >= 2) {
    return {
      text,
      options: currentOptions.map(o => String(o).trim()).filter(Boolean)
    };
  }

  // Detect inline option markers like: " A) ", "\nA) ", "(A) ", " A. ", " A - ", " a) ", " [A] "
  const inlineRegex = /(?:^|\s|\n)(?:\(|\[)?([a-eA-E])(?:\)|\]|\.|\-)\s+/g;
  
  const matches: { letter: string; index: number; length: number; fullMatch: string }[] = [];
  let m: RegExpExecArray | null;

  while ((m = inlineRegex.exec(text)) !== null) {
    matches.push({
      letter: m[1].toUpperCase(),
      index: m.index + (m[0].length - m[0].trimStart().length),
      length: m[0].trimStart().length,
      fullMatch: m[0].trimStart()
    });
  }

  // Look for a sequence: A followed by B
  let sequenceStart = -1;
  for (let i = 0; i < matches.length - 1; i++) {
    if (matches[i].letter === 'A' && matches[i+1].letter === 'B') {
      sequenceStart = i;
      break;
    }
  }

  if (sequenceStart !== -1) {
    const validMatches: typeof matches = [];
    let expectedCharCode = 'A'.charCodeAt(0);

    for (let i = sequenceStart; i < matches.length; i++) {
      if (matches[i].letter.charCodeAt(0) === expectedCharCode) {
        validMatches.push(matches[i]);
        expectedCharCode++;
      }
    }

    if (validMatches.length >= 2) {
      const cleanEnunciado = text.substring(0, validMatches[0].index).trim();
      const extractedOpts: string[] = [];

      for (let k = 0; k < validMatches.length; k++) {
        const start = validMatches[k].index + validMatches[k].length;
        const end = (k < validMatches.length - 1) ? validMatches[k+1].index : text.length;
        const optBody = text.substring(start, end).trim();
        extractedOpts.push(`${validMatches[k].letter}) ${optBody}`);
      }

      return {
        text: cleanEnunciado,
        options: extractedOpts
      };
    }
  }

  return { text, options: currentOptions };
}

export function checkFormattingIssues(text: string): {
  hasPlusIssue: boolean;
  hasVIssue: boolean;
  hasAccentIssue: boolean;
  hasHeaderClutter: boolean;
  hasYearStartIssue: boolean;
  hasIssue: boolean;
  details: string[];
} {
  if (!text) return { hasPlusIssue: false, hasVIssue: false, hasAccentIssue: false, hasHeaderClutter: false, hasYearStartIssue: false, hasIssue: false, details: [] };

  const details: string[] = [];

  // 1. Check for '+' attached to letters
  const plusRegex = /([a-zA-Zà-úÀ-Ú]\+[a-zA-Zà-úÀ-Ú]|\b\+[a-zA-Zà-úÀ-Ú]|[a-zA-Zà-úÀ-Ú]\+\b)/;
  const textWithoutBloodTypes = text.replace(/(Rh|AB|A|B|O|HIV|HBsAg|PCR)\+/gi, '');
  const hasPlusIssue = plusRegex.test(textWithoutBloodTypes);
  if (hasPlusIssue) {
    details.push("Substituição de '+' em palavras (ex: +sico, ultrassonográ+ca)");
  }

  // 2. Check for OCR 'V' or 'v' replacing 'FL' or 'FI'
  const vRegex = /\b(invam|vutu|revux|vuxo|vuíd|provilax|avuên|invuên|insuviciên|diviculd|evicác|signivicat|visiolog|vísic|mamogravia|ultrassonográvica|radiográvica|inviltr)/i;
  const hasVIssue = vRegex.test(text);
  if (hasVIssue) {
    details.push("Letra 'V' ou 'v' substituindo 'FL'/'FI' (ex: invamação, vutuação, revuxo)");
  }

  // 3. Check for isolated combining diacritics or spacing accents with spaces
  const accentRegex = /([\u0300-\u036f]|[a-zA-Zà-úÀ-Ú]\s+[̧¸̃˜́´̂ˆ\u0300-\u036f]|c\s*̧|a\s*̃|o\s*̃|[a-e-i-o-u]\s*[́´̂ˆ])/i;
  const hasAccentIssue = accentRegex.test(text);
  if (hasAccentIssue) {
    details.push('Acentos ou cedilhas isolados/separados das letras (ex: c ̧ a ̃ o, mama ́ rio)');
  }

  // 4. Check for header clutter or year at start of statement (e.g. "2024 - USP - Questão 12 - ")
  const startsWithYearRegex = /^\s*\(?\s*(?:19\d\d|20\d\d)\b/i;
  const hasYearStartIssue = startsWithYearRegex.test(text);
  if (hasYearStartIssue) {
    details.push('Enunciado começa com o ano (ex: 2024 - USP - ...)');
  }

  const headerRegex = /^\s*(?:19\d\d|20\d\d)\s*[\.\-\–\—\:\/]\s*|(?:Quest[ãa]o|QUEST[ÃA]O)\s*\d+\s*[\.\-\–\—\:\)]/i;
  const hasHeaderClutter = headerRegex.test(text) || hasYearStartIssue;
  if (hasHeaderClutter && !hasYearStartIssue) {
    details.push('Cabeçalho residual no início do enunciado (ex: Questão 12 -)');
  }

  return {
    hasPlusIssue,
    hasVIssue,
    hasAccentIssue,
    hasHeaderClutter,
    hasYearStartIssue,
    hasIssue: hasPlusIssue || hasVIssue || hasAccentIssue || hasHeaderClutter || hasYearStartIssue,
    details
  };
}

export function checkQuestionFormatting(q: any): {
  hasPlusIssue: boolean;
  hasVIssue: boolean;
  hasAccentIssue: boolean;
  hasHeaderClutter: boolean;
  hasYearStartIssue: boolean;
  hasMissingOptions: boolean;
  hasMissingImageWarning: boolean;
  hasIssue: boolean;
  details: string[];
} {
  if (!q) return { hasPlusIssue: false, hasVIssue: false, hasAccentIssue: false, hasHeaderClutter: false, hasYearStartIssue: false, hasMissingOptions: false, hasMissingImageWarning: false, hasIssue: false, details: [] };

  const textCheck = checkFormattingIssues(q.text || '');
  const explanationCheck = checkFormattingIssues(q.explanation || '');
  let optionsPlus = false;
  let optionsV = false;
  let optionsAccent = false;

  if (Array.isArray(q.options)) {
    for (const opt of q.options) {
      if (typeof opt === 'string') {
        const c = checkFormattingIssues(opt);
        if (c.hasPlusIssue) optionsPlus = true;
        if (c.hasVIssue) optionsV = true;
        if (c.hasAccentIssue) optionsAccent = true;
      }
    }
  }

  const isMultipleChoice = (q.type || 'multiple_choice') === 'multiple_choice';
  const validOpts = Array.isArray(q.options) ? q.options.filter((o: any) => String(o).replace(/^[a-eA-E][\)\.\-\s]+/, '').trim().length > 0) : [];
  const hasMissingOptions = isMultipleChoice && validOpts.length < 2;

  const hasImageKeywords = hasImageReferenceKeywords(q.text || '');
  const hasMissingImageWarning = (q.hasImageWarning || hasImageKeywords) && !q.ignoreImageWarning && (!q.images || q.images.length === 0);

  const hasPlusIssue = textCheck.hasPlusIssue || explanationCheck.hasPlusIssue || optionsPlus;
  const hasVIssue = textCheck.hasVIssue || explanationCheck.hasVIssue || optionsV;
  const hasAccentIssue = textCheck.hasAccentIssue || explanationCheck.hasAccentIssue || optionsAccent;
  const hasHeaderClutter = textCheck.hasHeaderClutter;
  const hasYearStartIssue = textCheck.hasYearStartIssue;

  const details = Array.from(new Set([...textCheck.details, ...explanationCheck.details]));
  if (hasMissingOptions) {
    details.push('Questão de múltipla escolha sem alternativas ou com alternativas coladas no enunciado');
  }
  if (hasMissingImageWarning) {
    details.push("Referência a imagem/exame ('abaixo', 'a seguir', 'seguinte', etc.), sem imagem anexada");
  }

  return {
    hasPlusIssue,
    hasVIssue,
    hasAccentIssue,
    hasHeaderClutter,
    hasYearStartIssue,
    hasMissingOptions,
    hasMissingImageWarning,
    hasIssue: hasPlusIssue || hasVIssue || hasAccentIssue || hasHeaderClutter || hasYearStartIssue || hasMissingOptions || hasMissingImageWarning,
    details
  };
}

export function sanitizeQuestionFields<T extends Record<string, any>>(q: T): T {
  if (!q) return q;
  const copy: any = { ...q };

  let rawText = typeof copy.text === 'string' ? copy.text : '';
  rawText = fixPdfLigatures(rawText);

  // Clean initial header clutter (years, banca names, "Questão XX.")
  const headerClean = cleanEnunciadoHeader(rawText);
  rawText = headerClean.cleanedText;

  if (headerClean.extractedYear && (!copy.year || copy.year === '')) {
    copy.year = headerClean.extractedYear;
  }
  if (headerClean.extractedBanca && (!copy.institution || copy.institution === '')) {
    copy.institution = headerClean.extractedBanca;
  }

  // Extract inline options if options array is empty or has < 2 options
  const optExtraction = extractOptionsFromText(rawText, copy.options || []);
  copy.text = optExtraction.text;
  copy.options = optExtraction.options;

  if (Array.isArray(copy.options)) {
    copy.options = copy.options.map((opt: any) => typeof opt === 'string' ? fixPdfLigatures(opt) : opt);
  }
  if (typeof copy.correctAnswer === 'string') {
    copy.correctAnswer = fixPdfLigatures(copy.correctAnswer);
  }
  if (typeof copy.explanation === 'string') {
    copy.explanation = fixPdfLigatures(copy.explanation);
  }
  if (typeof copy.institution === 'string') {
    copy.institution = fixPdfLigatures(copy.institution);
  }
  if (typeof copy.subtag === 'string') {
    copy.subtag = fixPdfLigatures(copy.subtag);
  }
  if (Array.isArray(copy.subtags)) {
    copy.subtags = copy.subtags.map((s: any) => typeof s === 'string' ? fixPdfLigatures(s) : s);
  }
  return copy as T;
}
