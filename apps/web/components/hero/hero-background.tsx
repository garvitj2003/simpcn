export function HeroBackground() {
  return (
    <div
      className="hero-background"
      aria-hidden="true"
      style={{
        background: "radial-gradient(ellipse 110% 105% at 100% 100%, light-dark(rgb(139 193 232 / 58%), rgb(95 150 190 / 23%)) 0%, light-dark(rgb(139 193 232 / 30%), rgb(95 150 190 / 12%)) 35%, light-dark(rgb(139 193 232 / 9%), rgb(95 150 190 / 4%)) 62%, transparent 85%)",
        maskImage: "linear-gradient(180deg, black 80%, transparent 100%)",
      }}
    />
  );
}
