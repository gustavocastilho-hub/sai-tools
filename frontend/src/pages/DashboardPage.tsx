import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

type Client = { id: string; name: string; url: string };
type Lead = {
  phone: string; nome?: string; nicho?: string;
  msg_count: number; has_followup: boolean;
  event_id?: string; resumo?: string;
};
type Message = { role: string; content: string };
type LogEvent = { phone: string; ts: number; lines: string[] };

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
  const tokenRef = useRef<string | null>(null);

  const fetchAuth = (url: string) => fetch(url, {
    headers: { Authorization: `Bearer ${tokenRef.current}` },
  });

  useEffect(() => {
    const t = localStorage.getItem('token');
    if (!t) { nav('/login'); return; }
    tokenRef.current = t;
    fetchAuth('/api/logs/clients')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setClients)
      .catch((s) => { if (s === 401 || s === 403) nav('/login'); });
  }, [nav]);

  useEffect(() => {
    if (!selectedClient) return;
    setLoadingLeads(true);
    fetchAuth(`/api/logs/${selectedClient.id}/leads`)
      .then(r => r.json())
      .then(setLeads)
      .finally(() => setLoadingLeads(false));
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedClient || tab !== 'events') return;
    let mounted = true;
    const load = () => {
      setLoadingEvents(true);
      fetchAuth(`/api/logs/${selectedClient.id}/events?limit=100`)
        .then(r => r.json())
        .then(d => { if (mounted) setEvents(d); })
        .finally(() => { if (mounted) setLoadingEvents(false); });
    };
    load();
    const id = setInterval(load, 5000);
    return () => { mounted = false; clearInterval(id); };
  }, [selectedClient, tab]);

  useEffect(() => {
    if (!selectedLead) return;
    fetchAuth(`/api/logs/${selectedClient?.id}/history/${selectedLead.phone}`)
      .then(r => r.json())
      .then(setMessages);
  }, [selectedLead, selectedClient]);

  const logout = () => {
    localStorage.removeItem('token');
    nav('/login');
  };

  const filteredLeads = !search ? leads : leads.filter(l =>
    (l.nome || '').toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search) ||
    (l.nicho || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredEvents = !search ? events : events.filter(e =>
    e.phone.includes(search) ||
    e.lines.some(l => l.toLowerCase().includes(search.toLowerCase()))
  );

  const fmtTime = (ts: number) => {
    const d = new Date(ts * 1000);
    return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  };

  const lineClass = (line: string) => {
    if (line.startsWith('[TOKENS]')) return 'text-purple-700 font-bold';
    if (line.startsWith('[TOOL')) return 'text-sky-700 font-bold';
    if (line.startsWith('[CRM]')) return 'text-emerald-700 font-bold';
    if (line.startsWith('[AUTO]')) return 'text-amber-700 font-bold';
    if (line.startsWith('[FOLLOWUP]')) return 'text-blue-700 font-bold';
    if (/erro|error|falh/i.test(line)) return 'text-red-700 font-bold';
    return 'text-gray-700';
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      <header className="bg-indigo-900 text-white px-5 py-3 flex justify-between items-center shadow">
        <h1 className="text-lg font-semibold">SAI Logs Dashboard</h1>
        <button onClick={logout} className="text-sm px-3 py-1 bg-indigo-700 hover:bg-indigo-600 rounded">
          Sair
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Painel 1: Clientes */}
        <aside className="w-52 bg-indigo-900 text-white flex flex-col">
          <div className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wide text-indigo-300 border-b border-indigo-800">
            Clientes
          </div>
          <div className="flex-1 overflow-y-auto">
            {clients.length === 0 ? (
              <div className="p-3 text-xs text-indigo-300">Nenhum cliente registrado</div>
            ) : clients.map(c => (
              <button
                key={c.id}
                onClick={() => { setSelectedClient(c); setSelectedLead(null); setSelectedEvent(null); }}
                className={`w-full text-left px-3 py-2 border-b border-indigo-800 hover:bg-indigo-800 ${
                  selectedClient?.id === c.id ? 'bg-indigo-600' : ''
                }`}
              >
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-[11px] text-indigo-300 truncate">{c.url}</div>
              </button>
            ))}
          </div>
        </aside>

        {/* Painel 2: Leads/Eventos */}
        <section className="w-64 bg-white border-r flex flex-col">
          <div className="flex border-b">
            <button
              className={`flex-1 py-2 text-xs font-medium ${
                tab === 'leads' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
              }`}
              onClick={() => setTab('leads')}
            >Leads</button>
            <button
              className={`flex-1 py-2 text-xs font-medium ${
                tab === 'events' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-500'
              }`}
              onClick={() => setTab('events')}
            >Execuções</button>
          </div>
          <div className="p-2 border-b">
            <input
              type="text"
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {!selectedClient ? (
              <div className="p-4 text-sm text-gray-400 text-center">Selecione um cliente</div>
            ) : tab === 'leads' ? (
              loadingLeads ? <div className="p-4 text-sm text-gray-400">Carregando...</div>
              : filteredLeads.length === 0 ? <div className="p-4 text-sm text-gray-400 text-center">Nenhum lead</div>
              : filteredLeads.map((l, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedLead(l)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${
                    selectedLead?.phone === l.phone ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="text-sm font-medium">{l.nome || l.phone}</div>
                  <div className="text-xs text-gray-500">{l.phone}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {l.nicho && <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">{l.nicho}</span>}
                    {l.event_id ? <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">Agendado</span>
                      : l.has_followup && <span className="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Follow-up</span>}
                    <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{l.msg_count} msgs</span>
                  </div>
                </button>
              ))
            ) : (
              loadingEvents && events.length === 0 ? <div className="p-4 text-sm text-gray-400">Carregando...</div>
              : filteredEvents.length === 0 ? <div className="p-4 text-sm text-gray-400 text-center">Nenhuma execução</div>
              : filteredEvents.map((e, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedEvent(e)}
                  className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 ${
                    selectedEvent?.ts === e.ts ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className="text-sm font-semibold">{e.phone}</div>
                  <div className="text-[11px] text-gray-400">{fmtTime(e.ts)}</div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Painel 3: Detalhes */}
        <main className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
          {tab === 'leads' && selectedLead ? (
            <>
              <div className="bg-white border-b p-4">
                <div className="font-semibold">{selectedLead.nome || selectedLead.phone}</div>
                <div className="text-sm text-gray-500">{selectedLead.phone}</div>
                {selectedLead.resumo && (
                  <div className="mt-2 bg-gray-50 border rounded p-2 text-xs text-gray-700">
                    <strong>Resumo:</strong> {selectedLead.resumo}
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-sm">Sem mensagens</div>
                ) : messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'ai' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm whitespace-pre-wrap ${
                      m.role === 'ai' ? 'bg-indigo-600 text-white' : 'bg-white border'
                    }`}>{m.content}</div>
                  </div>
                ))}
              </div>
            </>
          ) : tab === 'events' && selectedEvent ? (
            <>
              <div className="bg-white border-b p-4">
                <div className="font-semibold">{selectedEvent.phone}</div>
                <div className="text-sm text-gray-500">{fmtTime(selectedEvent.ts)}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-white">
                {selectedEvent.lines.map((line, i) => (
                  <div key={i} className={lineClass(line)}>{line}</div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              {tab === 'leads' ? 'Selecione um lead' : 'Selecione uma execução'}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
