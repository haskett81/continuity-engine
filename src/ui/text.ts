/**
 * Strips HTML tags from a ProseMirror-authored HTMLField value. ProseMirror
 * leaves empty content as markup like "<p></p>" rather than "", so this is
 * needed for both emptiness checks (KnowledgeModel's divergence calc) and
 * Cockpit preview text.
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

/** Truncates plain text to a max length for compact Cockpit row previews. */
export function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}
