import { describe, it, expect } from 'vitest';
import { truncateText } from './text';

describe('truncateText', () => {
  it('truncates text to maxChars and adds a marker', () => {
    const result = truncateText('abcdef', 3);
    expect(result).toEqual({ text: 'abc[…]', truncated: true });
  });

  it('does not truncate text below the limit', () => {
    const result = truncateText('abc', 5);
    expect(result).toEqual({ text: 'abc', truncated: false });
  });

  it('handles empty strings', () => {
    const result = truncateText('', 5);
    expect(result).toEqual({ text: '', truncated: false });
  });
});
