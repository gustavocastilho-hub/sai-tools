import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_CLIENTS: { name: string; url: string }[] = [
  { name: 'Mya Ads', url: 'https://webhook-whatsapp.strategicai.com.br/mya-ads-1' },
  { name: 'Mya Disparo 1', url: 'https://webhook-whatsapp.strategicai.com.br/mya-disparo-1' },
  { name: 'Mya Disparo 2', url: 'https://webhook-whatsapp.strategicai.com.br/mya-disparo-2' },
  { name: 'Mya Disparo 3', url: 'https://webhook-whatsapp.strategicai.com.br/mya-disparo-3' },
  { name: 'AJE', url: 'https://webhook-whatsapp.strategicai.com.br/ajeboxe' },
  { name: 'Gracie Barra', url: 'https://webhook-whatsapp.strategicai.com.br/gracie-barra' },
  { name: 'Seven Academia', url: 'https://webhook-whatsapp.strategicai.com.br/seven' },
  { name: 'LK3 Cursos', url: 'https://webhook-whatsapp.strategicai.com.br/lk3' },
  { name: 'Luitz Prime', url: 'https://webhook-whatsapp.strategicai.com.br/luitz-prime' },
  { name: 'Academia Flexfitness', url: 'https://webhook-whatsapp.strategicai.com.br/flexfitness' },
  { name: 'MUUVFIT - O Futuro do Fitness', url: 'https://webhook-whatsapp.strategicai.com.br/muuvfit' },
  { name: 'API oficial whatsapp', url: 'https://webhook-whatsapp.strategicai.com.br/mya-disparo-disparo' },
];

export const seedDefaultClients = async () => {
  let created = 0;
  for (const c of DEFAULT_CLIENTS) {
    const existing = await prisma.chatbotClient.findUnique({ where: { url: c.url } });
    if (existing) continue;
    await prisma.chatbotClient.create({ data: { name: c.name, url: c.url } });
    created += 1;
  }
  console.log(`[seed] default clients: ${created} created, ${DEFAULT_CLIENTS.length - created} already existed`);
};
