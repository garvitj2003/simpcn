import Link from "next/link";
import "./logo-exploration.css";

type Direction = "original" | "compact" | "flow";
const directions: { id: Direction; name: string; detail: string }[] = [
  { id: "original", name: "Original dot trail", detail: "The original mark, restored on the site. The reference for the other two." },
  { id: "compact", name: "Compact dots", detail: "The same staggered rhythm with a tighter, more balanced silhouette." },
  { id: "flow", name: "Dot flow", detail: "A clearer S shape, keeping the small round dots and open spacing." },
];
const marks: Record<Direction, number[][]> = {
  original: [[8,4],[15,4],[22,4],[4,11],[11,11],[18,11],[11,18],[18,18],[25,18],[8,25],[15,25],[22,25]],
  compact: [[8,5],[15,5],[22,5],[5,12],[12,12],[19,12],[11,19],[18,19],[25,19],[8,26],[15,26],[22,26]],
  flow: [[9,4],[16,4],[23,4],[5,11],[12,11],[12,18],[19,18],[26,18],[23,25],[16,25],[9,25]],
};

function ConceptMark({ direction, size = 40 }: { direction: Direction; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 30 30" fill="currentColor" aria-hidden="true" focusable="false">
    {marks[direction].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={direction === "compact" ? 2.5 : 2.6} />)}
  </svg>;
}

export function LogoExploration() {
  return <main className="logo-exploration">
    <header className="logo-exploration-heading">
      <Link href="/">← Back to the site</Link>
      <h1>Back to the dots.</h1>
      <p>The original dot mark is restored. These variations stay close to its shape, spacing, and character.</p>
    </header>
    <div className="logo-directions">
      {directions.map(direction => <section className="logo-direction" key={direction.id} aria-labelledby={`logo-${direction.id}`}>
        <div className="logo-direction-heading"><h2 id={`logo-${direction.id}`}>{direction.name}</h2><p>{direction.detail}</p></div>
        <div className="logo-direction-samples">
          <div className="logo-sample logo-sample-light">
            <div className="logo-large-mark"><ConceptMark direction={direction.id} size={104} /></div>
            <div className="logo-wordmark"><ConceptMark direction={direction.id} size={30} /><span>Simpcn.</span></div>
            <div className="logo-small-marks"><ConceptMark direction={direction.id} size={16} /><ConceptMark direction={direction.id} size={24} /><ConceptMark direction={direction.id} size={32} /><span>16 / 24 / 32px</span></div>
          </div>
          <div className="logo-sample logo-sample-dark">
            <div className="logo-large-mark"><ConceptMark direction={direction.id} size={104} /></div>
            <div className="logo-wordmark"><ConceptMark direction={direction.id} size={30} /><span>Simpcn.</span></div>
            <div className="logo-small-marks"><ConceptMark direction={direction.id} size={16} /><ConceptMark direction={direction.id} size={24} /><ConceptMark direction={direction.id} size={32} /><span>16 / 24 / 32px</span></div>
          </div>
        </div>
      </section>)}
    </div>
  </main>;
}
