import crypto from 'crypto';

const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;
const CAPTCHA_THRESHOLD = 3;
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const FLOOD_WINDOW_MS = 60 * 1000;
const FLOOD_LIMIT = 5;

const attemptsByUser = new Map();
const postsByUser = new Map();
const challenges = new Map();

function pruneTimestamps(list, now) {
  return (list || []).filter((timestamp) => now - timestamp < ATTEMPT_WINDOW_MS);
}

export function recordAttempt(userId) {
  const key = String(userId);
  const now = Date.now();
  const attempts = pruneTimestamps(attemptsByUser.get(key), now);
  attempts.push(now);
  attemptsByUser.set(key, attempts);
  return { count: attempts.length, captchaRequired: attempts.length >= CAPTCHA_THRESHOLD };
}

export function requiresCaptcha(userId) {
  const key = String(userId);
  const attempts = pruneTimestamps(attemptsByUser.get(key), Date.now());
  attemptsByUser.set(key, attempts);
  return attempts.length >= CAPTCHA_THRESHOLD;
}

export function clearAttempts(userId) {
  attemptsByUser.delete(String(userId));
}

export function checkFlooding(userId) {
  const key = String(userId);
  const now = Date.now();
  const posts = (postsByUser.get(key) || []).filter(
    (timestamp) => now - timestamp < FLOOD_WINDOW_MS
  );
  postsByUser.set(key, posts);

  if (posts.length >= FLOOD_LIMIT) {
    const retryAfterMs = FLOOD_WINDOW_MS - (now - posts[0]);
    return { blocked: true, retryAfterMs };
  }

  return { blocked: false };
}

export function recordSuccessfulPost(userId) {
  const key = String(userId);
  const now = Date.now();
  const posts = (postsByUser.get(key) || []).filter(
    (timestamp) => now - timestamp < FLOOD_WINDOW_MS
  );
  posts.push(now);
  postsByUser.set(key, posts);
}

export function createChallenge(userId) {
  const first = crypto.randomInt(2, 10);
  const second = crypto.randomInt(2, 10);
  const operation = crypto.randomInt(0, 2);
  const answer = operation === 0 ? first + second : first * second;
  const token = crypto.randomUUID();

  challenges.set(token, {
    userId: String(userId),
    answer: String(answer),
    expiresAt: Date.now() + CHALLENGE_TTL_MS,
  });

  return {
    token,
    question: operation === 0 ? `What is ${first} + ${second}?` : `What is ${first} × ${second}?`,
    expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
  };
}

export function verifyChallenge(token, answer, userId) {
  if (!token || !answer) return false;
  const challenge = challenges.get(token);
  if (!challenge) return false;
  if (challenge.userId !== String(userId) || challenge.expiresAt < Date.now()) {
    challenges.delete(token);
    return false;
  }
  const valid = String(challenge.answer) === String(answer).trim();
  challenges.delete(token);
  if (valid) clearAttempts(userId);
  return valid;
}

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [token, challenge] of challenges.entries()) {
    if (challenge.expiresAt < now) challenges.delete(token);
  }
  for (const [key, attempts] of attemptsByUser.entries()) {
    const active = pruneTimestamps(attempts, now);
    if (active.length === 0) attemptsByUser.delete(key);
    else attemptsByUser.set(key, active);
  }
  for (const [key, posts] of postsByUser.entries()) {
    const active = posts.filter((timestamp) => now - timestamp < FLOOD_WINDOW_MS);
    if (active.length === 0) postsByUser.delete(key);
    else postsByUser.set(key, active);
  }
}, 60 * 1000);
cleanupTimer.unref?.();
