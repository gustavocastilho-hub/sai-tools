import 'dotenv/config';
import app from './app';
import { startSyncScheduler } from './modules/logs/logs.sync';
import { seedDefaultClients } from './modules/logs/logs.seed';

const REQUIRED = ['DATABASE_URL', 'ACCESS_TOKEN_SECRET', 'MASTER_PASSWORD'];
const missing = REQUIRED.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`[boot] Missing required env: ${missing.join(', ')}`);
  process.exit(1);
}

const PORT = parseInt(process.env.PORT || '3000');

app.listen(PORT, async () => {
  console.log(`[boot] SAI Tools backend running on http://localhost:${PORT}`);
  try {
    await seedDefaultClients();
  } catch (e) {
    console.warn('[seed] failed:', e);
  }
  startSyncScheduler();
});
