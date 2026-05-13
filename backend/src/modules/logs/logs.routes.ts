import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth';
import { getClients, registerWebhook, getLeads, getHistory, getEvents } from './logs.controller';

const router = Router();

router.post('/register-webhook', registerWebhook);

router.get('/clients', authenticateJWT, getClients);
router.get('/:clientId/leads', authenticateJWT, getLeads);
router.get('/:clientId/history/:phone', authenticateJWT, getHistory);
router.get('/:clientId/events', authenticateJWT, getEvents);

export default router;
