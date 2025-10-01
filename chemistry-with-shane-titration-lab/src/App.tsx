import React, { useState, useEffect } from "react";
import Apparatus from "./components/Apparatus";
import Controls from "./components/Controls";
import Graph from "./components/Graph";
import { TitrationModel } from "./core/titrationModel";
import { Preset, presets } from "./data/presets";
import { saveAs } from "file-saver";

const App: React.FC = () => {
  const defaultPreset = presets[0];

  const [params, setParams] = useState({
    analyteConc: defaultPreset.analyteConc,
    analyteVol: defaultPreset.analyteVolume,
    titrantConc: defaultPreset.titrantConcentration,
    titrantVol: 0,
    titrantVolMax: defaultPreset.titrantVolumeMax,
  });

  const [model, setModel] = useState(new TitrationModel(params));
  const [curve, setCurve] = useState(model.computeCurve());
  const [currentPH, setCurrentPH] = useState(model.getCurrentPH());

  // Update model whenever params change
  useEffect(() => {
    const m = new TitrationModel(params);
    setModel(m);
    const c = m.computeCurve();
    setCurve(c);
    setCurrentPH(m.getCurrentPH());
  }, [params]);

  const onParamChange = (key: keyof typeof params, value: number) => {
    setParams((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const onPresetSelect = (preset: Preset) => {
    setParams({
      analyteConc: preset.analyteConcentration,
      analyteVol: preset.analyteVolume,
      titrantConc: preset.titrantConcentration,
      titrantVol: 0,
      titrantVolMax: preset.titrantVolumeMax,
    });
  };

  const onExportCSV = () => {
    // Build CSV content: “Volume, pH”
    const header = "Volume (L),pH\n";
    const rows = curve.volumes.map((v, i) => {
      return `${v.toFixed(6)},${curve.pHs[i].toFixed(4)}`;
    });
    const csv = header + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    saveAs(blob, "titration_curve.csv");
  };

  return (
    <div className="app-container">
      <div className="left-pane">
        <Apparatus
          titrantVolume={params.titrantVol}
          titrantMax={params.titrantVolMax}
        />
        <Graph
          volumes={curve.volumes}
          pHs={curve.pHs}
          currentVolume={params.titrantVol}
          currentPH={currentPH}
        />
      </div>
      <div className="right-pane">
        <Controls
          params={params}
          onParamChange={onParamChange}
          onPresetSelect={onPresetSelect}
          onExportCSV={onExportCSV}
        />
        <div style={{ marginTop: "16px" }}>
          <strong>Current pH:</strong> {currentPH.toFixed(3)}
        </div>
      </div>
    </div>
  );
};

export default App;

