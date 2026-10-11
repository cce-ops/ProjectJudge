export function truncateText(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  return { text: text.slice(0, maxChars) + '[…]', truncated: true };
}

/** Números de figura citados en un texto ("Figura 7", "Fig. 2"), ordenados y sin duplicados. */
export function findFigureCitations(text: string): number[] {
  const found = new Set<number>();
  for (const match of text.matchAll(/(?:Figura|Fig\.)\s*(\d+)/gi)) {
    const value = Number(match[1]);
    if (Number.isInteger(value) && value > 0 && value < 1000) {
      found.add(value);
    }
  }
  return [...found].sort((a, b) => a - b);
}
