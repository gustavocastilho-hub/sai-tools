import { LogsService } from './logs.service';

const service = new LogsService();

export const startSyncScheduler = () => {
  const intervalSec = parseInt(process.env.SYNC_INTERVAL_SECONDS || '300');
  console.log(`[sync] Scheduler started, every ${intervalSec}s`);
  service.syncAll().catch((e) => console.warn('[sync] initial run failed', e));
  setInterval(() => {
    service.syncAll().catch((e) => console.warn('[sync] run failed', e));
  }, intervalSec * 1000);
};
