import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentSeason } from '@/hooks/useDraftSeasons';
import { useDraftSeasonIntro } from '@/hooks/useDraftSeasonIntro';
import { DraftSeasonWelcome } from './DraftSeasonWelcome';
import { subscribeOpenSeasonWelcome } from './seasonWelcomeBus';

/**
 * Controller mounted once inside DraftArenaLayout.
 * - Auto-opens the seasonal welcome the first time the user visits any /drafts/* route
 *   during an active season they have not yet acknowledged.
 * - Listens on the seasonWelcomeBus so the HUD "Season Info" button can reopen it.
 */
export function DraftSeasonWelcomeController() {
  const { season } = useCurrentSeason();
  const { intro, acknowledged, loading, acknowledge } = useDraftSeasonIntro(season);
  const [open, setOpen] = useState(false);
  const [isFirstView, setIsFirstView] = useState(false);
  const location = useLocation();

  // Auto-show on hub route when unacknowledged + season active
  useEffect(() => {
    if (loading || !season || !intro) return;
    if (!intro.is_active) return;
    const isActiveSeason = season.status === 'regular_season' || season.status === 'playoffs' || season.status === 'upcoming';
    if (!isActiveSeason) return;
    // Only auto-show on the Draft Arena hub, not deep routes mid-draft
    if (location.pathname !== '/drafts') return;
    if (acknowledged === false) {
      setIsFirstView(true);
      setOpen(true);
    }
  }, [loading, season, intro, acknowledged, location.pathname]);

  // Manual reopen via the HUD info button
  useEffect(() => {
    return subscribeOpenSeasonWelcome(() => {
      if (!season || !intro) return;
      setIsFirstView(false);
      setOpen(true);
    });
  }, [season, intro]);

  if (!season || !intro) return null;

  return (
    <DraftSeasonWelcome
      open={open}
      season={season}
      intro={intro}
      isFirstView={isFirstView}
      onAcknowledge={async () => { await acknowledge(); }}
      onClose={() => setOpen(false)}
    />
  );
}
