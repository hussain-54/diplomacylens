import { blocksToPlainText, parseBody, stripInlineMarks, type Block } from "@/lib/blocks";

export const ARTICLE_DECK_MAX = 220;

export type ArticleExcerptSource = {
  deck?: string | null;
  meta_description?: string | null;
  body?: string | null;
};

/** Prefer deck, then SEO meta, then first body paragraph. */
export function articleExcerpt(
  article: ArticleExcerptSource,
  maxLength = ARTICLE_DECK_MAX,
): string {
  const fromDeck = article.deck?.trim();
  if (fromDeck) return clampText(fromDeck, maxLength);
  const fromMeta = article.meta_description?.trim();
  if (fromMeta) return clampText(fromMeta, maxLength);
  if (article.body) {
    const fromBody = deckFromBody(article.body, maxLength);
    if (fromBody) return fromBody;
  }
  return "";
}

export function clampText(value: string, maxLength: number): string {
  const text = value.replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/** Build a deck/summary from the first paragraph of a block body. */
export function deckFromBlocks(blocks: Block[], maxLength = ARTICLE_DECK_MAX): string {
  const paragraph = blocks.find((block) => block.type === "paragraph" && block.data.text.trim());
  if (paragraph && paragraph.type === "paragraph") {
    return clampText(stripInlineMarks(paragraph.data.text), maxLength);
  }
  const plain = blocksToPlainText(blocks).trim();
  if (!plain) return "";
  const firstSentence = plain.split(/(?<=[.!?])\s+/)[0] || plain;
  return clampText(firstSentence, maxLength);
}

export function deckFromBody(
  body: string | null | undefined,
  maxLength = ARTICLE_DECK_MAX,
): string {
  if (!body?.trim()) return "";
  return deckFromBlocks(parseBody(body), maxLength);
}
