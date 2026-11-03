import crypto from 'crypto';
import { Translation } from '../models/Translation.js';
import { LANGUAGE_CODES } from '../constants.js';

const MEMORY_URL = 'https://api.mymemory.translated.net/get';
const MAX_CHUNK_LENGTH = 450;

export class TranslationError extends Error {
  constructor(message, code = 'TRANSLATION_FAILED') {
    super(message);
    this.name = 'TranslationError';
    this.code = code;
  }
}

const LOCAL_WORDS = {
  en: {
    hello: 'hello',
    hi: 'hi',
    thanks: 'thanks',
    'thank you': 'thank you',
    please: 'please',
    sorry: 'sorry',
    yes: 'yes',
    no: 'no',
    good: 'good',
    great: 'great',
    amazing: 'amazing',
    beautiful: 'beautiful',
    video: 'video',
    comment: 'comment',
    love: 'love',
    like: 'like',
    friend: 'friend',
    welcome: 'welcome',
    goodbye: 'goodbye',
    'see you': 'see you',
    what: 'what',
    why: 'why',
    how: 'how',
    where: 'where',
    when: 'when',
    very: 'very',
    nice: 'nice',
    awesome: 'awesome',
    subscribe: 'subscribe',
    channel: 'channel',
  },
  es: {
    hola: 'hello',
    gracias: 'thank you',
    por: 'please',
    favor: 'favor',
    perdón: 'sorry',
    perdon: 'sorry',
    sí: 'yes',
    si: 'yes',
    no: 'no',
    bueno: 'good',
    buen: 'good',
    gran: 'great',
    increíble: 'amazing',
    hermoso: 'beautiful',
    video: 'video',
    comentario: 'comment',
    amor: 'love',
    gusta: 'like',
    amigo: 'friend',
    bienvenido: 'welcome',
    adiós: 'goodbye',
    qué: 'what',
    porqué: 'why',
    cómo: 'how',
    dónde: 'where',
    cuándo: 'when',
    muy: 'very',
    agradable: 'nice',
    suscribir: 'subscribe',
    canal: 'channel',
  },
  fr: {
    bonjour: 'hello',
    salut: 'hi',
    merci: 'thank you',
    plaît: 'please',
    plait: 'please',
    pardon: 'sorry',
    oui: 'yes',
    non: 'no',
    bon: 'good',
    grande: 'great',
    incroyable: 'amazing',
    beau: 'beautiful',
    vidéo: 'video',
    commentaire: 'comment',
    amour: 'love',
    aime: 'like',
    ami: 'friend',
    bienvenue: 'welcome',
    au: 'goodbye',
    revoir: 'goodbye',
    quoi: 'what',
    pourquoi: 'why',
    comment: 'how',
    où: 'where',
    quand: 'when',
    très: 'very',
    sympa: 'nice',
    abonner: 'subscribe',
    chaîne: 'channel',
  },
  de: {
    hallo: 'hello',
    danke: 'thanks',
    bitte: 'please',
    entschuldigung: 'sorry',
    ja: 'yes',
    nein: 'no',
    gut: 'good',
    toll: 'great',
    erstaunlich: 'amazing',
    schön: 'beautiful',
    video: 'video',
    kommentar: 'comment',
    liebe: 'love',
    mag: 'like',
    freund: 'friend',
    willkommen: 'welcome',
    tschüss: 'goodbye',
    was: 'what',
    warum: 'why',
    wie: 'how',
    wo: 'where',
    wann: 'when',
    sehr: 'very',
    nett: 'nice',
    abonnieren: 'subscribe',
    kanal: 'channel',
  },
  pt: {
    olá: 'hello',
    ola: 'hello',
    obrigado: 'thank you',
    obrigada: 'thank you',
    por: 'please',
    favor: 'favor',
    desculpe: 'sorry',
    sim: 'yes',
    não: 'no',
    nao: 'no',
    bom: 'good',
    ótimo: 'great',
    incrível: 'amazing',
    lindo: 'beautiful',
    vídeo: 'video',
    comentário: 'comment',
    amor: 'love',
    gosto: 'like',
    amigo: 'friend',
    bemvindo: 'welcome',
    tchau: 'goodbye',
    que: 'what',
    porque: 'why',
    como: 'how',
    onde: 'where',
    quando: 'when',
    muito: 'very',
    legal: 'nice',
    inscrever: 'subscribe',
    canal: 'channel',
  },
  it: {
    ciao: 'hello',
    grazie: 'thanks',
    prego: 'please',
    scusa: 'sorry',
    sì: 'yes',
    si: 'yes',
    no: 'no',
    buono: 'good',
    ottimo: 'great',
    fantastico: 'amazing',
    bello: 'beautiful',
    video: 'video',
    commento: 'comment',
    amore: 'love',
    piace: 'like',
    amico: 'friend',
    benvenuto: 'welcome',
    arrivederci: 'goodbye',
    cosa: 'what',
    perché: 'why',
    come: 'how',
    dove: 'where',
    quando: 'when',
    molto: 'very',
    simpatico: 'nice',
    iscriviti: 'subscribe',
    canale: 'channel',
  },
  hi: {
    नमस्ते: 'hello',
    धन्यवाद: 'thank you',
    कृपया: 'please',
    माफ: 'sorry',
    हाँ: 'yes',
    नहीं: 'no',
    अच्छा: 'good',
    बहुत: 'very',
    सुंदर: 'beautiful',
    वीडियो: 'video',
    टिप्पणी: 'comment',
    प्यार: 'love',
    दोस्त: 'friend',
    स्वागत: 'welcome',
    क्या: 'what',
    क्यों: 'why',
    कैसे: 'how',
    कहाँ: 'where',
    कब: 'when',
  },
  ar: {
    مرحبا: 'hello',
    شكرا: 'thank you',
    شكراً: 'thank you',
    منفضلك: 'please',
    آسف: 'sorry',
    نعم: 'yes',
    لا: 'no',
    جيد: 'good',
    عظيم: 'great',
    جميل: 'beautiful',
    فيديو: 'video',
    تعليق: 'comment',
    حب: 'love',
    صديق: 'friend',
    أهلا: 'welcome',
    وداعا: 'goodbye',
    ماذا: 'what',
    لماذا: 'why',
    كيف: 'how',
    أين: 'where',
    متى: 'when',
    جدا: 'very',
    رائع: 'awesome',
  },
};

