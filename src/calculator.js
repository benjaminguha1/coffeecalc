const isPositiveNumber = (value) => Number.isFinite(value) && value > 0;

export const FILTER_TARGET_YIELD_GRAMS = 355;

export function roundTo(value, increment) {
  return Math.round(value / increment) * increment;
}

export function calculateDialIn({
  dose,
  yieldGrams,
  strength,
  targetStrength = 9.3,
  targetSolids = 4.41,
  brewMethod = 'espresso',
}) {
  const effectiveTargetSolids =
    brewMethod === 'filter'
      ? FILTER_TARGET_YIELD_GRAMS * (targetStrength / 100)
      : targetSolids;
  const values = {
    dose,
    yieldGrams,
    strength,
    targetStrength,
    targetSolids: effectiveTargetSolids,
  };

  if (!Object.values(values).every(isPositiveNumber)) {
    throw new RangeError(
      'All measurements and targets must be greater than zero.',
    );
  }

  const dissolvedSolids = yieldGrams * (strength / 100);
  const extractionYield = (dissolvedSolids / dose) * 100;
  const recommendedDose = effectiveTargetSolids / (extractionYield / 100);
  const recommendedYield =
    brewMethod === 'filter'
      ? FILTER_TARGET_YIELD_GRAMS
      : effectiveTargetSolids / (targetStrength / 100);

  return {
    dissolvedSolids,
    extractionYield,
    recommendedDose: roundTo(recommendedDose, 0.1),
    recommendedYield: roundTo(recommendedYield, 0.5),
  };
}

export function filterTargetSolids(targetStrength) {
  if (!isPositiveNumber(targetStrength)) {
    throw new RangeError('Target strength must be greater than zero.');
  }
  return FILTER_TARGET_YIELD_GRAMS * (targetStrength / 100);
}

export function calculateBypassWater({ beverageMass, currentTds, targetTds }) {
  const values = { beverageMass, currentTds, targetTds };
  if (!Object.values(values).every(isPositiveNumber)) {
    throw new RangeError('Mass and TDS values must be greater than zero.');
  }
  if (targetTds > currentTds) {
    throw new RangeError(
      'The target TDS must be lower than or equal to the current TDS. Water can dilute a brew, but cannot make it stronger.',
    );
  }

  return {
    addedWater: roundTo(beverageMass * (currentTds / targetTds - 1), 0.1),
  };
}

export function formatMeasurement(value, decimals = 1) {
  return Number(value).toFixed(decimals);
}
