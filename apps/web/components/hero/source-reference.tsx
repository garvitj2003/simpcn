export function SourceReference() {
  return <div className="demo-source-reference">
    <div className="demo-reference-heading"><span>In any state, source code never changes.</span><span className="demo-unchanged"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 8 3 3 5-6" /></svg> Unchanged</span></div>
    <code>{'<img src="/window.svg" alt="Window" />'}</code>
  </div>;
}
