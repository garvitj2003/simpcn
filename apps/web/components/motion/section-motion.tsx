"use client";

import { useEffect, useRef, type ReactNode } from "react";
import "./section-motion.css";

const headings = ".home-section-heading > h2, .home-section-heading > p, .asset-reference-heading > *, .compatibility-heading > h2, .compatibility-heading > p, .home-community > div:first-child > h2, .home-community > div:first-child > p, .quick-install-heading > h2, .quick-install-heading > p";
const cards = ".home-comparison-side, .home-benefits dl > div, .quick-install-shell";

/** Enhances server-rendered content; nothing is hidden while waiting for JS or scroll. */
export function SectionMotion({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = root.current;
    if (!container || typeof IntersectionObserver === "undefined") return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const active = new Set<Animation>();
    const ease = getComputedStyle(container).getPropertyValue("--ease-out").trim() || "cubic-bezier(.23, 1, .32, 1)";
    let reflection: HTMLElement | null = null;
    const registered = new WeakSet<Element>();
    let reflectionVisible = false;
    let reflectionPlayed = false;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;

    function queueReflection() {
      clearTimeout(idleTimer);
      if (reflection) reflection.dataset.reflectionPaused = String(document.hidden || !reflectionVisible);
      if (!reflection || reflectionPlayed || !reflectionVisible || preference.matches || document.hidden) return;
      idleTimer = setTimeout(() => {
        reflectionPlayed = true;
        reflection.dataset.reflection = "play";
      }, 1500);
    }

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.target === reflection) {
          reflectionVisible = entry.isIntersecting;
          queueReflection();
          continue;
        }
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const element = entry.target as HTMLElement;
        if (typeof element.animate !== "function") continue;
        const card = element.matches(cards);
        const siblings = Array.from(element.parentElement?.children ?? []);
        const group = siblings.filter(child => child.matches(card ? cards : headings));
        const delay = element.matches(".quick-install-shell") ? 120 : Math.max(0, group.indexOf(element)) * 60;
        const reduce = preference.matches;
        const animation = element.animate(
          reduce
            ? [{ opacity: .65 }, { opacity: 1 }]
            : [
                { opacity: 0, transform: card ? "translateY(16px) scale(.98)" : "translateY(12px)" },
                { opacity: 1, transform: "translateY(0) scale(1)" },
              ],
          { duration: reduce ? 120 : card ? 450 : 400, delay: reduce ? 0 : delay, easing: ease, fill: "backwards" },
        );
        active.add(animation);
        animation.onfinish = animation.oncancel = () => active.delete(animation);
        if (document.hidden) animation.pause();
      }
    }, { threshold: 0, rootMargin: "0px 0px -24px 0px" });

    function registerElements() {
      container!.querySelectorAll(`${headings}, ${cards}`).forEach(element => {
        if (registered.has(element)) return;
        registered.add(element);
        observer.observe(element);
      });
      const community = container!.querySelector<HTMLElement>(".home-community");
      if (community && community !== reflection) {
        if (reflection) observer.unobserve(reflection);
        reflection = community;
        observer.observe(community);
      }
    }
    registerElements();
    // Server-rendered children and client sections can arrive after this effect.
    const additions = new MutationObserver(registerElements);
    additions.observe(container, { childList: true, subtree: true });

    function onPreference() {
      if (preference.matches) active.forEach(animation => animation.cancel());
      queueReflection();
    }
    function onVisibility() {
      active.forEach(animation => document.hidden ? animation.pause() : animation.play());
      queueReflection();
    }
    preference.addEventListener("change", onPreference);
    document.addEventListener("visibilitychange", onVisibility);
    container.addEventListener("pointerdown", queueReflection, { passive: true });
    container.addEventListener("keydown", queueReflection);
    return () => {
      observer.disconnect();
      additions.disconnect();
      clearTimeout(idleTimer);
      active.forEach(animation => animation.cancel());
      preference.removeEventListener("change", onPreference);
      document.removeEventListener("visibilitychange", onVisibility);
      container.removeEventListener("pointerdown", queueReflection);
      container.removeEventListener("keydown", queueReflection);
    };
  }, []);

  return <div className="section-motion-root" ref={root}>{children}</div>;
}
