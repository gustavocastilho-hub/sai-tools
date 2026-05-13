import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

type Client = { id: string; name: string; url: string };
type Lead = {
  phone: string; nome?: string; nicho?: string;
  msg_count: number; has_followup: boolean;
  event_id?: string; resumo?: string;
};
type Message = { role: string; content: string };
type LogEvent = { phone: string; ts: number; lines: string[] };

type LogTag = 'TOKENS' | 'TOOL' | 'CRM' | 'AUTO' | 'FOLLOWUP' | 'ERRO' | 'SKIP' | 'INFO';
type Classified = { tag: string; bucket: LogTag; tagClass: string; msgClass: string; time: string; body: string };

const TAG_STYLES: Record<LogTag, string> = {
  TOKENS:   'bg-violet-100 text-violet-700',
  TOOL:     'bg-sky-100 text-sky-700',
  CRM:      'bg-emerald-100 text-emerald-700',
  AUTO:     'bg-amber-100 text-amber-700',
  FOLLOWUP: 'bg-blue-100 text-blue-700',
  ERRO:     'bg-red-100 text-red-700',
  SKIP:     'bg-gray-100 text-gray-500',
  INFO:     'bg-gray-100 text-gray-700',
};

function stripHtml(s: string): string {
  return String(s ?? '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function classifyLine(raw: string, fallbackTs: number): Classified {
  const clean = stripHtml(raw).trim();
  const tsMatch = clean.match(/^(\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s*/);
  let body = tsMatch ? clean.slice(tsMatch[0].length) : clean;
  const time = tsMatch
    ? tsMatch[1].slice(0, 8)
    : new Date(fallbackTs * 1000).toLocaleTimeString('pt-BR', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Sao_Paulo',
      });

  const tagMatch = body.match(/^\[([A-Z_\-]+)\]\s*(.*)$/);
  if (tagMatch) {
    const raw = tagMatch[1].toUpperCase();
    body = tagMatch[2];
    let bucket: LogTag = 'INFO';
    if (raw === 'TOKENS') bucket = 'TOKENS';
    else if (raw.startsWith('TOOL')) bucket = 'TOOL';
    else if (raw === 'CRM') bucket = 'CRM';
    else if (raw === 'AUTO') bucket = 'AUTO';
    else if (raw === 'FOLLOWUP' || raw === 'FOLLOW_UP') bucket = 'FOLLOWUP';
    else if (raw === 'ERR' || raw === 'ERROR' || raw === 'ERRO') bucket = 'ERRO';
    else if (raw === 'SKIP' || raw === 'PULOU' || raw === 'IGNORADO') bucket = 'SKIP';
    return {
      tag: raw,
      bucket,
      tagClass: TAG_STYLES[bucket],
      msgClass: bucket === 'ERRO' ? 'text-red-700 font-medium' : bucket === 'SKIP' ? 'text-gray-500 italic' : 'text-gray-700',
      time,
      body,
    };
  }

  const lower = body.toLowerCase();
  if (/(erro|error|falh|exception|traceback)/i.test(lower)) {
    return { tag: 'ERRO', bucket: 'ERRO', tagClass: TAG_STYLES.ERRO, msgClass: 'text-red-700 font-medium', time, body };
  }
  if (/^nao |ignorado|pulou|skipped/i.test(lower)) {
    return { tag: 'SKIP', bucket: 'SKIP', tagClass: TAG_STYLES.SKIP, msgClass: 'text-gray-500 italic', time, body };
  }
  return { tag: 'INFO', bucket: 'INFO', tagClass: TAG_STYLES.INFO, msgClass: 'text-gray-700', time, body };
}

function summarize(lines: string[], ts: number) {
  const counts: Record<LogTag, number> = { TOKENS: 0, TOOL: 0, CRM: 0, AUTO: 0, FOLLOWUP: 0, ERRO: 0, SKIP: 0, INFO: 0 };
  lines.forEach((l) => { counts[classifyLine(l, ts).bucket] += 1; });
  return counts;
}

export function DashboardPage() {
  const nav = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [tab, setTab] = useState<'leads' | 'events'>('leads');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<LogEvent | null>(null);
  const [search, setSearch] = useState('');
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');
  const tokenRef = useRef<string | null>(null);

  const fetchAuth = (url: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${tokenRef.current}` } });

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { nav('/login'); return; }
    tokenRef.current = t;
    fetchAuth('/api/logs/clients')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setClients)
      .catch((s) => { if (s === 401 || s === 403) nav('/login'); });
  }, [nav]);

  useEffect(() => {
    if (!selectedClient) return;
    setLoadingLeads(true);
    fetchAuth(`/api/logs/${selectedClient.id}/leads`)
      .then((r) => r.json())
      .then(setLeads)
      .finally(() => setLoadingLeads(false));
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClient || tab !== 'events') return;
    let mounted = true;
    const load = () => {
      setLoadingEvents(true);
      fetchAuth(`/api/logs/${selectedClient.id}/events?limit=100`)
        .then((r) => r.json())
        .then((d) => {
          if (!mounted) return;
          setEvents(d);
          setLastRefresh(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        })
        .finally(() => { if (mounted) setLoadingEvents(false); });
    };
    load();
    const id = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [selectedClient, tab]);

  useEffect(() => {
    if (!selectedLead) return;
    fetchAuth(`/api/logs/${selectedClient?.id}/history/${selectedLead.phone}`)
      .then((r) => r.json())
      .then(setMessages);
  }, [selectedLead, selectedClient]);

  const logout = () => {
    localStorage.removeItem('token');
    nav('/login');
  };

  const filteredLeads = useMemo(() => {
    if (!search) return leads;
    const q = search.toLowerCase();
    return leads.filter((l) =>
      (l.nome || '').toLowerCase().includes(q) ||
      l.phone.includes(search) ||
      (l.nicho || '').toLowerCase().includes(q),
    );
  }, [leads, search]);

  const filteredEvents = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter((e) =>
      e.phone.includes(search) ||
      e.lines.some((l) => stripHtml(l).toLowerCase().includes(q)),
    );
  }, [events, search]);

  const fmtFull = (ts: number) =>
    new Date(ts * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const selectedEventClassified = useMemo(() => {
    if (!selectedEvent) return [];
    return selectedEvent.lines.map((l) => classifyLine(l, selectedEvent.ts));
  }, [selectedEvent]);

  const selectedEventCounts = useMemo(() => {
    if (!selectedEvent) return null;
    return summarize(selectedEvent.lines, selectedEvent.ts);
  }, [selectedEvent]);

  return (
    <div className="h-screen flex bg-gray-50 text-gray-900 overflow-hidden">
      {/* Sidebar (clientes) — estilo CRM */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        <div className="px-4 py-4 border-b border-gray-200 flex items-center gap-3">
          <img src="/favicon-sai.png" alt="SAI" className="w-8 h-8 rounded-md" />
          <div>
            <div className="text-[15px] font-bold text-gray-900 leading-tight">SAI Logs</div>
            <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Painel de execucoes</div>
          </div>
        </div>
        <div className="px-4 pt-3 pb-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
          Clientes
        </div>
        <nav className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {clients.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-400">Nenhum cliente registrado</div>
          ) : clients.map((c) => {
            const active = selectedClient?.id === c.id;
            return (
              <button
                key={c.id}
                onClick={() => { setSelectedClient(c); setSelectedLead(null); setSelectedEvent(null); setSearch(''); }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <div className="text-sm font-semibold truncate">{c.name}</div>
                <div className={`text-[11px] truncate ${active ? 'text-blue-500' : 'text-gray-400'}`}>
                  {(c.url || '').replace(/^https?:\/\//, '')}
                </div>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-gray-200">
          <button
            onClick={logout}
            className="w-full text-left text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="min-w-0">
            <h1 className="text-[17px] font-semibold text-gray-900 truncate">
              {selectedClient?.name || 'Selecione um cliente'}
            </h1>
            <div className="text-[13px] text-gray-500 truncate">
              {selectedClient ? selectedClient.url.replace(/^https?:\/\//, '') : 'Conversas e execucoes do bot em tempo real'}
            </div>
          </div>
          {tab === 'events' && selectedClient && (
            <div className="ml-auto inline-flex items-center gap-2 text-xs text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              {lastRefresh ? `atualizado ${lastRefresh}` : 'atualizando a cada 5s'}
            </div>
          )}
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Coluna central */}
          <section className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
            <div className="flex border-b border-gray-200 px-4 gap-1">
              {(['leads', 'events'] as const).map((t) => {
                const active = tab === t;
                const count = t === 'leads' ? filteredLeads.length : filteredEvents.length;
                return (
                  <button
                    key={t}
                    onClick={() => { setTab(t); setSearch(''); }}
                    className={`py-3 px-3 text-[13px] font-medium transition-colors border-b-2 ${
                      active ? 'text-blue-700 border-blue-600' : 'text-gray-500 border-transparent hover:text-gray-900'
                    }`}
                  >
                    {t === 'leads' ? 'Leads' : 'Execucoes'}
                    <span className={`ml-2 inline-block text-[11px] px-2 py-0.5 rounded-full ${
                      active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3 border-b border-gray-200">
              <input
                type="text"
                placeholder={tab === 'leads' ? 'Buscar nome, numero ou nicho...' : 'Filtrar por numero ou conteudo...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 focus:bg-white focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {!selectedClient ? (
                <div className="p-6 text-center text-sm text-gray-400">Selecione um cliente</div>
              ) : tab === 'leads' ? (
                loadingLeads && leads.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center">Carregando leads...</div>
                ) : filteredLeads.length === 0 ? (
                  <div className="p-6 text-sm text-gray-400 text-center">Nenhum lead</div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredLeads.map((l, i) => {
                      const active = selectedLead?.phone === l.phone;
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedLead(l)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                            active
                              ? 'bg-blue-50 border-blue-100'
                              : 'border-transparent hover:bg-gray-50'
                          }`}
                        >
                          <div className="text-sm font-semibold text-gray-900 truncate">{l.nome || l.phone}</div>
                          <div className="text-[12px] text-gray-500">{l.phone}</div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {l.nicho && (
                              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{l.nicho}</span>
                            )}
                            {l.event_id ? (
                              <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">Agendado</span>
                            ) : l.has_followup ? (
                              <span className="text-[10px] font-semibold bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">Follow-up</span>
                            ) : null}
                            <span className="text-[10px] font-semibold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{l.msg_count} msgs</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : (
                loadingEvents && events.length === 0 ? (
                  <div className="p-4 text-sm text-gray-400 text-center">Carregando execucoes...</div>
                ) : filteredEvents.length === 0 ? (
                  <div className="p-6 text-sm text-gray-400 text-center">Nenhuma execucao</div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredEvents.map((e, i) => {
                      const active = selectedEvent?.ts === e.ts;
                      const c = summarize(e.lines, e.ts);
                      const chips: Array<{ label: string; cls: string }> = [];
                      if (c.ERRO) chips.push({ label: `${c.ERRO} erro${c.ERRO > 1 ? 's' : ''}`, cls: 'bg-red-50 text-red-700' });
                      if (c.TOOL) chips.push({ label: `${c.TOOL} tool`, cls: 'bg-sky-50 text-sky-700' });
                      if (c.CRM) chips.push({ label: `${c.CRM} CRM`, cls: 'bg-emerald-50 text-emerald-700' });
                      if (c.FOLLOWUP) chips.push({ label: 'follow-up', cls: 'bg-blue-50 text-blue-700' });
                      return (
                        <button
                          key={i}
                          onClick={() => setSelectedEvent(e)}
                          className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                            active
                              ? 'bg-blue-50 border-blue-100'
                              : 'border-transparent hover:bg-gray-50'
                          }`}
                        >
                          <div className="text-sm font-semibold text-gray-900">{e.phone}</div>
                          <div className="text-[12px] text-gray-500">{fmtFull(e.ts)}</div>
                          {chips.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {chips.map((ch, k) => (
                                <span key={k} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ch.cls}`}>
                                  {ch.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )
              )}
            </div>
          </section>

          {/* Painel de detalhe */}
          <main className="flex-1 flex flex-col bg-gray-50 min-w-0">
            {tab === 'leads' && selectedLead ? (
              <>
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
                  <div className="text-[17px] font-semibold text-gray-900">{selectedLead.nome || selectedLead.phone}</div>
                  <div className="text-[13px] text-gray-500 mt-0.5">
                    {selectedLead.phone}
                    {selectedLead.nicho && ` · ${selectedLead.nicho}`}
                    {selectedLead.event_id ? ' · Reuniao agendada' : selectedLead.has_followup ? ' · Follow-up ativo' : ''}
                  </div>
                  {selectedLead.resumo && (
                    <div className="mt-3 bg-gray-50 border border-gray-200 border-l-4 border-l-blue-500 rounded-lg px-3.5 py-2.5 text-[13px] text-gray-700">
                      <strong className="text-gray-900">Resumo:</strong> {stripHtml(selectedLead.resumo)}
                    </div>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-3">
                  {messages.length === 0 ? (
                    <div className="text-center text-gray-400 text-sm">Sem mensagens</div>
                  ) : messages.map((m, i) => {
                    const isAi = m.role === 'ai';
                    return (
                      <div key={i} className={`flex flex-col max-w-[75%] ${isAi ? 'self-end items-end ml-auto' : ''}`}>
                        <div className="text-[11px] text-gray-400 font-medium mb-1 px-1">
                          {isAi ? (selectedClient?.name || 'Bot') : (selectedLead.nome || selectedLead.phone)}
                        </div>
                        <div className={`px-3.5 py-2.5 rounded-2xl text-[14px] leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                          isAi
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white border border-gray-200 text-gray-900 rounded-bl-md'
                        }`}>{stripHtml(m.content)}</div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : tab === 'events' && selectedEvent && selectedEventCounts ? (
              <>
                <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
                  <div className="text-[17px] font-semibold text-gray-900">{selectedEvent.phone}</div>
                  <div className="text-[13px] text-gray-500 mt-0.5">
                    {fmtFull(selectedEvent.ts)} · {selectedEvent.lines.length} linhas registradas
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 flex flex-wrap gap-6">
                    <Stat label="Eventos" value={selectedEvent.lines.length} />
                    {selectedEventCounts.ERRO > 0 && <Stat label="Erros" value={selectedEventCounts.ERRO} color="text-red-600" />}
                    {selectedEventCounts.TOOL > 0 && <Stat label="Tool calls" value={selectedEventCounts.TOOL} color="text-sky-600" />}
                    {selectedEventCounts.TOKENS > 0 && <Stat label="Tokens" value={selectedEventCounts.TOKENS} color="text-violet-600" />}
                    {selectedEventCounts.CRM > 0 && <Stat label="CRM" value={selectedEventCounts.CRM} color="text-emerald-600" />}
                    {selectedEventCounts.SKIP > 0 && <Stat label="Ignorados" value={selectedEventCounts.SKIP} color="text-gray-500" />}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {selectedEventClassified.length === 0 ? (
                      <div className="p-6 text-sm text-gray-400 text-center">Sem eventos</div>
                    ) : selectedEventClassified.map((ev, i) => (
                      <div
                        key={i}
                        className={`grid grid-cols-[80px_120px_1fr] gap-3 px-4 py-2 text-[13px] leading-relaxed items-start hover:bg-gray-50 ${
                          i < selectedEventClassified.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                      >
                        <div className="font-mono text-[12px] text-gray-400">{ev.time}</div>
                        <div>
                          <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${ev.tagClass}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-current" />
                            {ev.tag}
                          </span>
                        </div>
                        <div className={`break-words ${ev.msgClass}`}>{ev.body || <span className="text-gray-300">—</span>}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                {tab === 'leads' ? 'Escolha um lead para ver a conversa' : 'Escolha uma execucao para inspecionar'}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`text-[18px] font-bold ${color || 'text-gray-900'}`}>{value}</span>
    </div>
  );
}
