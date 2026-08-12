import { useEffect, useState } from 'react';
import { sceneAtmosphere } from '@/lib/journey/atmosphere';

/**
 * Fixed backdrop layer behind the reading surface. Cross-fades between scenes
 * so a change of place is felt before it is read. Purely decorative: it never
 * intercepts pointer events and never sits above the text.
 */
export function SceneAtmosphere({
  backgroundAsset, sceneType, sceneKey, imageSrc,
}: {
  backgroundAsset?: string | null;
  sceneType?: string | null;
  sceneKey?: string | null;
  imageSrc?: string | null;
}) {
  const atmos = sceneAtmosphere(backgroundAsset, sceneType);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const t = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(t);
  }, [sceneKey, backgroundAsset]);

  return (
    <div aria-hidden className="jy-atmos" data-visible={visible ? 'true' : 'false'}>
      <div className="jy-atmos-layer" style={{ background: atmos.background }} />
      {imageSrc && (
        <div
          className="jy-atmos-layer jy-atmos-art"
          style={{ backgroundImage: `url(${imageSrc})` }}
        />
      )}
      <div className="jy-atmos-vignette" />
    </div>
  );
}