const ENGLISH_TO_LOCAL = {};
for (const [language, words] of Object.entries(LOCAL_WORDS)) {
  if (language === 'en') continue;
  ENGLISH_TO_LOCAL[language] = {};
  for (const [word, english] of Object.entries(words)) {
    if (!ENGLISH_TO_LOCAL[language][english]) {
      ENGLISH_TO_LOCAL[language][english] = word;
    }
  }
}

const HTML_ENTITIES = {
  '&quot;': '"',
  '&#39;': "'",
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&nbsp;': ' ',
};

function decodeEntities(text) {
  return text.replace(/&(?:quot|#39|amp|lt|gt|nbsp);/g, (entity) => HTML_ENTITIES[entity] || entity);
}

function splitIntoChunks(text) {
  if (text.length <= MAX_CHUNK_LENGTH) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > MAX_CHUNK_LENGTH) {
    let splitAt = remaining.lastIndexOf(' ', MAX_CHUNK_LENGTH);
    if (splitAt < MAX_CHUNK_LENGTH * 0.5) splitAt = MAX_CHUNK_LENGTH;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function translateWithMyMemory(text, source, target) {
  const chunks = splitIntoChunks(text);
  const translatedChunks = [];

  for (const chunk of chunks) {
    const url = new URL(MEMORY_URL);
    url.searchParams.set('q', chunk);
    url.searchParams.set('langpair', `${source}|${target}`);
    if (process.env.MYMEMORY_EMAIL) url.searchParams.set('de', process.env.MYMEMORY_EMAIL);

    const response = await fetch(url, {
      signal: AbortSignal.timeout(9000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      throw new TranslationError(`Translation service responded with ${response.status}.`);
    }

    const payload = await response.json();
    const translated = payload?.responseData?.translatedText;
    if (
      !translated ||
      payload?.responseStatus === 403 ||
      /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID LANGUAGE PAIR/i.test(translated)
    ) {
      throw new TranslationError('The translation service could not translate this comment.');
    }
    translatedChunks.push(decodeEntities(translated));
  }

  return translatedChunks.join(' ');
}

function translateWithLocalDictionary(text, source, target) {
  const sourceWords = LOCAL_WORDS[source];
  const targetWords = LOCAL_WORDS[target];
  if (!sourceWords || !targetWords) {
    throw new TranslationError(
      'The online translation service is unavailable. Try again shortly.',
      'TRANSLATION_UNAVAILABLE'
    );
  }

  const sourceLookup = Object.entries(sourceWords).sort((a, b) => b[0].length - a[0].length);
  const targetLookup = ENGLISH_TO_LOCAL[target] || {};

  let translatedAny = false;
  let result = String(text);
  for (const [word, english] of sourceLookup) {
    const pattern = new RegExp(
      `(^|[^\\p{L}\\p{N}])(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})(?=$|[^\\p{L}\\p{N}])`,
      'giu'
    );
    result = result.replace(pattern, (match, prefix) => {
      const replacement = target === 'en' ? english : targetLookup[english];
      if (!replacement) return match;
      translatedAny = true;
      return `${prefix}${replacement}`;
    });
  }

  if (!translatedAny) {
    throw new TranslationError(
      'The online translation service is unavailable and this phrase is not in the offline dictionary.',
      'TRANSLATION_UNAVAILABLE'
    );
  }

  return result;
}

function cacheKey(text, source, target) {
  return crypto.createHash('sha256').update(`${source}|${target}|${text}`).digest('hex');
}

export async function translateText(text, source, target) {
  if (!LANGUAGE_CODES.has(source) || !LANGUAGE_CODES.has(target)) {
    throw new TranslationError('Unsupported language.', 'UNSUPPORTED_LANGUAGE');
  }
  if (source === target) {
    return { translated: text, provider: 'none', cached: false };
  }

  const key = cacheKey(text, source, target);
  const cached = await Translation.findOne({ key }).lean();
  if (cached) {
    return { translated: cached.translated, provider: cached.provider, cached: true };
  }

  let translated;
  let provider;
  const providerMode = process.env.TRANSLATE_PROVIDER || 'mymemory';

  if (providerMode !== 'local') {
    try {
      translated = await translateWithMyMemory(text, source, target);
      provider = 'mymemory';
    } catch {
      translated = translateWithLocalDictionary(text, source, target);
      provider = 'local';
    }
  } else {
    translated = translateWithLocalDictionary(text, source, target);
    provider = 'local';
  }

  if (!translated || translated.trim() === text.trim()) {
    translated = translateWithLocalDictionary(text, source, target);
    provider = 'local';
  }

  await Translation.findOneAndUpdate(
    { key },
    { key, source, target, original: text, translated, provider },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return { translated, provider, cached: false };
}
