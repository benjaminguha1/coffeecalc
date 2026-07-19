const isPositiveNumber = (value) => Number.isFinite(value) && value > 0;

export function roundTo(value, increment) {
  return Math.round(value / increment) * increment;
}

export function calculateDialIn({
  dose,
  yieldGrams,
  strength,
  targetStrength = 9.3,
  targetSolids = 4.41,
}) {
  const values = { dose, yieldGrams, strength, targetStrength, targetSolids };

  if (!Object.values(values).every(isPositiveNumber)) {
    throw new RangeError(
      'All measurements and targets must be greater than zero.',
    );
  }

  const dissolvedSolids = yieldGrams * (strength / 100);
  const extractionYield = (dissolvedSolids / dose) * 100;
  const recommendedDose = targetSolids / (extractionYield / 100);
  const recommendedYield = targetSolids / (targetStrength / 100);

  return {
    dissolvedSolids,
    extractionYield,
    recommendedDose: roundTo(recommendedDose, 0.1),
    recommendedYield: roundTo(recommendedYield, 0.5),
  };
}

export function formatMeasurement(value, decimals = 1) {
  return Number(value).toFixed(decimals);
}
