const PROFANITY = [
  'fuck',
  'fucking',
  'motherfucker',
  'shit',
  'bullshit',
  'bitch',
  'bastard',
  'asshole',
  'dickhead',
  'cunt',
  'slut',
  'whore',
  'retard',
  'puta',
  'puto',
  'mierda',
  'cabron',
  'cabrón',
  'pendejo',
  'verga',
  'merde',
  'salope',
  'connard',
  'encule',
  'scheisse',
  'scheiße',
  'arschloch',
  'hurensohn',
  'merda',
  'filho da puta',
  'chutiya',
  'gandu',
  'madarchod',
  'behenchod',
  'bhosdike',
  'harami',
  'kutta',
  'kamina',
  'randi',
  'lanja',
  'puku',
  'كس',
  'خرا',
  'شرموط',
  'قحبة',
  'منيوك',
];

const SPAM_PHRASES = [
  'free followers',
  'free likes',
  'crypto giveaway',
  'bitcoin giveaway',
  'double your bitcoin',
  'earn money fast',
  'work from home and earn',
  'click here to win',
  'claim your prize',
  'telegram me for',
  'dm me to earn',
  'investment opportunity',
  'guaranteed profit',
  'visit my profile for',
];

const SHORTENER_HOSTS = new Set([
  'bit.ly',
  'tinyurl.com',
  't.co',
  'goo.gl',
  'ow.ly',
  'is.gd',
  'buff.ly',
  'cutt.ly',
  'shorturl.at',
  'rb.gy',
  'rebrand.ly',
  't.ly',
  'tiny.cc',
  's.id',
  'v.gd',
]);

const SUSPICIOUS_TLDS = new Set([
  'zip',
  'mov',
  'top',
  'click',
  'link',
  'work',
  'gq',
  'tk',
  'ml',
  'cf',
  'ga',
  'rest',
  'buzz',
]);

const SUSPICIOUS_URL_TERMS = [
  'free-crypto',
  'freebitcoin',
  'gift-card',
  'login-verify',
  'wallet-connect',
  'airdrop',
  'claim-prize',
  'crypto-gift',
  'verify-account',
];

const LANGUAGE_STOPWORDS = {
  en: ['the', 'and', 'is', 'this', 'that', 'you', 'for', 'with', 'are', 'was', 'have', 'video'],
  es: ['el', 'la', 'los', 'las', 'que', 'de', 'en', 'un', 'una', 'es', 'este', 'muy', 'gracias', 'video'],
  fr: ['le', 'la', 'les', 'des', 'que', 'est', 'une', 'un', 'dans', 'pour', 'merci', 'très', 'vidéo'],
  de: ['der', 'die', 'das', 'und', 'ist', 'ein', 'eine', 'nicht', 'mit', 'für', 'danke', 'sehr', 'video'],
  pt: ['o', 'a', 'os', 'as', 'que', 'de', 'em', 'um', 'uma', 'é', 'este', 'muito', 'obrigado', 'vídeo'],
  it: ['il', 'la', 'gli', 'le', 'che', 'di', 'in', 'un', 'una', 'è', 'questo', 'molto', 'grazie', 'video'],
  nl: ['de', 'het', 'een', 'en', 'is', 'niet', 'met', 'voor', 'dank', 'heel', 'video'],
  tr: ['ve', 'bir', 'bu', 'için', 'ile', 'değil', 'çok', 'teşekkür', 'video'],
  id: ['dan', 'yang', 'ini', 'itu', 'untuk', 'dengan', 'tidak', 'sangat', 'terima', 'kasih', 'video'],
  vi: ['và', 'là', 'của', 'này', 'đó', 'cho', 'với', 'không', 'rất', 'cảm', 'ơn', 'video'],
  pl: ['i', 'jest', 'to', 'nie', 'dla', 'z', 'na', 'bardzo', 'dziękuję', 'film'],
  sv: ['och', 'är', 'det', 'inte', 'för', 'med', 'mycket', 'tack', 'video'],
};

