import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Shield, Trophy, Target, Users, Sparkles, Infinity as InfinityIcon, Crosshair,
} from 'lucide-react';
import { useNexusProgress } from '@/hooks/useNexusProgress';
import { useResolvedMissions } from '@/hooks/useMissionCalibrations';
import { useActiveOperation } from '@/hooks/useNexusOperation';
import { ENDLESS_MISSION_ID } from '@/lib/nexus/endless';
import { ContinueRunBanner } from '@/components/nexus/ContinueRunBanner';
import { FeaturedMissionCard } from '@/components/nexus/FeaturedMissionCard';
import { ModeCard } from '@/components/nexus/ModeCard';

export default function NexusHomePage() {
  const { progress } = useNexusProgress();
  const { missions } = useResolvedMissions();
  const campaign = missions.filter(m => m.id !== ENDLESS_MISSION_ID);
  const totalMissions = campaign.length;
  const cleared = Math.max(0, Math.min(progress.highest_mission - 1, totalMissions));
  const sectorPct = totalMissions > 0 ? Math.round((cleared / totalMissions) * 100) : 0;
  const { operation } = useActiveOperation();

  // Status copy for the three primary mode cards
  const opPhase = operation?.current_phase ?? null;
  const opAllies = operation?.total_contributors ?? 0;
  const opStatus = operation
    ? `PHASE ${opPhase} · ${opAllies} ALL${opAllies === 1 ? 'Y' : 'IES'}`
    : 'STANDBY · NO ACTIVE OP';

  const campaignStatus = `SECTOR I · ${cleared}/${totalMissions} CLEARED`;
  const endlessStatus = 'INFINITE WAVES · LEADERBOARD';

  return (
    <div className="max-w-md mx-auto pb-6">
      {/* ───── Command panel hero ───── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden mt-2 mb-3 nx-clip nx-bracket"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 25% 15%, hsl(188 70% 22% / 0.55), transparent 60%),' +
            'linear-gradient(160deg, hsl(218 50% 10%), hsl(220 60% 5%))',
          border: '1px solid hsl(var(--nx-cyan) / 0.4)',
          boxShadow:
            '0 0 24px -8px hsl(var(--nx-cyan) / 0.55), inset 0 1px 0 hsl(var(--nx-cyan) / 0.18)',
        }}
      >
        {/* Decorative grid */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none opacity-[0.12]"
          style={{
            backgroundImage:
              'linear-gradient(hsl(var(--nx-cyan)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--nx-cyan)) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
            maskImage: 'radial-gradient(ellipse 70% 70% at 80% 50%, black, transparent 80%)',
            WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 80% 50%, black, transparent 80%)',
          }}
        />
        {/* Glow halo */}
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full" style={{ background: 'hsl(188 92% 56% / 0.18)', filter: 'blur(40px)' }} />

        <div className="relative p-5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="nx-pulse-dot inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'hsl(var(--nx-cyan))', boxShadow: '0 0 6px hsl(var(--nx-cyan))' }} />
            <p className="nx-title text-[9px]" style={{ color: 'hsl(var(--nx-cyan))' }}>
              OUTER RIM · COMMAND DECK
            </p>
          </div>
          <h1 className="text-3xl font-black text-foreground mb-1.5 tracking-tight">Nexus Defense</h1>
          <p className="text-xs text-foreground/65 mb-4 max-w-[280px] leading-relaxed">
            Defend the energy core. Engineer your grid. Survive the swarm.
          </p>

          {/* Tactical readouts: Cores · Cleared · Sector progress */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Readout
              label="CORES"
              value={progress.cores}
              accent="hsl(var(--nx-amber))"
              icon="⚡"
            />
            <Readout
              label="CLEARED"
              value={`${cleared}/${totalMissions}`}
              accent="hsl(150 80% 70%)"
              icon={<Trophy className="w-2.5 h-2.5" />}
            />
            <Readout
              label="SECTOR"
              value={`${sectorPct}%`}
              accent="hsl(var(--nx-cyan))"
              icon={<Crosshair className="w-2.5 h-2.5" />}
            />
          </div>

          {/* Sector progress bar */}
          <div className="h-1 rounded-full overflow-hidden mb-1" style={{ background: 'hsl(0 0% 100% / 0.06)' }}>
            <motion.div
              className="h-full"
              style={{
                background: 'linear-gradient(90deg, hsl(var(--nx-cyan)), hsl(150 80% 60%))',
                boxShadow: '0 0 6px hsl(var(--nx-cyan) / 0.5)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${sectorPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </motion.div>

      {/* Continue in-flight run if any */}
      <ContinueRunBanner />

      {/* Featured operation (rotates daily) */}
      <FeaturedMissionCard campaign={campaign} highestMission={progress.highest_mission} />

      {/* Three primary mode cards */}
      <h2 className="nx-title text-[9px] mb-2 mt-4" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
        ◢ OPERATION MODES
      </h2>
      <div className="space-y-2 mb-4">
        <ModeCard
          to="/nexus/missions"
          title="Solo Campaign"
          subtitle="Six missions. Escalating waves. One Siege Mech."
          status={campaignStatus}
          icon={<Target className="w-5 h-5" />}
          accent="hsl(var(--nx-cyan))"
          tags={['Sector I', 'Boss Mission', 'Modifiers']}
          tone="solid"
          cta="PLAY"
        />
        <ModeCard
          to={`/nexus/loadout/${ENDLESS_MISSION_ID}`}
          title="Endless Defense"
          subtitle="Survive as long as you can. Beat your best."
          status={endlessStatus}
          icon={<InfinityIcon className="w-5 h-5" />}
          accent="hsl(var(--nx-amber))"
          tags={['Solo', 'Best Score', 'Bosses 5+']}
          tone="solid"
          cta="DEPLOY"
        />
        <ModeCard
          to="/nexus/operation"
          title="Co-op Operation"
          subtitle={
            operation
              ? `${operation.name} — team up to push all three phases.`
              : 'Team up with your club. Stand by for the next op.'
          }
          status={opStatus}
          liveStatus={!!operation}
          icon={<Users className="w-5 h-5" />}
          accent="hsl(280 90% 78%)"
          tags={operation ? ['Active', 'Three Phases', 'Allies'] : ['Standby', 'Three Phases', 'Club']}
          tone={operation ? 'solid' : 'ghost'}
          cta="OPEN HUB"
        />
      </div>

      {/* Secondary nav tiles */}
      <h2 className="nx-title text-[9px] mb-2" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.22em' }}>
        ◢ SUPPORT SYSTEMS
      </h2>
      <div className="grid grid-cols-3 gap-2">
        <NavTile
          to="/nexus/sigils"
          icon={<Sparkles className="w-4 h-4" />}
          label="Sigil Vault"
          accent="hsl(45 100% 70%)"
          borderColor="hsl(45 100% 60% / 0.35)"
        />
        <NavTile
          to="/nexus/leaderboard"
          icon={<Trophy className="w-4 h-4" />}
          label="Leaderboard"
          accent="hsl(150 80% 70%)"
          borderColor="hsl(150 80% 60% / 0.35)"
        />
        <NavTile
          to="/nexus/codex"
          icon={<Shield className="w-4 h-4" />}
          label="Codex"
          accent="hsl(var(--nx-cyan))"
          borderColor="hsl(var(--nx-cyan) / 0.3)"
        />
      </div>

    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────── */

function Readout({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  accent: string;
  icon: React.ReactNode | string;
}) {
  return (
    <div
      className="nx-clip-sm px-2.5 py-2"
      style={{
        background: 'hsl(218 35% 7%)',
        border: `1px solid ${accent.replace(')', ' / 0.3)')}`,
      }}
    >
      <div className="flex items-center justify-between">
        <span
          className="nx-title text-[8px]"
          style={{ color: accent.replace(')', ' / 0.85)') }}
        >
          {label}
        </span>
        <span className="text-[9px]" style={{ color: accent }}>
          {icon}
        </span>
      </div>
      <div
        className="text-base font-black tabular-nums leading-none mt-0.5"
        style={{ color: accent }}
      >
        {value}
      </div>
    </div>
  );
}

function NavTile({
  to,
  icon,
  label,
  accent = 'hsl(var(--nx-cyan))',
  borderColor = 'hsl(var(--nx-cyan) / 0.2)',
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  accent?: string;
  borderColor?: string;
}) {
  return (
    <Link
      to={to}
      className="aspect-square nx-clip-sm flex flex-col items-center justify-center gap-1.5 active:scale-95 transition"
      style={{
        background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
        border: `1px solid ${borderColor}`,
        boxShadow: 'inset 0 1px 0 hsl(0 0% 100% / 0.04)',
      }}
    >
      <span style={{ color: accent }}>{icon}</span>
      <span className="nx-title text-[9px]">{label}</span>
    </Link>
  );
}

