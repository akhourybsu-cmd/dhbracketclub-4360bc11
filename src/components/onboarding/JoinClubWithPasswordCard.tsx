import { useState } from 'react';
import { KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Lets a signed-in user finish (or start) club enrollment by entering the club
 * password. The password lives only in component state for the duration of the
 * submit — it is never written to localStorage, sessionStorage, cookies, the
 * URL, user metadata, or any log/analytics payload.
 */
export function JoinClubWithPasswordCard({ onJoined }: { onJoined: () => void | Promise<void> }) {
  const [clubPassword, setClubPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = clubPassword.trim();
    if (!value) {
      toast.error('Enter the club password your admin gave you');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.rpc('join_club_with_password', { _password: value });
      if (error) {
        // Never echo the password back in the error surface.
        toast.error(error.message || 'Could not join that club. Try again.');
        return;
      }
      setClubPassword('');
      toast.success("You're in!");
      await onJoined();
    } catch {
      toast.error('Something went wrong joining that club. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'hsl(var(--primary) / 0.14)' }}
        >
          <KeyRound className="w-4 h-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold">Have a club password?</p>
          <p className="text-[11px] text-muted-foreground">Enter it to join an existing club instantly.</p>
        </div>
      </div>
      <Input
        value={clubPassword}
        onChange={(e) => setClubPassword(e.target.value)}
        placeholder="Club password"
        className="form-input"
        autoComplete="off"
        name="club-password"
      />
      <Button type="submit" variant="outline" className="w-full h-11 font-bold rounded-xl btn-press" disabled={submitting}>
        {submitting ? 'Joining…' : 'Join club'}
      </Button>
    </form>
  );
}
