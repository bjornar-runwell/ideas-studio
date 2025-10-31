'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Channel = 'LinkedIn' | 'Facebook' | 'Instagram' | 'YouTube' | 'Any';
type CTA = 'None' | 'Soft' | 'Trial' | 'LeadGen' | 'Community';
type Length = 'Short' | 'Medium' | 'Long';

interface TemplateBox {
  id: string;
  name: string;
  purpose: string;
  tone: string;
  audience: string;
  formats: string;
  guardrails: string;
  basePrompt: string;
  examples?: string;
  tags: string[];
  channel: Channel;
}

interface ProviderSettings {
  endpoint: string;
  apiKey: string;
  model: string;
  useMock: boolean;
}

interface GenerationRequest {
  templateId: string;
  nIdeas: number;
  length: Length;
  cta: CTA;
  angle?: string;
}

interface Generation {
  id: string;
  templateId: string;
  createdAt: number;
  request: GenerationRequest;
  ideas: string[];
}

interface RunwellContext {
  brandVoice: string;
  mission: string;
  differentiator: string;
  about?: string;
}

const uid = () => Math.random().toString(36).slice(2);
const LS_KEY = 'runwell.ideas.studio.v3';

const defaultContext: RunwellContext = {
  brandVoice: 'Witty/funny, profesjonell, teknisk når nødvendig, men relatable. Norsk, kort og tydelig.',
  mission: 'Bli #1 app for internkontroll og drift i hotell- og serveringsbransjen i Skandinavia og UK.',
  differentiator: 'Enkel, morsom, god UX. Mattrygghet og drift (HACCP, avvik, onboarding, inspeksjon).',
  about: '',
};

const defaultTemplates: TemplateBox[] = [
  { id: uid(), name: 'Dagens kaffeprat', purpose: 'Lavterskel miniprater fra kontoret om drift, rutiner og gjesteopplevelse.', tone: 'Lett, nysgjerrig, hyggelig.', audience: 'Daglige ledere og restaurantsjefer i Norge.', formats: 'Reels 20-45s, LinkedIn tekst + bilde, YouTube Shorts', guardrails: 'Ingen teknisk sjargong. Ingen em-dash. Spør publikum på slutten.', basePrompt: 'Lag konkrete kort-idéer som er TEMAFORSLAG til serien. Avslutt gjerne med et spørsmål.', examples: 'Hva er den største tabben restauranter gjør?; Hva skjer når Mattilsynet kommer på besøk?; Hva kan en typisk HMS-tabbe være?', tags: ['serie','kaffe','kontor'], channel: 'Any' },
  { id: uid(), name: 'Nye funksjoner', purpose: 'Presenter nye funksjoner og hvorfor de betyr noe for brukeren.', tone: 'Optimistisk, konkret, uten hype.', audience: 'Eksisterende og potensielle kunder.', formats: 'Karusell 4-6 slides, 20-40s skjermopptak, LinkedIn post', guardrails: 'Vis, ikke skryt. Et konkret før/etter. Ingen em-dash.', basePrompt: 'Beskriv problemet, vis løsningen kort, og en enkel call-to-action til slutt.', examples: '', tags: ['produkt','release'], channel: 'Any' },
  { id: uid(), name: 'Tips og triks i Runwell', purpose: 'Små lifehacks i appen som sparer tid.', tone: 'Hjelpsom, vennlig, effektiv.', audience: 'Kjøkken- og driftspersonell, ledere.', formats: 'Reels 15-30s, skjermopptak, GIF', guardrails: 'Ett tips per post. Vis steg. Ingen em-dash.', basePrompt: 'Gi klare steg-for-steg med 1 konkret gevinst.', examples: '', tags: ['howto','tips'], channel: 'Any' },
  { id: uid(), name: 'Fun fact fra serveringsbransjen', purpose: 'Underholdende innsikter som trigger deling og samtale.', tone: 'Lett og nerde-vennlig.', audience: 'Alle i bransjen.', formats: 'Karusell, kortvideo, statisk post', guardrails: 'Sjekk fakta. Ingen em-dash. Unngå pekefinger.', basePrompt: 'En morsom/overraskende fact med kort forklaring og hvorfor det betyr noe i praksis.', examples: '', tags: ['funfact','deling'], channel: 'Any' },
  { id: uid(), name: 'FAQ', purpose: 'Svar på vanlige spørsmål om Runwell kort og tydelig.', tone: 'Tydelig, trygg, kort.', audience: 'Potensielle kunder og nye brukere.', formats: 'Tekstpost, kortvideo Q&A', guardrails: 'Ett spørsmål per post. Ingen em-dash.', basePrompt: 'Gi svaret i 2–4 setninger + ett eksempel.', examples: '', tags: ['faq','support'], channel: 'Any' },
  { id: uid(), name: 'Ny kunde', purpose: 'Kundeannounce som fremhever kundens styrker og hvorfor de valgte Runwell.', tone: 'Varm, respektfull, kundefokusert.', audience: 'Hele nettverket.', formats: 'Foto + tekst, kortvideo, LinkedIn post', guardrails: 'Ikke salgspreget. Vis sitat om mulig. Ingen em-dash.', basePrompt: 'Fortell om kunden, hva de er gode på, og én konkret forbedring Runwell hjelper med.', examples: '', tags: ['kunde','suksess'], channel: 'Any' },
  { id: uid(), name: 'Ny partner', purpose: 'Fremhev samarbeid og felles verdi for brukerne.', tone: 'Proff, positiv, konkret.', audience: 'Kunder, partnere, kandidater.', formats: 'Foto + tekst, karusell, kortvideo', guardrails: 'Ikke buzzwords. Vis hva brukerne faktisk får. Ingen em-dash.', basePrompt: 'Hva gjør partneren, hvorfor passer vi sammen, og hva er første gevinst for kunden?', examples: '', tags: ['partner','økosystem'], channel: 'Any' },
];

