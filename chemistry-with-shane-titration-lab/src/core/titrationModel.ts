import { generateTitrationCurve_StrongStrong } from "./utils";

/**
 * Model state for titration.
 */
export interface TitrationParams {
  analyteConc: number;
  analyteVol: number;
  titrantConc: number;
  titrantVol: number;
  titrantVolMax: number;
}

export interface TitrationData {
  volumes: number[];
  pHs: number[];
}

export class TitrationModel {
  params: TitrationParams;

  constructor(params: TitrationParams) {
    this.params = params;
  }

  updateTitrantVol(v: number) {
    this.params.titrantVol = v;
  }

  computeCurve(numPoints = 200): TitrationData {
    const { analyteConc, analyteVol, titrantConc, titrantVolMax } =
      this.params;
    return generateTitrationCurve_StrongStrong(
      analyteConc,
      analyteVol,
      titrantConc,
      titrantVolMax,
      numPoints
    );
  }

  getCurrentPH(): number {
    const { analyteConc, analyteVol, titrantConc, titrantVol } = this.params;
    return generateTitrationCurve_StrongStrong(
      analyteConc,
      analyteVol,
      titrantConc,
      titrantVol,
      1
    ).pH[1];
  }
}

