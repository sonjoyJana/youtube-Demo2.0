import { Router } from 'express';
import { PLANS, getPlan, isPlanId, assertPlanId, planCanAccess } from '../config/plans.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { User } from '../models/User.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const plans = PLANS.map((plan) => ({
      ...plan,
      features: { ...plan.features }
    }));
    res.json({ plans, current: null });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).select('+password');
    const planId = user?.plan || 'free';
    const plan = getPlan(planId);
    res.json({
      plan: {
        id: plan.id,
        name: plan.name,
        rank: plan.rank,
        priceInPaise: plan.priceInPaise,
        currency: plan.currency,
        downloads: { ...plan.downloads },
        features: { ...plan.features }
      },
      user: {
        id: String(user._id),
        plan: user.plan,
        planStartedAt: user.planStartedAt,
        planExpiresAt: user.planExpiresAt,
        effectivePlan: user.effectivePlan()
      }
    });
  })
);

router.post(
  '/:planId/upgrade',
  requireAuth,
  asyncHandler(async (req, res) => {
    const planId = assertPlanId(req.params.planId);
    const user = await User.findById(req.user._id).select('+password');
    const plan = getPlan(planId);
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    user.plan = planId;
    user.planStartedAt = now;
    user.planExpiresAt = periodEnd;
    await user.save();

    res.json({
      message: `Plan upgraded to ${plan.name}.`,
      plan: {
        id: plan.id,
        name: plan.name,
        rank: plan.rank,
        priceInPaise: plan.priceInPaise,
        currency: plan.currency,
        downloads: { ...plan.downloads },
        features: { ...plan.features }
      }
    });
  })
);

export { isPlanId, planCanAccess };
export default router;
