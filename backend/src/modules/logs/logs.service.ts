import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

export class LogsService {
  async getClients() {
    return prisma.chatbotClient.findMany({
      select: { id: true, name: true, url: true },
      orderBy: { name: 'asc' },
    });
  }

  async registerClient(name: string, url: string) {
    const existing = await prisma.chatbotClient.findUnique({ where: { url } });
    if (existing) return { already_exists: true, clientId: existing.id };
    const created = await prisma.chatbotClient.create({ data: { name, url } });
    return { registered: true, clientId: created.id };
  }

  async getLeads(clientId: string) {
    return prisma.lead.findMany({
      where: { clientId },
      select: {
        phone: true, nome: true, nicho: true,
        msg_count: true, has_followup: true,
        event_id: true, resumo: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getHistory(clientId: string, phone: string) {
    const client = await prisma.chatbotClient.findUnique({ where: { id: clientId } });
    if (!client) return [];
    try {
      const r = await axios.get(`${client.url}/logs/history/${phone}`, { timeout: 8000 });
      return Array.isArray(r.data) ? r.data : [];
    } catch (err: any) {
      console.warn(`[history] ${client.name} ${phone} failed: ${err?.message || err}`);
      return prisma.message.findMany({
        where: { phone },
        select: { role: true, content: true },
        orderBy: { createdAt: 'asc' },
      });
    }
  }

  async getEvents(clientId: string, limit: number) {
    return prisma.logEvent.findMany({
      where: { clientId },
      select: { phone: true, ts: true, lines: true },
      orderBy: { ts: 'desc' },
      take: limit,
    });
  }

  async syncClient(clientId: string) {
    const client = await prisma.chatbotClient.findUnique({ where: { id: clientId } });
    if (!client) return;
    try {
      const leadsRes = await axios.get(`${client.url}/logs/leads`, { timeout: 8000 });
      for (const l of (leadsRes.data || [])) {
        await prisma.lead.upsert({
          where: { clientId_phone: { clientId, phone: l.phone } },
          create: { clientId, phone: l.phone, nome: l.nome, nicho: l.nicho,
            msg_count: l.msg_count || 0, has_followup: !!l.has_followup,
            event_id: l.event_id || null, resumo: l.resumo || null },
          update: { nome: l.nome, nicho: l.nicho, msg_count: l.msg_count || 0,
            has_followup: !!l.has_followup, event_id: l.event_id || null, resumo: l.resumo || null },
        });
      }
      const eventsRes = await axios.get(`${client.url}/logs/events?limit=100`, { timeout: 8000 });
      for (const e of (eventsRes.data || [])) {
        const id = `${clientId}_${e.ts}_${e.phone}`;
        await prisma.logEvent.upsert({
          where: { id },
          create: { id, clientId, phone: e.phone, ts: e.ts, lines: e.lines || [] },
          update: { lines: e.lines || [] },
        });
      }
      console.log(`[sync] ${client.name} OK`);
    } catch (err: any) {
      console.warn(`[sync] ${client.name} failed: ${err?.message || err}`);
    }
  }

  async syncAll() {
    const clients = await prisma.chatbotClient.findMany();
    for (const c of clients) await this.syncClient(c.id);
  }
}
