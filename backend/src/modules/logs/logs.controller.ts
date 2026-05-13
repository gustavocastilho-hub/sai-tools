import { Request, Response } from 'express';
import { LogsService } from './logs.service';

const service = new LogsService();

export const getClients = async (_req: Request, res: Response) => {
  res.json(await service.getClients());
};

export const registerWebhook = async (req: Request, res: Response) => {
  const { name, url } = req.body || {};
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  res.json(await service.registerClient(name, url));
};

export const getLeads = async (req: Request, res: Response) => {
  res.json(await service.getLeads(req.params.clientId));
};

export const getHistory = async (req: Request, res: Response) => {
  res.json(await service.getHistory(req.params.clientId, req.params.phone));
};

export const getEvents = async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  res.json(await service.getEvents(req.params.clientId, limit));
};
