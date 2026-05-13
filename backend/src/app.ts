import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import logsRoutes from './modules/logs/logs.routes';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

app.use('/auth', authRoutes);
app.use('/api/logs', logsRoutes);

app.use(errorHandler);

export default app;