const LEET_MAP = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
  '!': 'i',
};

const MENTION_PATTERN = /(?:^|[^\p{L}\p{N}_])@([a-zA-Z0-9_]{3,30})/gu;

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeForFiltering(text) {
  return text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[013457@$!]/g, (character) => LEET_MAP[character] || character)
    .replace(/\s+/g, ' ');
}

function containsProfanity(text) {
  const normalized = normalizeForFiltering(text);
  return PROFANITY.some((word) => {
    const normalizedWord = normalizeForFiltering(word);
    return new RegExp(
      `(^|[^\\p{L}\\p{N}])${escapeRegex(normalizedWord)}([^\\p{L}\\p{N}]|$)`,
      'u'
    ).test(normalized);
  });
}

function containsSpamPhrase(text) {
  const normalized = normalizeForFiltering(text);
  return SPAM_PHRASES.find((phrase) => normalized.includes(normalizeForFiltering(phrase)));
}

function extractUrls(text) {
  const explicit = text.match(/(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi) || [];
  const barePattern =
    /(?<![\w@.])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,24})(?:\/[^\s<>"')\]]*)?/gi;
  const bare = text.match(barePattern) || [];
  const urls = [...explicit];

  for (const raw of bare) {
    const lower = raw.toLowerCase();
    if (explicit.some((url) => url.toLowerCase().includes(lower))) continue;

    const hostname = lower.split('/')[0];
    const hasPath = lower.includes('/');
    const riskyHost =
      SHORTENER_HOSTS.has(hostname) ||
      SUSPICIOUS_URL_TERMS.some((term) => lower.includes(term));

    if (hasPath || riskyHost) urls.push(raw);
  }

  return urls;
}

function isPrivateHostname(hostname) {
  if (hostname === 'localhost') return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true;
  if (hostname.startsWith('[') || hostname.includes(':')) return true;
  return false;
}

function inspectLinks(text) {
  const urls = extractUrls(text);
  if (urls.length > 2) {
    return { issue: 'TOO_MANY_LINKS', message: 'Comments may contain at most two links.' };
  }

  for (const raw of urls) {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    try {
      const parsed = new URL(candidate);
      const hostname = parsed.hostname.toLowerCase();
      const path = `${parsed.pathname}${parsed.search}`.toLowerCase();

      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { issue: 'MALICIOUS_LINK', message: 'Unsafe links are not allowed.' };
      }
      if (isPrivateHostname(hostname) || hostname.includes('xn--')) {
        return { issue: 'MALICIOUS_LINK', message: 'This link looks unsafe and was blocked.' };
      }
      if (SHORTENER_HOSTS.has(hostname)) {
        return {
          issue: 'MALICIOUS_LINK',
          message: 'URL shorteners are blocked because their destination cannot be verified.',
        };
      }
      const tld = hostname.split('.').pop();
      if (SUSPICIOUS_TLDS.has(tld)) {
        return { issue: 'MALICIOUS_LINK', message: 'Links from this domain are not allowed.' };
      }
      if (SUSPICIOUS_URL_TERMS.some((term) => path.includes(term) || hostname.includes(term))) {
        return { issue: 'MALICIOUS_LINK', message: 'This link was flagged as a malicious link.' };
      }
    } catch {
      return { issue: 'MALICIOUS_LINK', message: 'One of the links in your comment is invalid.' };
    }
  }

  return null;
}

function inspectRepetition(text) {
  if (/(.)\1{7,}/u.test(text)) {
    return {
      issue: 'REPEATED_CHARACTERS',
      message: 'Please avoid repeating the same character over and over.',
    };
  }

  const characters = Array.from(text);
  const meaningful = characters.filter((character) => /[\p{L}\p{N}\s]/u.test(character)).length;
  if (characters.length >= 6 && meaningful / characters.length < 0.3) {
    return {
      issue: 'EXCESSIVE_EMOJI',
      message: 'Comments containing mostly emojis or special characters are blocked as spam.',
    };
  }

  const words = text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  if (words.length >= 10) {
    const unique = new Set(words);
    if (unique.size / words.length < 0.22) {
      return { issue: 'SPAM_DETECTED', message: 'This comment looks like repeated spam.' };
    }
  }

  return null;
}

