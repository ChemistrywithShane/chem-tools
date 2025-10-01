import React, { useEffect, useRef } from "react";

interface ApparatusProps {
  titrantVolume: number;
  titrantMax: number;
}

const Apparatus: React.FC<ApparatusProps> = ({
  titrantVolume,
  titrantMax,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  // Animate droplet falling (simple loop) — you can improve this later
  useEffect(() => {
    let animationFrame: number;
    const drop = () => {
      if (!svgRef.current) {
        animationFrame = window.requestAnimationFrame(drop);
        return;
      }
      // Could animate drop element by changing its y position, fading, etc.
      // For now we leave placeholder.
      animationFrame = window.requestAnimationFrame(drop);
    };
    drop();
    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  // Compute fill-level in flask as fraction
  const fillFraction = titrantVolume / titrantMax;
  const fillHeight = 100 + fillFraction * 150; // example mapping

  return (
    <svg
      ref={svgRef}
      width="300"
      height="300"
      viewBox="0 0 300 300"
      style={{ backgroundColor: "#eef" }}
    >
      {/* Burette tube / tubing SVG */}
      <rect x={140} y={20} width={20} height={200} fill="#ccc" />
      {/* Droplet (placeholder) */}
      <circle cx={150} cy={30} r={5} fill="blue" />
      {/* Flask fill (liquid level) */}
      <rect x={100} y={fillHeight} width={100} height={300 - fillHeight} fill="#88c" />
    </svg>
  );
};

export default Apparatus;

