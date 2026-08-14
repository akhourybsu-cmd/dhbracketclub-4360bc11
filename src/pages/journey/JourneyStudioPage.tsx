import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, BookOpen, CheckCircle2, Download, FlaskConical, ImagePlus, Upload } from 'lucide-react';
import { JourneyLayout, JourneyError } from '@/components/journey/JourneyLayout';
import { JourneyIllustrateSheet } from '@/components/journey/JourneyIllustrateSheet';
import { useJourneyStudio, exportCampaignPackage } from '@/hooks/useJourneyStudio';
import { useJourneyLibrary } from '@/hooks/useJourneyLibrary';
import { validateCampaign } from '@/lib/journey/validate';
import { ENGINE_TEST_CAMPAIGN } from '@/lib/journey/testCampaign';
import type { CampaignPackage, CampaignRow, CampaignStatus } from '@/lib/journey/types';

/**
 * Campaign Studio — import / validate / publish / playtest.
 *
 * Authoring happens as structured campaign packages (the CDF), not as a
 * hand-built visual CMS. This page is the pipeline around those packages.
 */
export default function JourneyStudioPage() {
  const navigate = useNavigate();
  const { campaigns, loading, error, refresh, importPackage, setStatus, deleteCampaign } = useJourneyStudio();
  const { heroes, createHero, startRun } = useJourneyLibrary();
  const [raw, setRaw] = useState(() => {
    try { return localStorage.getItem('dh_journey_studio_v1') ?? ''; } catch { return ''; }
  });
  // Keep the editor contents across the reloads a backgrounded webview forces.
  useEffect(() => {
    try { localStorage.setItem('dh_journey_studio_v1', raw); } catch { /* ignore */ }
  }, [raw]);
  const [report, setReport] = useState<ReturnType<typeof validateCampaign> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [illustrate, setIllustrate] = useState<CampaignRow | null>(null);

  const parse = (): CampaignPackage | null => {
    try {
      const pkg = JSON.parse(raw) as CampaignPackage;
      setMessage(null);
      return pkg;
    } catch (e) {
      setMessage(`That is not valid JSON: ${(e as Error).message}`);
      return null;
    }
  };

  const runValidate = () => {
    const pkg = parse();
    if (pkg) setReport(validateCampaign(pkg));
  };

  const runImport = async () => {
    const pkg = parse();
    if (!pkg) return;
    const r = validateCampaign(pkg);
    setReport(r);
    if (r.errors > 0) {
      setMessage('Fix the blocking errors before importing.');
      return;
    }
    setBusy(true);
    const res = await importPackage(pkg);
    setBusy(false);
    setMessage(res
      ? `Imported ${pkg.campaign.title}: ${res.scenes} scenes, ${res.blocks} blocks, ${res.choices} choices.`
      : 'Import failed.');
  };

  const doExport = async (c: CampaignRow) => {
    const pkg = await exportCampaignPackage(c.id);
    setRaw(JSON.stringify(pkg, null, 2));
    setReport(validateCampaign(pkg));
    const im = imageStats(pkg);
    setMessage(
      im.total > 0
        ? `Exported ${c.title} — image links included: ${im.scenes} scene, ${im.portraits} portrait, ${im.inline} inline, ${im.endings} ending, ${im.cover} cover/hero (${im.total} total). Download or copy this JSON to keep them; re-importing the old file would drop them.`
        : `Exported ${c.title} into the editor above. (No uploaded images found yet.)`,
    );
  };

  const downloadRaw = () => {
    if (!raw.trim()) return;
    let name = 'campaign.json';
    try { name = `${(JSON.parse(raw)?.campaign?.slug || 'campaign')}.json`; } catch { /* keep default */ }
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const playtest = async (c: CampaignRow) => {
    setBusy(true);
    const hero = heroes[0] ?? await createHero({ name: 'Playtest Hero' });
    if (!hero) { setBusy(false); setMessage('Could not create a test hero.'); return; }
    const run = await startRun(c.id, hero.id, true);
    setBusy(false);
    if (run) navigate(`/journey/play/${run.id}`);
    else setMessage('Could not start the test run.');
  };

  return (
    <JourneyLayout chrome={false}>
      <div className="py-4">
        <header>
          <div className="jy-eyebrow">Campaign Studio</div>
          <h1 className="jy-display mt-1 text-2xl">Author's Workshop</h1>
          <p className="jy-secondary mt-1 text-sm">
            Import a campaign package, validate its structure, then playtest before publishing.
          </p>
          <div className="jy-rule mt-4" />
        </header>

        {error && <div className="mt-4"><JourneyError message={error} onRetry={refresh} /></div>}

        <section className="mt-6">
          <h2 className="jy-title text-lg">Package</h2>
          <textarea
            className="jy-input mt-2 h-64 w-full font-mono text-xs"
            spellCheck={false}
            placeholder="Paste a campaign package (JSON) here…"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="jy-btn jy-btn-ghost" onClick={runValidate} disabled={!raw.trim()}>
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Validate
            </button>
            <button className="jy-btn jy-btn-primary" onClick={runImport} disabled={!raw.trim() || busy}>
              <Upload className="h-4 w-4" aria-hidden /> {busy ? 'Working…' : 'Import'}
            </button>
            <button className="jy-btn jy-btn-ghost" onClick={downloadRaw} disabled={!raw.trim()}>
              <Download className="h-4 w-4" aria-hidden /> Download JSON
            </button>
            <button
              className="jy-btn jy-btn-ghost"
              onClick={() => { setRaw(JSON.stringify(ENGINE_TEST_CAMPAIGN, null, 2)); setReport(null); setMessage('Loaded the engine test campaign.'); }}
            >
              <FlaskConical className="h-4 w-4" aria-hidden /> Load engine test
            </button>
            <button
              className="jy-btn jy-btn-ghost"
              onClick={async () => {
                setMessage('Loading The Discovery Below…');
                try {
                  const res = await fetch('/campaigns/the-discovery-below.json');
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  const pkg = (await res.json()) as CampaignPackage;
                  setRaw(JSON.stringify(pkg, null, 2));
                  setReport(validateCampaign(pkg));
                  setMessage('Loaded The Discovery Below. Review the validation, then Import.');
                } catch (e) {
                  setMessage(`Could not load the campaign file: ${(e as Error).message}`);
                }
              }}
            >
              <BookOpen className="h-4 w-4" aria-hidden /> Load The Discovery Below
            </button>

          </div>
          {message && <p className="jy-secondary mt-3 text-sm">{message}</p>}
        </section>

        {report && (
          <section className="jy-panel mt-6 p-4">
            <h2 className="jy-eyebrow">Validation</h2>
            <p className="jy-secondary mt-1 text-sm">
              {report.stats.scenes} scenes · {report.stats.choices} choices · {report.stats.endings} endings
            </p>
            <ReportList
              label="Errors"
              items={report.issues.filter((i) => i.severity === 'error').map(issueLine)}
              tone="blood"
            />
            <ReportList
              label="Warnings"
              items={report.issues.filter((i) => i.severity === 'warning').map(issueLine)}
              tone="gold"
            />
            {report.errors === 0 && report.warnings === 0 && (
              <p className="mt-2 flex items-center gap-1.5 text-sm" style={{ color: 'hsl(150 30% 60%)' }}>
                <CheckCircle2 className="h-4 w-4" aria-hidden /> No structural problems found.
              </p>
            )}
          </section>
        )}

        <section className="mt-8">
          <h2 className="jy-title text-lg">Campaigns</h2>
          {loading ? (
            <p className="jy-muted mt-2 text-sm">Loading…</p>
          ) : campaigns.length === 0 ? (
            <p className="jy-muted mt-2 text-sm italic">No campaigns yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {campaigns.map((c) => (
                <article key={c.id} className="jy-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="jy-display text-base">{c.title}</h3>
                    <span className="jy-chip">{c.status} · v{c.version}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button className="jy-btn jy-btn-sm jy-btn-ghost" onClick={() => doExport(c)}>
                      <Download className="h-3.5 w-3.5" aria-hidden /> Export
                    </button>
                    <button className="jy-btn jy-btn-sm jy-btn-ghost" onClick={() => playtest(c)} disabled={busy}>
                      <FlaskConical className="h-3.5 w-3.5" aria-hidden /> Playtest
                    </button>
                    <button className="jy-btn jy-btn-sm jy-btn-ghost" onClick={() => setIllustrate(c)}>
                      <ImagePlus className="h-3.5 w-3.5" aria-hidden /> Illustrate
                    </button>
                    {(['draft', 'testing', 'published', 'archived'] as CampaignStatus[])
                      .filter((s) => s !== c.status)
                      .map((s) => (
                        <button key={s} className="jy-btn jy-btn-sm jy-btn-ghost" onClick={() => setStatus(c.id, s)}>
                          Mark {s}
                        </button>
                      ))}
                    <button
                      className="jy-btn jy-btn-sm jy-btn-danger"
                      onClick={() => { if (window.confirm(`Delete ${c.title} and all its content?`)) deleteCampaign(c.id); }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {illustrate && (
        <JourneyIllustrateSheet
          campaignId={illustrate.id}
          title={illustrate.title}
          onClose={() => setIllustrate(null)}
        />
      )}
    </JourneyLayout>
  );
}

/** Count the uploaded image links carried in an exported package, so an author
 *  can confirm at a glance that Export captured their art. */
function imageStats(pkg: CampaignPackage) {
  const isUrl = (v: unknown) => typeof v === 'string' && /^https?:\/\//.test(v.split('#')[0]);
  let scenes = 0;
  let inline = 0;
  let portraits = 0;
  let endings = 0;
  let cover = 0;
  if (isUrl((pkg.campaign as any)?.cover_image)) cover += 1;
  if (isUrl((pkg.campaign as any)?.hero_image)) cover += 1;
  for (const s of (pkg.scenes ?? []) as any[]) {
    if (isUrl(s.background_asset)) scenes += 1;
    for (const b of (s.blocks ?? []) as any[]) {
      if (b.block_type === 'image' && isUrl(b.metadata?.src)) inline += 1;
    }
  }
  for (const n of (pkg.npcs ?? []) as any[]) if (isUrl(n.portrait)) portraits += 1;
  for (const e of (pkg.endings ?? []) as any[]) if (isUrl(e.artwork)) endings += 1;
  return { scenes, inline, portraits, endings, cover, total: scenes + inline + portraits + endings + cover };
}

/** One readable line per validation issue, scoped to its scene/choice. */
function issueLine(i: { message: string; scene_key?: string; choice_key?: string }) {
  const where = [i.scene_key, i.choice_key].filter(Boolean).join(' → ');
  return where ? `${where}: ${i.message}` : i.message;
}

function ReportList({ label, items, tone }: { label: string; items: string[]; tone: 'blood' | 'gold' }) {
  if (items.length === 0) return null;
  const color = tone === 'blood' ? 'hsl(var(--jy-blood))' : 'hsl(var(--jy-gold))';
  return (
    <div className="mt-3">
      <h3 className="flex items-center gap-1.5 text-sm" style={{ color }}>
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {label} ({items.length})
      </h3>
      <ul className="jy-secondary mt-1 space-y-1 text-xs">
        {items.map((m, i) => <li key={i}>· {m}</li>)}
      </ul>
    </div>
  );
}
