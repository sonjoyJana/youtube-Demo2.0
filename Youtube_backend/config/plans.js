export const PLAN_IDS = ['free', 'bronze', 'silver', 'gold'];

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    rank: 0,
    priceInPaise: 0,
    currency: 'INR',
    downloads: { daily: 1, monthly: 5 },
    features: {
      premiumVideoAccess: false,
      maxStreamQuality: '720p',
      adFree: false,
      offlineDownloads: false,
      prioritySupport: false
    }
  },
  {
    id: 'bronze',
    name: 'Bronze',
    rank: 1,
    priceInPaise: 14900,
    currency: 'INR',
    downloads: { daily: 5, monthly: 25 },
    features: {
      premiumVideoAccess: false,
      maxStreamQuality: '1080p',
      adFree: false,
      offlineDownloads: true,
      prioritySupport: false
    }
  },
  {
    id: 'silver',
    name: 'Silver',
    rank: 2,
    priceInPaise: 39900,
    currency: 'INR',
    downloads: { daily: 15, monthly: 75 },
    features: {
      premiumVideoAccess: true,
      maxStreamQuality: '1080p',
      adFree: true,
      offlineDownloads: true,
      prioritySupport: false
    }
  },
  {
    id: 'gold',
    name: 'Gold',
    rank: 3,
    priceInPaise: 99900,
    currency: 'INR',
    downloads: { daily: 40, monthly: 200 },
    features: {
      premiumVideoAccess: true,
      maxStreamQuality: '2160p',
      adFree: true,
      offlineDownloads: true,
      prioritySupport: true
    }
  }
];

export function isPlanId(value) {
  return PLAN_IDS.includes(value);
}

export function getPlan(planId) {
  return PLANS.find((plan) => plan.id === planId) || PLANS[0];
}

export function assertPlanId(value) {
  if (!isPlanId(value)) throw Object.assign(new Error('Unknown plan.'), { statusCode: 400 });
  return value;
}

export function planCanAccess(planId, minPlan) {
  const plan = getPlan(planId);
  const required = getPlan(minPlan);
  return plan.rank >= required.rank;
}