export function sanitizeContent(content) {
  return String(content ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function detectLanguage(text) {
  const value = String(text || '');
  if (!value.trim()) return 'en';

  if (/[\u0600-\u06FF]/.test(value)) {
    return /[\u0679\u0688\u0691\u06BA\u06D2\u06C1]/.test(value) ? 'ur' : 'ar';
  }
  if (/[\u0900-\u097F]/.test(value)) return 'hi';
  if (/[\u0980-\u09FF]/.test(value)) return 'bn';
  if (/[\u0A80-\u0AFF]/.test(value)) return 'gu';
  if (/[\u0B80-\u0BFF]/.test(value)) return 'ta';
  if (/[\u0C00-\u0C7F]/.test(value)) return 'te';
  if (/[\u0A00-\u0A7F]/.test(value)) return 'pa';
  if (/[\u0B00-\u0B7F]/.test(value)) return 'mr';
  if (/[\u0370-\u03FF]/.test(value)) return 'el';
  if (/[\u0590-\u05FF]/.test(value)) return 'he';
  if (/[\u0E00-\u0E7F]/.test(value)) return 'th';
  if (/[\u3040-\u30FF]/.test(value)) return 'ja';
  if (/[\uAC00-\uD7AF]/.test(value)) return 'ko';
  if (/[\u4E00-\u9FFF]/.test(value)) return 'zh';
  if (/[\u0400-\u04FF]/.test(value)) {
    return /[\u0404\u0406\u0407\u0490]/.test(value) ? 'uk' : 'ru';
  }

  const words = value.toLowerCase().match(/[\p{L}]+/gu) || [];
  if (words.length === 0) return 'en';

  let bestLanguage = 'en';
  let bestScore = 0;
  for (const [language, stopwords] of Object.entries(LANGUAGE_STOPWORDS)) {
    const score = words.reduce(
      (total, word) => total + (stopwords.includes(word) ? 1 : 0),
      0
    );
    if (score > bestScore) {
      bestScore = score;
      bestLanguage = language;
    }
  }

  return bestScore > 0 ? bestLanguage : 'en';
}

export function extractMentionUsernames(text) {
  const usernames = new Set();
  for (const match of text.matchAll(MENTION_PATTERN)) {
    usernames.add(match[1].toLowerCase());
  }
  return [...usernames];
}

export function validateCommentContent(content) {
  if (!content) {
    return { ok: false, code: 'EMPTY_COMMENT', message: 'Write something before posting.' };
  }

  if (containsProfanity(content)) {
    return {
      ok: false,
      code: 'ABUSIVE_CONTENT',
      message: 'Your comment contains abusive language and cannot be posted.',
      issue: 'PROFANITY',
    };
  }

  const spamPhrase = containsSpamPhrase(content);
  if (spamPhrase) {
    return {
      ok: false,
      code: 'SPAM_DETECTED',
      message: 'Your comment looks like spam and cannot be posted.',
      issue: 'SPAM_PHRASE',
    };
  }

  const repetitionIssue = inspectRepetition(content);
  if (repetitionIssue) {
    return { ok: false, code: repetitionIssue.issue, ...repetitionIssue };
  }

  const linkIssue = inspectLinks(content);
  if (linkIssue) {
    return { ok: false, code: linkIssue.issue, ...linkIssue };
  }

  const mentionCount = extractMentionUsernames(content).length;
  if (mentionCount > 5) {
    return {
      ok: false,
      code: 'EXCESSIVE_MENTIONS',
      message: 'Please mention no more than five users in one comment.',
    };
  }

  return { ok: true };
}
