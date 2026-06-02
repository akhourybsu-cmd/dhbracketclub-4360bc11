import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PickSuggestion {
  corrected_text: string | null;
  is_irrelevant: boolean;
  is_duplicate: boolean;
  relevance_note: string | null;
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
  const [validatedText, setValidatedText] = useState<string | null>(null);
  const [debounceScheduled, setDebounceScheduled] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inflightRef = useRef<Promise<PickSuggestion | null> | null>(null);

  const checkPick = useCallback(async (text: string): Promise<PickSuggestion | null> => {
    abortRef.current?.abort();

    const trimmed = text.trim();
    if (trimmed.length < 3) {
      setSuggestion(null);
      setValidatedText(trimmed);
      setChecking(false);
      return null;
    }

    setChecking(true);
    const controller = new AbortController();
    abortRef.current = controller;

    const run = (async (): Promise<PickSuggestion | null> => {
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
        if (error) throw error;

        const correctedText = data?.corrected_text && data.corrected_text !== 'null' ? data.corrected_text : null;
        const next: PickSuggestion | null =
          data && (correctedText || data.is_irrelevant || data.is_duplicate)
            ? { ...data, corrected_text: correctedText }
            : null;
        setSuggestion(next);
        setValidatedText(trimmed);
        return next;
      } catch {
        // Silently fail — don't block the user
        setSuggestion(null);
        setValidatedText(trimmed);
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setChecking(false);
        }
      }
    })();

    inflightRef.current = run;
    return run;
  }, [topic, category, existingPicks, aiContext, aiContextOverride]);

  const debouncedCheck = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Clear stale suggestion immediately so UI doesn't show outdated warnings
    setSuggestion(null);
    setValidatedText(null);
    setDebounceScheduled(true);
    timerRef.current = setTimeout(() => {
      setDebounceScheduled(false);
      checkPick(text);
    }, 600);
  }, [checkPick]);

  const validateNow = useCallback(async (text: string): Promise<PickSuggestion | null> => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setDebounceScheduled(false);
    const trimmed = text.trim();
    // If already validated for exactly this text and not currently checking, reuse result
    if (validatedText === trimmed && !checking) {
      return suggestion;
    }
    // If a check is in flight for the current text, await it
    if (inflightRef.current && checking) {
      const existing = await inflightRef.current;
      if (validatedText === trimmed) return existing;
    }
    return checkPick(text);
  }, [checkPick, validatedText, checking, suggestion]);

  const clearSuggestion = useCallback(() => {
    setSuggestion(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    setDebounceScheduled(false);
    abortRef.current?.abort();
  }, []);

  const isPending = checking || debounceScheduled;

  return {
    suggestion,
    checking,
    isPending,
    validatedText,
    debouncedCheck,
    validateNow,
    clearSuggestion,
  };
}
