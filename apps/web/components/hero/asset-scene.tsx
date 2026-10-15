"use client";

import { useId } from "react";

export function AssetScene({ stored, delivered, animate }: { stored: boolean; delivered: boolean; animate: boolean }) {
  const id = useId().replaceAll(":", "");
  const ref = (name: string) => `url(#${id}-${name})`;
  return <svg className="demo-scene demo-macos-scene" data-stored={stored} data-delivered={delivered} data-animate={animate} viewBox="0 0 480 176" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={`${id}-folder-back`} x1="64" y1="33" x2="64" y2="95" gradientUnits="userSpaceOnUse"><stop stopColor="#9de3ff" /><stop offset="1" stopColor="#378fc5" /></linearGradient>
      <linearGradient id={`${id}-folder-front`} x1="64" y1="53" x2="64" y2="96" gradientUnits="userSpaceOnUse"><stop stopColor="#a7e4fa" /><stop offset=".24" stopColor="#6ecbf0" /><stop offset="1" stopColor="#399bd2" /></linearGradient>
      <linearGradient id={`${id}-paper`} x1="0" y1="-3" x2="0" y2="31" gradientUnits="userSpaceOnUse"><stop stopColor="white" /><stop offset="1" stopColor="#e5edf3" /></linearGradient>
      <linearGradient id={`${id}-photo`} x1="0" y1="0" x2="0" y2="28" gradientUnits="userSpaceOnUse"><stop stopColor="#bfeafb" /><stop offset="1" stopColor="#87c5e5" /></linearGradient>
      <linearGradient id={`${id}-window`} x1="240" y1="30" x2="240" y2="99" gradientUnits="userSpaceOnUse"><stop stopColor="#fcfdff" /><stop offset="1" stopColor="#dce9f1" /></linearGradient>
      <linearGradient id={`${id}-cloud`} x1="417" y1="46" x2="417" y2="76" gradientUnits="userSpaceOnUse"><stop stopColor="#85ccea" /><stop offset="1" stopColor="#4c90b7" /></linearGradient>
      <filter id={`${id}-shadow`} x="-50%" y="-50%" width="200%" height="220%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#29475c" floodOpacity=".16" /></filter>
      <symbol id={`${id}-thumbnail`} overflow="visible">
        <rect x="-3" y="-3" width="42" height="34" rx="5" fill={ref("paper")} stroke="#fff" strokeOpacity=".9" strokeWidth=".8" />
        <rect width="36" height="28" rx="3" fill={ref("photo")} />
        <circle cx="27" cy="7" r="3" fill="#fff6d8" />
        <path d="m0 25 10-12 9 9 6-7 11 11v2H0Z" fill="#629fbd" />
        <path d="m0 28 13-9 10 7 7-5 6 7H0Z" fill="#437fa0" />
        <path d="M3 1h30" stroke="white" strokeOpacity=".65" strokeWidth=".8" />
      </symbol>
    </defs>

    <g className="demo-data-connection" data-active={!delivered}><path d="M104 64C140 80 165 80 201 64" /></g>
    <g className="demo-data-connection" data-active={delivered}><path d="M389 64C350 80 312 80 275 64" /></g>
    {[0, 1].map(index => <g key={`${delivered}-${index}`} className="demo-request-packet" data-cdn={delivered} style={{ animationDelay: `${index * 800}ms` }}><circle r="8" opacity=".08" /><rect x="-4" y="-3" width="8" height="6" rx="1.5" /><path d="M-2 0h4" stroke="white" strokeWidth=".8" /></g>)}
    <ellipse className="demo-arrival-ring" cx="417" cy="67" rx="36" ry="34" />
    <rect className="demo-production-ring" x="196" y="26" width="88" height="77" rx="12" />

    <g className="demo-finder-folder" filter={ref("shadow")}>
      <path d="M25 42a7 7 0 0 1 7-7h22c4 0 5 2 8 6h34a7 7 0 0 1 7 7v40a7 7 0 0 1-7 7H32a7 7 0 0 1-7-7Z" fill={ref("folder-back")} stroke="#408fbc" strokeOpacity=".5" strokeWidth=".7" />
      <path d="M32 37h22c3 0 4 2 6 4" stroke="white" strokeOpacity=".65" strokeLinecap="round" />
      <g className="demo-folder-papers"><rect x="41" y="45" width="38" height="35" rx="3" fill="#f1f7fc" transform="rotate(-9 60 62)" /><rect x="47" y="43" width="34" height="35" rx="3" fill="white" transform="rotate(7 64 60)" /></g>
      <path className="demo-folder-front" d="M25 57a5 5 0 0 1 5-5h68a5 5 0 0 1 5 5l-4 34a5 5 0 0 1-5 5H34a5 5 0 0 1-5-5Z" fill={ref("folder-front")} stroke="#3c94c0" strokeOpacity=".4" strokeWidth=".7" />
      <path d="M31 54h65" stroke="white" strokeOpacity=".6" strokeLinecap="round" />
    </g>
    <text className="demo-icon-label" x="64" y="123" textAnchor="middle">public/</text>

    <g className="demo-app-window" data-active={delivered}>
      <rect x="201" y="30" width="78" height="69" rx="7" fill={ref("window")} stroke="white" strokeWidth="1" filter={ref("shadow")} />
      <path d="M208 30h64a7 7 0 0 1 7 7v10h-78V37a7 7 0 0 1 7-7Z" fill="#edf1f5" />
      <path d="M202 47h76" stroke="#aabac7" strokeOpacity=".35" strokeWidth=".6" />
      <circle cx="210" cy="39" r="2.2" fill="#ff6058" /><circle cx="217" cy="39" r="2.2" fill="#ffbd2e" /><circle cx="224" cy="39" r="2.2" fill="#28c840" />
      <rect x="230" y="36" width="39" height="6" rx="3" fill="white" fillOpacity=".8" />
      <rect x="206" y="52" width="8" height="41" rx="2" fill="#afc8d8" fillOpacity=".25" />
      <use href={`#${id}-thumbnail`} x="224" y="58" width="36" height="28" />
      <path d="M225 92h25" stroke="#7f9bae" strokeWidth="2" strokeLinecap="round" opacity=".5" />
      <g className="demo-server-check"><circle cx="272" cy="94" r="8" fill="#4e917e" stroke="#effaf5" strokeWidth="1.5" /><path d="m268.5 94 2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
    <text className="demo-icon-label" x="240" y="123" textAnchor="middle">Application</text><text className="demo-icon-sublabel" x="240" y="139" textAnchor="middle">server</text>

    <g className="demo-cdn-network" data-active={delivered}>
      <g className="demo-edge-links"><path d="m392 44 25 19 31-22M417 63l-34 28m34-28 35 28" /></g>
      {[[392, 44], [448, 41], [383, 91], [452, 91]].map(([x, y], index) => <g className="demo-edge-node" key={index} style={{ transitionDelay: delivered ? `${index * 70}ms` : "0ms" }}>
        <rect x={x - 7} y={y - 6} width="14" height="12" rx="3" fill="#f3faff" stroke="#8bb8cf" strokeWidth=".8" />
        <path d={`M${x - 3} ${y - 2}h6m-6 4h4`} stroke="#5f9abd" strokeWidth="1" strokeLinecap="round" />
      </g>)}
      <g filter={ref("shadow")}>
        <path d="M401 81h31a13 13 0 0 0 1-26 18 18 0 0 0-34-2 14 14 0 0 0 2 28Z" fill={ref("cloud")} stroke="#e9f9ff" strokeWidth="1.2" />
        <path d="M402 55a16 16 0 0 1 27 0" stroke="white" strokeOpacity=".4" strokeWidth="1" strokeLinecap="round" />
        <circle cx="417" cy="66" r="10" stroke="white" strokeOpacity=".9" strokeWidth="1" />
        <ellipse cx="417" cy="66" rx="4.5" ry="10" stroke="white" strokeOpacity=".8" strokeWidth=".8" />
        <path d="M407 66h20m-18-5h16m-16 10h16" stroke="white" strokeOpacity=".7" strokeWidth=".8" />
      </g>
      <g className="demo-storage-check"><circle cx="439" cy="82" r="8" fill="#4e917e" stroke="#effaf5" strokeWidth="1.5" /><path d="m435.5 82 2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></g>
    </g>
    <text className="demo-icon-label" x="417" y="123" textAnchor="middle">Your CDN</text><text className="demo-icon-sublabel" x="417" y="139" textAnchor="middle">Asset delivery</text>

    <g className="demo-traveling-asset" style={{ transform: stored ? "translate(399px, 51px)" : "translate(46px, 51px)" }}>
      <g className="demo-file-sprite" filter={ref("shadow")}><use href={`#${id}-thumbnail`} width="36" height="28" /><g className="demo-file-name"><rect x="-15" y="35" width="66" height="15" rx="5" fill="#f8fcff" fillOpacity=".9" /><text x="18" y="45" textAnchor="middle">window.svg</text></g></g>
    </g>
  </svg>;
}
