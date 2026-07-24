-- Inline replies (Discord-style): a reply is a normal channel message that
-- references the message it answers. Distinct from the legacy thread model,
-- which used parent_message_id to nest replies out of the channel timeline.
--
-- reply_to_id points at the referenced message; ON DELETE SET NULL so deleting
-- the original just drops the quoted reference rather than cascading.

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

create index if not exists idx_messages_reply_to on public.messages(reply_to_id);
