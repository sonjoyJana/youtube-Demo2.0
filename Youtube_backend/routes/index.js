import { Router } from 'express';
import authRoutes from './auth.js';
import videoRoutes from './videos.js';
import commentRoutes from './comments.js';
import userRoutes from './users.js';
import translateRoutes from './translate.js';
import moderationRoutes from './moderation.js';
import securityRoutes from './security.js';
import profileRoutes from './profile.js';
import planRoutes from './plans.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'youtube', time: new Date().toISOString() });
});

router.use('/auth', authRoutes);
router.use('/videos', videoRoutes);
router.use('/comments', commentRoutes);
router.use('/users', userRoutes);
router.use('/translate', translateRoutes);
router.use('/moderation', moderationRoutes);
router.use('/security', securityRoutes);
router.use('/profile', profileRoutes);
router.use('/plans', planRoutes);

router.use((_req, res) => {
  res.status(404).json({ message: 'API route not found.', code: 'NOT_FOUND' });
});

export default router;
