import { describe, expect, it } from 'vitest';
import {
  calculateBypassWater,
  calculateDialIn,
  filterTargetSolids,
  formatMeasurement,
  roundTo,
} from './calculator.js';

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

  it('keeps filter recommendations at a 355 g brewed-beverage yield', () => {
    const first = calculateDialIn({
      brewMethod: 'filter',
      dose: 20,
      yieldGrams: 250,
      strength: 1.4,
      targetStrength: 1.35,
      targetSolids: 3.375,
    });
    const strongerTarget = calculateDialIn({
      brewMethod: 'filter',
      dose: 20,
      yieldGrams: 250,
      strength: 1.4,
      targetStrength: 1.5,
      targetSolids: 99,
    });

    expect(first.recommendedYield).toBe(355);
    expect(strongerTarget.recommendedYield).toBe(355);
    expect(first.dissolvedSolids).toBeCloseTo(3.5);
    expect(filterTargetSolids(1.35)).toBeCloseTo(4.7925);
    expect(strongerTarget.recommendedDose).toBeGreaterThan(
      first.recommendedDose,
    );
  });
});

describe('calculateBypassWater', () => {
  it('calculates the water needed to dilute a filter brew', () => {
    expect(
      calculateBypassWater({
        beverageMass: 250,
        currentTds: 1.5,
        targetTds: 1.25,
      }).addedWater,
    ).toBe(50);
  });

  it('returns zero when the brew already matches the target', () => {
    expect(
      calculateBypassWater({
        beverageMass: 250,
        currentTds: 1.35,
        targetTds: 1.35,
      }).addedWater,
    ).toBe(0);
  });

  it('rejects a target stronger than the current brew', () => {
    expect(() =>
      calculateBypassWater({
        beverageMass: 250,
        currentTds: 1.2,
        targetTds: 1.4,
      }),
    ).toThrow('cannot make it stronger');
  });
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
