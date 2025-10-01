export interface Preset {
  name: string;
  analyteConcentration: number; // mol/L
  titrantConcentration: number;
  analyteVolume: number; // in L
  titrantVolumeMax: number; // in L
}

export const presets: Preset[] = [
  {
    name: "HCl + NaOH (0.1 M)",
    analyteConcentration: 0.1,
    titrantConcentration: 0.1,
    analyteVolume: 0.025,
    titrantVolumeMax: 0.025,
  },
  {
    name: "HCl + NaOH (0.05 M)",
    analyteConcentration: 0.05,
    titrantConcentration: 0.05,
    analyteVolume: 0.025,
    titrantVolumeMax: 0.05,
  },
];

