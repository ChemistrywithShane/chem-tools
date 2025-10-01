import React, { useEffect, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

interface GraphProps {
  volumes: number[];
  pHs: number[];
  currentVolume: number;
  currentPH: number;
}

const Graph: React.FC<GraphProps> = ({
  volumes,
  pHs,
  currentVolume,
  currentPH,
}) => {
  const plotRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!plotRef.current) return;

    if (!uplotRef.current) {
      const opts: uPlot.Options = {
        width: plotRef.current.clientWidth,
        height: 300,
        title: "Titration Curve (pH vs Volume)",
        scales: {
          x: { time: false },
          y: { auto: true },
        },
        axes: [
          { label: "Volume added (L)" },
          { label: "pH" },
        ],
        series: [
          {},
          {
            label: "pH",
            stroke: "blue",
          },
        ],
        cursor: {
          x: true,
          y: true,
        },
      };

      uplotRef.current = new uPlot(opts, [volumes, pHs], plotRef.current);
    } else {
      uplotRef.current.setData([volumes, pHs]);
    }
  }, [volumes, pHs]);

  return <div className="graph-container" ref={plotRef}></div>;
};

export default Graph;