function saveToLS(data: any) { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
function loadFromLS(): { templates: TemplateBox[]; gens: Generation[]; provider: ProviderSettings; context: RunwellContext } {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) throw new Error('no cache');
    return JSON.parse(raw);
  } catch {
    return { templates: defaultTemplates, gens: [], provider: { endpoint: '', apiKey: '', model: '', useMock: true }, context: defaultContext };
  }
}

// Helpers
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function mockIdeas(req: GenerationRequest, t: TemplateBox, ctx: RunwellContext): string[] {
  const base = `${t.name} · ${req.length}${req.cta !== 'None' ? ` · CTA:${req.cta}` : ''}${req.angle ? ` · Vinkel:${req.angle}` : ''}`;
  const pool = [
    `Tema: Hva er den største tabben restauranter gjør? (${base})`,
    `Tema: Hva skjer når Mattilsynet kommer på besøk? (${base})`,
    `Tema: Typiske HMS-tabber og hvordan unngå dem (${base})`,
    `Tema: Før/etter – en rutine som sparer tid (${base})`,
    `Tema: Myte vs. virkelighet i drift (${base})`,
    `Tema: Ukas rutine – en ting som sparer tid (${base})`,
    `Tema: Sitat fra kunde/partner + læring (${base})`,
    `Tema: 3 steg for bedre internkontroll (${base})`,
    `Tema: Vanlige avvik og raske fiks (${base})`,
    `Tema: Sjekkliste før rush (${base})`,
  ];
  const n = Math.min(Math.max(req.nIdeas, 1), 20);
  return shuffle(pool).slice(0, n);
}

