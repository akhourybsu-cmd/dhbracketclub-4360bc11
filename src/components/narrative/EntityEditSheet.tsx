// DH Club — Narrative RPG · Reusable entity edit sheet
//
// One sheet handles editing every GM-managed entity type: NPCs, Clues,
// Items, Factions, Clocks. The caller passes a `schema` describing the
// fields. Each schema entry maps a column name + label + input kind +
// visibility (e.g. gm_only fields hide from a non-GM caller, though
// this component is only rendered for GMs in practice).
//
// Why one sheet? Adding new entity types stays one schema entry instead
// of a new sheet file. The shape is intentionally simple: text inputs,
// textareas, selects, numbers, and a visibility toggle. Anything more
// complex than that earns its own dedicated component.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Loader2, Trash2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

export type FieldKind = 'text' | 'textarea' | 'number' | 'select' | 'visibility' | 'attitude';

export interface FieldSchema {
  column: string;
  label: string;
  kind: FieldKind;
  placeholder?: string;
  /** Options for `select`. */
  options?: Array<{ value: string; label: string }>;
  /** Min/max for `number`. */
  min?: number;
  max?: number;
  /** GM-only label vs visible to all (used purely for UI grouping). */
  gmOnly?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Table name in Supabase (must be one of the narrative_* tables). */
  table: string;
  /** Friendly label for the header ("Edit NPC", "Edit clue"…). */
  entityLabel: string;
  /** Row data — id is required for update, omitted for new. */
  row: Record<string, unknown> & { id?: string };
  schema: FieldSchema[];
  /** Called after save / delete success. */
  onSaved?: () => void;
}

