import { useEffect, useMemo, useState } from 'react';
import { journeyMotes, sceneAtmosphere } from '@/lib/journey/atmosphere';
import { useJourneySettings } from './useJourneySettings';

/**
 * Fixed backdrop layer behind the reading surface. Cross-fades between scenes
 * so a change of place is felt before it is read, then keeps the air alive: the
 * glow breathes slowly and a field of ambient motes (embers, glints, or dust,
 * chosen by the scene's mood) drifts through it. Purely decorative: it never
 * intercepts pointer events and never sits above the text. Motion is dropped
 * entirely when the player has reduced motion on.
 */
export function SceneAtmosphere({
  backgroundAsset, sceneType, sceneKey, imageSrc,
}: {
  backgroundAsset?: string | null;
  sceneType?: string | null;
  sceneKey?: string | null;
  imageSrc?: string | null;
}) {
  const { reducedMotion } = useJourneySettings();
  const atmos = sceneAtmosphere(backgroundAsset, sceneType);
  const [visible, setVisible] = useState(false);

  const motes = useMemo(
    () => (reducedMotion ? [] : journeyMotes(atmos.mood, sceneKey ?? backgroundAsset ?? '')),
    [reducedMotion, atmos.mood, sceneKey, backgroundAsset],
  );

  useEffect(() => {
    setVisible(false);
    const t = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(t);
  }, [sceneKey, backgroundAsset]);

  return (
    <div aria-hidden className="jy-atmos" data-visible={visible ? 'true' : 'false'}>
      <div
        className={`jy-atmos-layer${reducedMotion ? '' : ' jy-atmos-breathe'}`}
        style={{ background: atmos.background }}
      />
      {imageSrc && (
        <div
          className="jy-atmos-layer jy-atmos-art"
          style={{ backgroundImage: `url(${imageSrc})` }}
        />
      )}
      {motes.length > 0 && (
        <div className="jy-motes" data-mood={atmos.mood}>
          {motes.map((m, i) => (
            <span
              key={i}
              className="jy-mote"
              style={{
                left: `${m.left}%`,
                top: `${m.top}%`,
                width: m.size,
                height: m.size,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ['--jy-op' as any]: m.opacity,
                ['--jy-delay' as any]: `${m.delay}s`,
                ['--jy-dur' as any]: `${m.duration}s`,
                ['--jy-drift' as any]: `${m.drift}px`,
              }}
            />
          ))}
        </div>
      )}
      <div className="jy-atmos-vignette" />
    </div>
  );
}