export default function Page() {
  const [templates, setTemplates] = useState<TemplateBox[]>([]);
  const [gens, setGens] = useState<Generation[]>([]);
  const [provider, setProvider] = useState<ProviderSettings>({ endpoint: '', apiKey: '', model: '', useMock: true });
  const [context, setContext] = useState<RunwellContext>(defaultContext);

  useEffect(() => {
    const { templates, gens, provider, context } = loadFromLS();
    setTemplates(templates); setGens(gens); setProvider(provider); setContext(context);
  }, []);
  useEffect(() => { saveToLS({ templates, gens, provider, context }); }, [templates, gens, provider, context]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const active = useMemo(() => templates.find(t => t.id === activeId) ?? templates[0], [templates, activeId]);

  const [detailsOpen, setDetailsOpen] = useState(false);

  // Generator
  const [nIdeas, setNIdeas] = useState(6);
  const [length, setLength] = useState<Length>('Short');
  const [cta, setCTA] = useState<CTA>('None');
  const [angle, setAngle] = useState('');
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState(false);

  function createTemplate() {
    const t: TemplateBox = { id: uid(), name: 'Ny mal', purpose: '', tone: '', audience: '', formats: '', guardrails: '', basePrompt: '', examples: '', tags: [], channel: 'Any' };
    setTemplates(prev => [t, ...prev]); setActiveId(t.id); setDetailsOpen(true);
  }
  function deleteTemplate(id: string) {
    setTemplates(prev => prev.filter(t => t.id !== id)); if (active?.id === id) { setActiveId(null); setDetailsOpen(false); }
  }
  function updateActive<K extends keyof TemplateBox>(key: K, value: TemplateBox[K]) {
    if (!active) return; setTemplates(prev => prev.map(t => t.id === active.id ? { ...t, [key]: value } : t));
  }
  function clearHistory() { setGens([]); }

  async function onGenerate() {
    if (!active) return;
    setLoading(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 450);
    try {
      const req: GenerationRequest = { templateId: active.id, nIdeas, length, cta, angle: angle || undefined };
      const ideas = mockIdeas(req, active, context);
      const g: Generation = { id: uid(), templateId: active.id, createdAt: Date.now(), request: req, ideas };
      setGens(prev => [g, ...prev]);
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white/70 backdrop-blur-lg border-b">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="font-semibold text-slate-900 tracking-[-0.01em]">Runwell Ideas Studio</div>
          <div className="flex items-center gap-2 text-sm">
            <button onClick={() => {
              const blob = new Blob([JSON.stringify({ templates, gens, context }, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'runwell-ideas-studio.json'; a.click(); URL.revokeObjectURL(url);
            }} className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50">Eksporter</button>
            <label className="px-3 py-1.5 rounded-md border bg-white hover:bg-slate-50 cursor-pointer">
              <input type="file" accept="application/json" className="hidden" onChange={(e)=>{
                const file = e.target.files?.[0]; if(!file) return;
                const reader = new FileReader();
                reader.onload = ()=>{
                  try{
                    const data = JSON.parse(String(reader.result));
                    if (data.templates) setTemplates(data.templates);
                    if (data.gens) setGens(data.gens);
                    if (data.context) setContext(data.context);
                  }catch{ alert('Kunne ikke lese filen'); }
                };
                reader.readAsText(file);
              }} />
              Importer
            </label>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border shadow-soft p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Maler</h2>
              <button onClick={createTemplate} className="px-3 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800">Ny</button>
            </div>
            <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} onClick={()=>{ setActiveId(t.id); }} className={`p-2 rounded-xl border cursor-pointer ${active?.id===t.id?'bg-white border-slate-300':'bg-slate-100 border-transparent'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.channel}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={(e)=>{ e.stopPropagation(); setTemplates(prev=>[{...t, id: uid(), name: t.name+' (kopi)'}, ...prev]); }} className="text-slate-500 hover:text-slate-900 text-sm">Kopier</button>
                      <button onClick={(e)=>{ e.stopPropagation(); deleteTemplate(t.id); }} className="text-red-500 hover:text-red-700 text-sm">Slett</button>
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-600 truncate">{t.tags.slice(0,3).join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main */}
        <div className="lg:col-span-3 space-y-6">
          {/* Context */}
          <div className="bg-white rounded-2xl border shadow-soft p-6">
            <h2 className="text-xl font-semibold mb-2">Runwell‑kontekst</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Stemning/voice</label>
                <textarea className="w-full border rounded-lg p-2" value={context.brandVoice} onChange={e=>setContext(c=>({...c, brandVoice: e.target.value}))}></textarea>
              </div>
              <div className="space-y-2">
                <label className="text-xs text-slate-500">Mission</label>
                <textarea className="w-full border rounded-lg p-2" value={context.mission} onChange={e=>setContext(c=>({...c, mission: e.target.value}))}></textarea>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs text-slate-500">Differensiering</label>
                <textarea className="w-full border rounded-lg p-2" value={context.differentiator} onChange={e=>setContext(c=>({...c, differentiator: e.target.value}))}></textarea>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs text-slate-500">Om Runwell</label>
                <textarea className="w-full border rounded-lg p-2" placeholder="Kort om Runwell (hvem vi hjelper, hva vi gjør, hvorfor det betyr noe)" value={context.about ?? ''} onChange={e=>setContext(c=>({...c, about: e.target.value}))}></textarea>
              </div>
            </div>
          </div>

          {/* Template editor with collapsible */}
          {active && (
            <div className="bg-white rounded-2xl border shadow-soft p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{active.name}</h2>
                  <div className="text-xs text-slate-500">{active.channel}</div>
                </div>
                <button onClick={()=>setDetailsOpen(o=>!o)} className="px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50 text-sm">
                  {detailsOpen ? 'Skjul detaljer' : 'Vis detaljer'}
                </button>
              </div>

              <AnimatePresence initial={false}>
                {detailsOpen and (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">Navn</label>
                        <input className="w-full border rounded-lg p-2" value={active.name} onChange={e=>updateActive('name', e.target.value)} />
                        <label className="text-xs text-slate-500">Formål</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.purpose} onChange={e=>updateActive('purpose', e.target.value)}></textarea>
                        <label className="text-xs text-slate-500">Tone</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.tone} onChange={e=>updateActive('tone', e.target.value)}></textarea>
                        <label className="text-xs text-slate-500">Målgruppe</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.audience} onChange={e=>updateActive('audience', e.target.value)}></textarea>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs text-slate-500">Formater</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.formats} onChange={e=>updateActive('formats', e.target.value)}></textarea>
                        <label className="text-xs text-slate-500">Guardrails</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.guardrails} onChange={e=>updateActive('guardrails', e.target.value)}></textarea>
                        <label className="text-xs text-slate-500">Kanal</label>
                        <select className="w-full border rounded-lg p-2" value={active.channel} onChange={e=>updateActive('channel', e.target.value as Channel)}>
                          {['Any','LinkedIn','Facebook','Instagram','YouTube'].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <label className="text-xs text-slate-500">Eksempler</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.examples || ''} onChange={e=>updateActive('examples', e.target.value)}></textarea>
                        <label className="text-xs text-slate-500">Kjerne‑prompt</label>
                        <textarea className="w-full border rounded-lg p-2" value={active.basePrompt} onChange={e=>updateActive('basePrompt', e.target.value)}></textarea>
                        <label className="text-xs text-slate-500">Tags (kommaseparert)</label>
                        <input className="w-full border rounded-lg p-2" value={active.tags.join(', ')} onChange={e=>updateActive('tags', e.target.value.split(',').map(s=>s.trim()).filter(Boolean))} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Generator */}
          <div className="bg-white rounded-2xl border shadow-soft p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Generer ideer</h2>
              <div className="flex items-center gap-2">
                <button onClick={clearHistory} className="px-3 py-1.5 rounded-xl border bg-white hover:bg-slate-50 text-sm">Tøm historikk</button>
                <div className="relative">
                  <motion.div animate={flash ? { boxShadow: '0 0 0 8px rgba(59,130,246,0.15)' } : { boxShadow: '0 0 0 0 rgba(0,0,0,0)' }} transition={{ type: 'tween', duration: 0.45 }} className="rounded-2xl">
                    <button onClick={onGenerate} disabled={!active || loading} className="rounded-2xl px-5 py-2 bg-slate-900 text-white hover:bg-slate-800">
                      <motion.span whileTap={{ scale: 0.98 }} className="inline-flex items-center">{loading ? 'Genererer…' : 'Generer'}</motion.span>
                    </button>
                  </motion.div>
                </div>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="text-xs text-slate-500">Mal</label>
                <input readOnly className="w-full border rounded-lg p-2 bg-slate-50" value={active?.name || 'Velg en mal i listen'} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Antall</label>
                <input type="number" min={1} max={20} className="w-full border rounded-lg p-2" value={nIdeas} onChange={e=>setNIdeas(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-slate-500">Lengde</label>
                <select className="w-full border rounded-lg p-2" value={length} onChange={e=>setLength(e.target.value as Length)}>
                  {['Short','Medium','Long'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-3">
              <div>
                <label className="text-xs text-slate-500">CTA</label>
                <select className="w-full border rounded-lg p-2" value={cta} onChange={e=>setCTA(e.target.value as CTA)}>
                  {['None','Soft','Trial','LeadGen','Community'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Vinkel/kampanje</label>
                <input className="w-full border rounded-lg p-2" placeholder="eks. juletrafikk, ny funksjon, case" value={angle} onChange={e=>setAngle(e.target.value)} />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex gap-2 text-sm mb-2">
                <button className="px-3 py-1.5 rounded-lg border bg-slate-900 text-white">Siste</button>
                <button className="px-3 py-1.5 rounded-lg border bg-white">Historikk</button>
              </div>
              {gens.length === 0 ? (
                <p className="text-sm text-slate-500">Ingen genereringer enda. Velg en mal og trykk Generer.</p>
              ) : (
                <ul className="list-disc pl-5 space-y-2">
                  {gens[0].ideas.map((idea, i) => <li key={i} className="text-sm leading-6">{idea}</li>)}
                </ul>
              )}
              {gens.length > 1 && (
                <div className="space-y-3 mt-4">
                  {gens.slice(1).map(g => (
                    <div key={g.id} className="border rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-sm text-slate-600">{new Date(g.createdAt).toLocaleString()}</div>
                        <button onClick={()=>navigator.clipboard.writeText(g.ideas.join('\n\n'))} className="text-xs px-2 py-1 rounded-md border bg-white hover:bg-slate-50">Kopier</button>
                      </div>
                      <ul className="list-disc pl-5 space-y-1">
                        {g.ideas.map((idea, i) => <li key={i} className="text-sm">{idea}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