export function EntityEditSheet({ open, onClose, table, entityLabel, row, schema, onSaved }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(row);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => { if (open) { setValues(row); setConfirmingDelete(false); } }, [open, row]);

  const setField = (col: string, v: unknown) => setValues(prev => ({ ...prev, [col]: v }));

  const save = async () => {
    setBusy(true);
    try {
      // Pick only the fields the schema mentions (ignore stray data).
      const patch: Record<string, unknown> = {};
      for (const f of schema) patch[f.column] = values[f.column];
      let error: { message: string } | null = null;
      if (row.id) {
        const r = await (supabase as any).from(table).update(patch).eq('id', row.id);
        error = r.error;
      } else {
        const r = await (supabase as any).from(table).insert(patch);
        error = r.error;
      }
      if (error) {
        toast.error(`Save failed: ${error.message}`);
        return;
      }
      toast.success('Saved.');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!row.id) { onClose(); return; }
    setBusy(true);
    try {
      const { error } = await (supabase as any).from(table).delete().eq('id', row.id);
      if (error) {
        toast.error(`Delete failed: ${error.message}`);
        return;
      }
      toast.success('Deleted.');
      onSaved?.();
      onClose();
    } catch (e) {
      toast.error(`Delete failed: ${(e as Error).message ?? 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[75] flex items-end justify-center"
      style={{ background: 'hsl(218 50% 3% / 0.65)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 12, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92dvh] rounded-t-2xl flex flex-col overflow-hidden bg-card border border-border/40"
        style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/25">
          <h2 className="text-[14px] font-extrabold tracking-tight">{entityLabel}</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg bg-muted/40 active:scale-90 flex items-center justify-center">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {schema.map(f => (
            <FieldRow key={f.column} field={f} value={values[f.column]} onChange={v => setField(f.column, v)} />
          ))}
        </div>

        <div className="px-4 py-3 border-t border-border/25 flex items-center gap-2">
          {row.id && (
            confirmingDelete ? (
              <button
                onClick={remove}
                disabled={busy}
                className="h-11 px-3 rounded-xl bg-destructive/15 border border-destructive/40 text-destructive text-[11px] font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Confirm delete
              </button>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="w-11 h-11 rounded-xl bg-muted/40 border border-border/40 text-muted-foreground/70 flex items-center justify-center disabled:opacity-50"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )
          )}
          <button
            onClick={save}
            disabled={busy}
            className="flex-1 h-11 rounded-xl text-[12px] font-extrabold inline-flex items-center justify-center gap-1.5 active:scale-[0.98] transition disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary) / 0.85))', color: 'hsl(var(--primary-foreground))' }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

function FieldRow({ field, value, onChange }: { field: FieldSchema; value: unknown; onChange: (v: unknown) => void }) {
  const labelEl = (
    <Label className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/70 flex items-center gap-1.5">
      {field.label}
      {field.gmOnly && <span className="text-[9px] font-extrabold text-warning uppercase">GM only</span>}
    </Label>
  );

  if (field.kind === 'text') {
    return (
      <div>
        {labelEl}
        <Input value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className="mt-1.5 h-10" />
      </div>
    );
  }
  if (field.kind === 'textarea') {
    return (
      <div>
        {labelEl}
        <Textarea value={(value as string) ?? ''} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} rows={3} className="mt-1.5 text-[12.5px]" />
      </div>
    );
  }
  if (field.kind === 'number') {
    return (
      <div>
        {labelEl}
        <Input
          type="number"
          value={typeof value === 'number' ? value : Number(value ?? 0)}
          min={field.min}
          max={field.max}
          onChange={e => onChange(Number(e.target.value))}
          className="mt-1.5 h-10"
        />
      </div>
    );
  }
  if (field.kind === 'select') {
    return (
      <div>
        {labelEl}
        <select
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          className="mt-1.5 w-full h-10 rounded-md border border-border/40 bg-card px-2 text-[12.5px]"
        >
          {(field.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }
  if (field.kind === 'visibility') {
    const v = (value as string) ?? 'public';
    return (
      <div>
        {labelEl}
        <div className="mt-1.5 grid grid-cols-2 gap-2">
          {(['public', 'gm_only'] as const).map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`h-10 rounded-md text-[11px] font-extrabold uppercase tracking-wider border ${v === opt ? 'bg-primary/15 text-primary border-primary/40' : 'bg-card border-border/40 text-muted-foreground/75'}`}
            >
              {opt === 'public' ? 'Public' : 'GM only'}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (field.kind === 'attitude') {
    // free-form short text, but with a couple of quick chips
    const v = (value as string) ?? '';
    const presets = ['Friendly', 'Cordial', 'Suspicious', 'Hostile', 'Loyal', 'Neutral'];
    return (
      <div>
        {labelEl}
        <Input value={v} onChange={e => onChange(e.target.value)} placeholder={field.placeholder} className="mt-1.5 h-10" />
        <div className="mt-1.5 flex flex-wrap gap-1">
          {presets.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={`h-7 px-2 rounded-md text-[10px] font-bold uppercase tracking-wider border ${v === p ? 'bg-primary/15 text-primary border-primary/40' : 'bg-muted/30 border-border/40 text-muted-foreground/70'}`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

/* ── Schemas for each entity type ────────────────────────────── */

export const NPC_SCHEMA: FieldSchema[] = [
  { column: 'name',         label: 'Name',         kind: 'text',       placeholder: 'NPC name' },
  { column: 'role',         label: 'Role',         kind: 'text',       placeholder: 'e.g. Studio fixer' },
  { column: 'description',  label: 'Description',  kind: 'textarea',   placeholder: 'Who they are' },
  { column: 'location',     label: 'Current location', kind: 'text' },
  { column: 'visibility',   label: 'Visibility',   kind: 'visibility' },
  { column: 'voice_notes',  label: 'Voice / tone notes', kind: 'textarea', placeholder: 'How they speak', gmOnly: true },
  { column: 'motives',      label: 'Motives',      kind: 'textarea',   gmOnly: true },
  { column: 'secrets',      label: 'Secrets',      kind: 'textarea',   gmOnly: true },
];

export const CLUE_SCHEMA: FieldSchema[] = [
  { column: 'name',         label: 'Clue name',    kind: 'text' },
  { column: 'description',  label: 'Description',  kind: 'textarea' },
  { column: 'importance',   label: 'Importance',   kind: 'select', options: [
      { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' },
  ]},
  { column: 'status',       label: 'Status',       kind: 'select', options: [
      { value: 'discovered', label: 'Discovered' },
      { value: 'partial',    label: 'Partially understood' },
      { value: 'solved',     label: 'Solved' },
      { value: 'false_lead', label: 'False lead' },
  ]},
  { column: 'visibility',   label: 'Visibility',   kind: 'visibility' },
];

export const ITEM_SCHEMA: FieldSchema[] = [
  { column: 'name',         label: 'Item name',    kind: 'text' },
  { column: 'description',  label: 'Description',  kind: 'textarea' },
  { column: 'use_notes',    label: 'Mechanical / story use', kind: 'textarea', gmOnly: true },
  { column: 'visibility',   label: 'Visibility',   kind: 'visibility' },
];

export const FACTION_SCHEMA: FieldSchema[] = [
  { column: 'name',                label: 'Faction name',         kind: 'text' },
  { column: 'description',         label: 'Description',          kind: 'textarea' },
  { column: 'attitude',            label: 'Attitude',             kind: 'attitude' },
  { column: 'relationship_score',  label: 'Relationship (-100 to 100)', kind: 'number', min: -100, max: 100 },
  { column: 'suspicion_score',     label: 'Suspicion (0–100)',    kind: 'number', min: 0, max: 100 },
  { column: 'public_notes',        label: 'Public notes',         kind: 'textarea' },
  { column: 'gm_notes',            label: 'GM notes',             kind: 'textarea', gmOnly: true },
  { column: 'visibility',          label: 'Visibility',           kind: 'visibility' },
];

export const CLOCK_SCHEMA: FieldSchema[] = [
  { column: 'name',          label: 'Clock name',  kind: 'text' },
  { column: 'description',   label: 'Description', kind: 'textarea' },
  { column: 'max_value',     label: 'Max value (2–20)', kind: 'number', min: 2, max: 20 },
  { column: 'current_value', label: 'Current value', kind: 'number', min: 0, max: 20 },
  { column: 'clock_type',    label: 'Type',        kind: 'select', options: [
      { value: 'danger', label: 'Danger' }, { value: 'opportunity', label: 'Opportunity' },
      { value: 'mystery', label: 'Mystery' }, { value: 'faction', label: 'Faction' },
      { value: 'custom', label: 'Custom' },
  ]},
  { column: 'visibility',    label: 'Visibility',  kind: 'visibility' },
];

export const LOCATION_SCHEMA: FieldSchema[] = [
  { column: 'name',         label: 'Name',        kind: 'text' },
  { column: 'description',  label: 'Description', kind: 'textarea' },
  { column: 'region',       label: 'Region',      kind: 'text' },
  { column: 'visibility',   label: 'Visibility',  kind: 'visibility' },
];

export const SCENE_SCHEMA: FieldSchema[] = [
  { column: 'title',        label: 'Scene title', kind: 'text' },
  { column: 'location',     label: 'Location',    kind: 'text' },
  { column: 'objective',    label: 'Objective',   kind: 'text' },
  { column: 'stakes',       label: 'Stakes',      kind: 'text' },
  { column: 'public_notes', label: 'Public notes', kind: 'textarea' },
  { column: 'gm_notes',     label: 'GM notes',    kind: 'textarea', gmOnly: true },
];
