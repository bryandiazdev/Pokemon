import { describe, expect, it } from 'vitest';
import { cleanupName, extractCardName, extractCollectorNumber, type OcrLine } from './scan-ocr';

describe('extractCollectorNumber', () => {
  it('reads classic fraction numbers', () => {
    expect(extractCollectorNumber('Charizard 4/102 ©1999 Nintendo')).toBe('4');
  });

  it('strips leading zeros from zero-padded numbers', () => {
    expect(extractCollectorNumber('058/165 Illus. Kagemaru Himeno')).toBe('58');
  });

  it('keeps letter prefixes on galarian gallery numbers', () => {
    expect(extractCollectorNumber('GG44/GG70')).toBe('GG44');
    expect(extractCollectorNumber('TG13/TG30')).toBe('TG13');
    expect(extractCollectorNumber('gg04/GG70')).toBe('GG4');
  });

  it('handles slashless promo codes', () => {
    expect(extractCollectorNumber('SWSH244 Pikachu V')).toBe('SWSH244');
    expect(extractCollectorNumber('SVP 044')).toBe('SVP44');
  });

  it('tolerates OCR whitespace around the slash', () => {
    expect(extractCollectorNumber('12 / 99')).toBe('12');
  });

  it('does not treat a preceding word as a letter prefix', () => {
    expect(extractCollectorNumber('Charizard 4/102')).toBe('4');
  });

  it('returns undefined when no number is present', () => {
    expect(extractCollectorNumber('Basic Pokémon HP 120')).toBeUndefined();
  });
});

describe('cleanupName', () => {
  it('keeps a plain name', () => {
    expect(cleanupName('Charizard')).toBe('Charizard');
  });

  it('strips trailing HP readings', () => {
    expect(cleanupName('Charizard 120 HP')).toBe('Charizard');
    expect(cleanupName('Mew HP60')).toBe('Mew');
  });

  it('keeps suffixes and accents', () => {
    expect(cleanupName("Farfetch'd")).toBe("Farfetch'd");
    expect(cleanupName('Charizard ex')).toBe('Charizard ex');
  });

  it('rejects non-name card text', () => {
    expect(cleanupName('Basic Pokémon')).toBeUndefined();
    expect(cleanupName('Stage 2')).toBeUndefined();
    expect(cleanupName('Weakness ×2')).toBeUndefined();
    expect(cleanupName('HP 120')).toBeUndefined();
  });

  it('rejects OCR noise with too few letters', () => {
    expect(cleanupName('|| 4 _')).toBeUndefined();
  });
});

describe('extractCardName', () => {
  const line = (text: string, y: number, confidence = 90): OcrLine => ({ text, y, confidence });

  it('picks the prominent alphabetic line in the top band', () => {
    const name = extractCardName(
      [line('Basic', 10), line('Charizard 120 HP', 40), line('Fire Spin', 700)],
      1000,
    );
    expect(name).toBe('Charizard');
  });

  it('ignores low-confidence garbage lines', () => {
    const name = extractCardName(
      [line('wWys$ju kQzx', 30, 12), line('Pikachu', 60, 80)],
      1000,
    );
    expect(name).toBe('Pikachu');
  });

  it('ignores lines below the top band', () => {
    const name = extractCardName([line('Gust of Wind', 800)], 1000);
    expect(name).toBeUndefined();
  });
});
