import React from "react";
import { Preset, presets } from "../data/presets";

interface ControlsProps {
  params: {
    analyteConc: number;
    analyteVol: number;
    titrantConc: number;
    titrantVol: number;
    titrantVolMax: number;
  };
  onParamChange: (key: keyof ControlsProps["params"], value: number) => void;
  onPresetSelect: (preset: Preset) => void;
  onExportCSV: () => void;
}

const Controls: React.FC<ControlsProps> = ({
  params,
  onParamChange,
  onPresetSelect,
  onExportCSV,
}) => {
  return (
    <div className="controls">
      <label>
        Select preset:
        <select
          value={presets.findIndex((p) => p.name === params.analyteConc.toString())}
          onChange={(e) => {
            const idx = parseInt(e.target.value);
            onPresetSelect(presets[idx]);
          }}
        >
          {presets.map((p, i) => (
            <option key={i} value={i}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        Titrant added (mL): { (params.titrantVol * 1000).toFixed(2) }
        <input
          type="range"
          min="0"
          max={(params.titrantVolMax * 1000).toString()}
          step="0.1"
          value={(params.titrantVol * 1000).toString()}
          onChange={(e) => {
            const val = parseFloat(e.target.value) / 1000;
            onParamChange("titrantVol", val);
          }}
        />
      </label>

      <button onClick={onExportCSV}>Export CSV</button>
    </div>
  );
};

export default Controls;

