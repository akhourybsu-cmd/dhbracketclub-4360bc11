import { useState, useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PickSuggestion {
  corrected_text: string | null;
  is_irrelevant: boolean;
  is_duplicate: boolean;
  relevance_note: string | null;
}

// Match the edge function's normalization so client + server agree on duplicates.
function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

export function usePickSuggestion(
  topic: string,
  category: string | null,
  existingPicks: string[],
  aiContext?: string | null,
  aiContextOverride?: string | null,
) {
  const [suggestion, setSuggestion] = useState<PickSuggestion | null>(null);
  const [checking, setChecking] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const normalizedExisting = useMemo(
    () => existingPicks.map(normalize).filter(Boolean),
    [existingPicks],
  );

  // Instant, deterministic duplicate check — no AI required.
  const localDuplicate = useMemo(() => {
    const n = normalize(currentText);
    return n.length > 0 && normalizedExisting.includes(n);
  }, [currentText, normalizedExisting]);

  const checkPick = useCallback(async (text: string) => {
    abortRef.current?.abort();
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setSuggestion(null);
      setChecking(false);
      return;
    }

    setChecking(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data, error } = await supabase.functions.invoke('check-draft-pick', {
        body: {
          pick_text: trimmed,
          topic,
          category,
          existing_picks: existingPicks,
          ai_context: aiContext || null,
          ai_context_override: aiContextOverride || null,
        },
      });

      if (controller.signal.aborted) return;
      if (error) throw error;

      const correctedText = data?.corrected_text && data.corrected_text !== 'null' ? data.corrected_text : null;
      const next: PickSuggestion | null =
        data && (correctedText || data.is_irrelevant || data.is_duplicate)
          ? { ...data, corrected_text: correctedText }
          : null;
      setSuggestion(next);
    } catch {
      // Silently fail — AI is advisory, never blocks the user.
      setSuggestion(null);
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }, [topic, category, existingPicks, aiContext, aiContextOverride]);

  const debouncedCheck = useCallback((text: string) => {
    setCurrentText(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    // Clear stale suggestion immediately so UI doesn't show outdated warnings
    setSuggestion(null);
    timerRef.current = setTimeout(() => {
      checkPick(text);
    }, 600);
  }, [checkPick]);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    abortRef.current?.abort();
  }, []);

  return {
    suggestion,
    checking,
    localDuplicate,
    debouncedCheck,
    clearSuggestion,
  };
}
