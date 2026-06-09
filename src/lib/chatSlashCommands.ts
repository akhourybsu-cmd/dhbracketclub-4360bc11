// DH Club — Chat slash commands (Discord parity)
//
// Applied at send-time, transforming the user's typed text into the
// final stored content. Discord's classic slash commands are pure
// text substitutions — no special server-side handling needed, which
// keeps this safely additive on top of the existing messages pipeline.
//
// Supported (in order of how Discord defines them):
//   /shrug        ¯\_(ツ)_/¯
//   /shrug <text> <text> ¯\_(ツ)_/¯
//   /tableflip    (╯°□°)╯︵ ┻━┻
//   /tableflip <text> <text> (╯°□°)╯︵ ┻━┻
//   /unflip       ┬─┬ ノ( ゜-゜ノ)
//   /unflip <text> <text> ┬─┬ ノ( ゜-゜ノ)
//   /me <text>    *<text>*   (italicised "action" via the markdown layer)
//
// Anything that doesn't match a known command passes through unchanged
// — including text that starts with "/" but isn't a registered command,
// so users discussing file paths or URLs aren't affected.

interface SlashCommand {
  /** The command name (without leading slash, case-insensitive). */
  name: string;
  /** Whether the command supports trailing text after the command word. */
  acceptsText: boolean;
  /** Transform function — receives the trailing text (may be empty). */
  transform: (rest: string) => string;
}

const COMMANDS: SlashCommand[] = [
  { name: 'shrug',     acceptsText: true,  transform: rest => rest ? `${rest} ¯\\_(ツ)_/¯` : '¯\\_(ツ)_/¯' },
  { name: 'tableflip', acceptsText: true,  transform: rest => rest ? `${rest} (╯°□°)╯︵ ┻━┻` : '(╯°□°)╯︵ ┻━┻' },
  { name: 'unflip',    acceptsText: true,  transform: rest => rest ? `${rest} ┬─┬ ノ( ゜-゜ノ)` : '┬─┬ ノ( ゜-゜ノ)' },
  // /me uses the new markdown italic layer — so "/me dances" renders
  // as "*dances*" → italicised "action" text.
  { name: 'me',        acceptsText: true,  transform: rest => rest ? `*${rest}*` : '' },
];

/** Map of command name → spec for quick lookup. */
const COMMAND_MAP = new Map(COMMANDS.map(c => [c.name, c]));

/** Public list of supported command names — useful for an
 *  autocomplete dropdown later. Returns the names without the slash. */
export const SLASH_COMMAND_NAMES: ReadonlyArray<string> = COMMANDS.map(c => c.name);

/**
 * Apply slash-command transformation to a typed message.
 *
 * If `text` begins with a recognised `/command` (followed by either
 * a space + text or end-of-string), it's transformed and returned.
 * Otherwise `text` is returned unchanged.
 */
export function applySlashCommand(text: string): string {
  if (!text || text.length < 2 || text[0] !== '/') return text;

  // Split on first whitespace: "/cmd rest of message"
  const wsIdx = text.search(/\s/);
  const cmdToken = (wsIdx === -1 ? text.slice(1) : text.slice(1, wsIdx)).toLowerCase();
  const rest = wsIdx === -1 ? '' : text.slice(wsIdx + 1).trim();

  const cmd = COMMAND_MAP.get(cmdToken);
  if (!cmd) return text;

  return cmd.transform(rest);
}
