/**
 * Compute pH for strong acid + strong base titration.
 * 
 * analyteConc = initial H⁺ concentration (mol/L)
 * analyteVol = initial volume (L)
 * titrantConc = concentration of base (mol/L)
 * titrantVol = volume of base added (L)
 * 
 * returns pH (number)
 */
export function computePH_StrongStrong(
  analyteConc: number,
  analyteVol: number,
  titrantConc: number,
  titrantVol: number
): number {
  // total moles of H⁺ initially:
  const molesH = analyteConc * analyteVol;
  // total moles of OH added:
  const molesOH = titrantConc * titrantVol;
  const volTotal = analyteVol + titrantVol;

  const net = molesH - molesOH;
  if (net > 0) {
    // excess H⁺
    const concH = net / volTotal;
    return -Math.log10(concH);
  } else if (net < 0) {
    // excess OH⁻
    const concOH = -net / volTotal;
    const concH = 1e-14 / concOH;
    return -Math.log10(concH);
  } else {
    // equivalence: neutral water (pH = 7 at 25°C), approximated
    return 7.0;
  }
}

/**
 * Generate a titration curve (array of points) for strong/strong titration.
 */
export function generateTitrationCurve_StrongStrong(
  analyteConc: number,
  analyteVol: number,
  titrantConc: number,
  titrantVolMax: number,
  numPoints = 200
): { volume: number[]; pH: number[] } {
  const volumes: number[] = [];
  const pHs: number[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const v = (i / numPoints) * titrantVolMax;
    volumes.push(v);
    pHs.push(
      computePH_StrongStrong(analyteConc, analyteVol, titrantConc, v)
    );
  }
  return { volume: volumes, pH: pHs };
}

