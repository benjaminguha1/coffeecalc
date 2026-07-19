import { describe, expect, it } from 'vitest';
import { calculateDialIn, formatMeasurement, roundTo } from './calculator.js';

describe('calculateDialIn', () => {
  it('calculates extraction and the recommended recipe', () => {
    const result = calculateDialIn({
      dose: 18,
      yieldGrams: 40,
      strength: 9.3,
      targetStrength: 9.3,
      targetSolids: 4.41,
    });

    expect(result.dissolvedSolids).toBeCloseTo(3.72);
    expect(result.extractionYield).toBeCloseTo(20.6667);
    expect(result.recommendedDose).toBe(21.3);
    expect(result.recommendedYield).toBe(47.5);
  });

  it('uses the standard target values when targets are omitted', () => {
    const result = calculateDialIn({ dose: 20, yieldGrams: 45, strength: 10 });

    expect(result.recommendedYield).toBe(47.5);
    expect(result.recommendedDose).toBe(19.6);
  });

  it.each([0, -1, Number.NaN])(
    'rejects an invalid measurement of %s',
    (dose) => {
      expect(() =>
        calculateDialIn({
          dose,
          yieldGrams: 40,
          strength: 9.3,
          targetStrength: 9.3,
          targetSolids: 4.41,
        }),
      ).toThrow(RangeError);
    },
  );
});

describe('formatting helpers', () => {
  it('rounds values to a supplied increment', () => {
    expect(roundTo(41.24, 0.5)).toBe(41);
    expect(roundTo(41.26, 0.5)).toBe(41.5);
  });

  it('formats a measurement to a fixed precision', () => {
    expect(formatMeasurement(18)).toBe('18.0');
    expect(formatMeasurement(9.3, 2)).toBe('9.30');
  });
});
