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

/**
 * Spell-check / relevance assistant for draft picks.
 *
 * COST NOTE: the AI check ("check-draft-pick") used to fire on a 600ms debounce
 * on every keystroke, which meant many Lovable-AI-gateway calls per pick. It now
 * fires AT MOST ONCE per pick — only when the user submits — via `runCheck`.
 * The instant, deterministic duplicate check (`localDuplicate`) stays free and
 * runs on every keystroke, so obvious dupes are still caught with zero AI cost.
 */
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
  // The last text we actually ran the AI check on — lets a second submit of the
  // same text proceed without re-calling the model.
  const checkedRef = useRef<string | null>(null);
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

  // Track the input text for the free local dup check. NO AI call here.
  const setText = useCallback((text: string) => {
    setCurrentText(text);
    // Any edit invalidates a prior AI check and clears the advisory banner.
    if (checkedRef.current !== null && checkedRef.current !== text.trim()) {
      checkedRef.current = null;
    }
    setSuggestion(null);
  }, []);

  // Has this exact text NOT been AI-checked yet? (submit gate helper)
  const needsCheck = useCallback((text: string) => checkedRef.current !== text.trim(), []);

  // Fire the AI check exactly once for `text`. Returns the resulting suggestion
  // (or null if nothing actionable / AI unavailable). Only call this at submit.
  const runCheck = useCallback(async (text: string): Promise<PickSuggestion | null> => {
    const trimmed = text.trim();
    if (trimmed.length < 3) {
      checkedRef.current = trimmed;
      return null;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setChecking(true);

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

      if (controller.signal.aborted) return null;
      // Mark as checked regardless of outcome so we never loop on the same text.
      checkedRef.current = trimmed;

      // Errors (rate limit, AI turned off → 403, network) are non-blocking:
      // the check is advisory, so we silently allow the pick through.
      if (error) {
        setSuggestion(null);
        return null;
      }

      const correctedText = data?.corrected_text && data.corrected_text !== 'null' ? data.corrected_text : null;
      const next: PickSuggestion | null =
        data && (correctedText || data.is_irrelevant || data.is_duplicate)
          ? { ...data, corrected_text: correctedText }
          : null;
      setSuggestion(next);
      return next;
    } catch {
      checkedRef.current = trimmed;
      setSuggestion(null);
      return null;
    } finally {
      if (!controller.signal.aborted) setChecking(false);
    }
  }, [topic, category, existingPicks, aiContext, aiContextOverride]);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    abortRef.current?.abort();
  }, []);

  return {
    suggestion,
    checking,
    localDuplicate,
    setText,
    runCheck,
    needsCheck,
    clearSuggestion,
  };
}
