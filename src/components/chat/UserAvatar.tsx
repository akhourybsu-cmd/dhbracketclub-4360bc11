import { useState } from 'react';

export function getUserColor(userId: string): string {
  const hue = (userId.charCodeAt(0) * 7 + userId.charCodeAt(4) * 13) % 360;
  return `hsl(${hue} 55% 48%)`;
}

export function getUserGradient(userId: string): string {
  const hue1 = (userId.charCodeAt(0) * 7 + userId.charCodeAt(4) * 13) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1} 55% 48%), hsl(${hue2} 45% 38%))`;
}

interface UserAvatarProps {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  size?: number;
  /** When true, renders a Discord-style green presence dot in the
   *  bottom-right corner of the avatar. The dot scales with avatar
   *  size and includes a ring of the surrounding bg so it reads as
   *  a status pip rather than a colour smudge. */
  isOnline?: boolean;
}

export function UserAvatar({ userId, name, avatarUrl, size = 28, isOnline }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false);
  // Pip diameter scales with avatar size — Discord uses about ~31% of
  // the avatar diameter at standard sizes; we mirror that proportion.
  const pipSize = Math.max(8, Math.round(size * 0.31));
  // Ring thickness — keeps the pip visually anchored on the avatar
  // edge instead of floating off into the page bg.
  const ringPx = Math.max(2, Math.round(size * 0.07));

  return (
    <div
      className="relative rounded-full flex items-center justify-center font-bold flex-shrink-0 text-white"
      style={{ width: size, height: size }}
    >
      <div
        className="w-full h-full rounded-full overflow-hidden flex items-center justify-center"
        style={{
          fontSize: size * 0.4,
          background: avatarUrl && !imgError ? 'transparent' : getUserGradient(userId),
        }}
      >
        {avatarUrl && !imgError ? (
          <img
            src={avatarUrl}
            alt={name}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          (name || '?')[0].toUpperCase()
        )}
      </div>
      {isOnline && (
        <span
          aria-label="Online"
          className="absolute bottom-0 right-0 rounded-full bg-success"
          style={{
            width: pipSize,
            height: pipSize,
            // Ring matches the surrounding page background so the pip
            // looks "punched into" the avatar — same trick Discord uses.
            boxShadow: `0 0 0 ${ringPx}px hsl(var(--background))`,
          }}
        />
      )}
    </div>
  );
}
