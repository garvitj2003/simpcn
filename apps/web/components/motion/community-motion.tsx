"use client";

import { useId } from "react";
import { MotionScene } from "./motion-scene";
import "./community-motion.css";

/** Decorative documentation metaphor; the actual answers stay in the FAQ. */
export function FaqMotion() {
  const id = useId();

  return (
    <MotionScene
      className="fm-scene"
      label="A reference guide with an answered question"
      caption="Supported references and limitations, explained."
    >
      <svg className="fm-art" viewBox="0 0 320 190" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-cover`} x1="65" y1="45" x2="222" y2="172" gradientUnits="userSpaceOnUse">
            <stop className="fm-cover-light" />
            <stop offset="1" className="fm-cover-dark" />
          </linearGradient>
          <linearGradient id={`${id}-page`} x1="91" y1="38" x2="215" y2="149" gradientUnits="userSpaceOnUse">
            <stop className="fm-paper-light" />
            <stop offset="1" className="fm-paper-dark" />
          </linearGradient>
        </defs>
        <ellipse cx="157" cy="168" rx="100" ry="8" className="fm-ground" />
        <g className="fm-book">
          <path d="M74 47Q74 39 82 39H217Q227 39 227 49V153Q227 163 217 163H82Q74 163 74 155Z" fill={`url(#${id}-cover)`} className="fm-cover" />
          <path d="M84 156H216M84 151H216" className="fm-page-edge" />
          <path d="M88 35H216Q221 35 221 40V147H88Z" fill={`url(#${id}-page)`} className="fm-page" />
          <path d="M88 35V147" className="fm-spine" />
          <path d="M101 62H159M101 72H180" className="fm-heading-rule" />
          <path d="M101 92H200M101 101H194M101 110H183M101 119H195" className="fm-body-rule" />
          <path d="M188 35V65L195 60L202 65V35" className="fm-bookmark" />
          <g className="fm-question">
            <rect x="47" y="87" width="37" height="37" rx="12" className="fm-question-surface" />
            <path d="M61 100C61 95 70 95 70 100C70 104 65 103 65 107M65 112V113" className="fm-question-mark" />
          </g>
          <g className="fm-answer">
            <rect x="166" y="116" width="91" height="34" rx="11" className="fm-answer-surface" />
            <circle cx="183" cy="133" r="8" className="fm-check-circle" />
            <path d="M179 133L182 136L187 130" className="fm-check" />
            <text x="198" y="137" className="fm-answer-label">In the docs</text>
          </g>
        </g>
      </svg>
    </MotionScene>
  );
}

/** An invitation to participate, not a representation of live project activity. */
export function CommunityMotion() {
  const id = useId();

  return (
    <MotionScene
      className="cm-scene"
      label="An illustrative open-source contribution, from report to discussion to code"
      caption="Every contribution starts with an idea."
    >
      <svg className="cm-art" viewBox="0 0 500 214" fill="none" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="0" y2="146" gradientUnits="userSpaceOnUse">
            <stop className="cm-surface-top" />
            <stop offset="1" className="cm-surface-bottom" />
          </linearGradient>
        </defs>
        <path d="M150 106H184M316 106H350" className="cm-connection" />
        <circle cx="163" cy="106" r="3" className="cm-packet cm-packet-first" />
        <circle cx="329" cy="106" r="3" className="cm-packet cm-packet-second" />
        <g className="cm-card cm-report" transform="translate(8 25)">
          <rect x="0.5" y="0.5" width="143" height="145" rx="16" fill={`url(#${id}-surface)`} className="cm-card-surface" />
          <path d="M1 31H143" className="cm-toolbar-divider" />
          <circle cx="13" cy="16" r="3" className="cm-window-dot" /><circle cx="24" cy="16" r="3" className="cm-window-dot" /><circle cx="35" cy="16" r="3" className="cm-window-dot" />
          <circle cx="26" cy="57" r="9" className="cm-issue-circle" />
          <circle cx="26" cy="57" r="3" className="cm-issue-dot" />
          <text x="43" y="61" className="cm-card-title">Report</text>
          <path d="M18 83H123M18 93H111M18 103H120" className="cm-text-line" />
          <rect x="18" y="119" width="57" height="13" rx="6.5" className="cm-tag" />
          <text x="25" y="128" className="cm-tag-label">A rough edge</text>
        </g>
        <g className="cm-card cm-discuss" transform="translate(178 25)">
          <rect x="0.5" y="0.5" width="143" height="145" rx="16" fill={`url(#${id}-surface)`} className="cm-card-surface" />
          <path d="M1 31H143" className="cm-toolbar-divider" />
          <circle cx="13" cy="16" r="3" className="cm-window-dot" /><circle cx="24" cy="16" r="3" className="cm-window-dot" /><circle cx="35" cy="16" r="3" className="cm-window-dot" />
          <path d="M19 49H34Q37 49 37 52V61Q37 64 34 64H27L21 68V64H19Q16 64 16 61V52Q16 49 19 49Z" className="cm-discussion-icon" />
          <text x="45" y="61" className="cm-card-title">Discuss</text>
          <rect x="17" y="79" width="106" height="18" rx="7" className="cm-message-first" />
          <path d="M26 88H105" className="cm-message-line" />
          <g className="cm-reply"><rect x="32" y="105" width="94" height="23" rx="8" className="cm-message-second" /><path d="M41 116H112" className="cm-message-line" /></g>
        </g>
        <g className="cm-card cm-contribute" transform="translate(348 25)">
          <rect x="0.5" y="0.5" width="143" height="145" rx="16" fill={`url(#${id}-surface)`} className="cm-card-surface" />
          <path d="M1 31H143" className="cm-toolbar-divider" />
          <circle cx="13" cy="16" r="3" className="cm-window-dot" /><circle cx="24" cy="16" r="3" className="cm-window-dot" /><circle cx="35" cy="16" r="3" className="cm-window-dot" />
          <path d="M22 50L16 56L22 62M32 50L38 56L32 62M29 48L25 64" className="cm-code-icon" />
          <text x="44" y="61" className="cm-card-title">Contribute</text>
          <g className="cm-patch"><rect x="16" y="78" width="111" height="32" rx="6" className="cm-patch-fill" /><path d="M23 86V96M18 91H28M38 87H110M38 98H92" className="cm-patch-line" /></g>
          <g className="cm-review"><rect x="18" y="121" width="10" height="10" rx="3" className="cm-review-box" /><path d="M20 126L23 129L27 123" className="cm-review-check" /><text x="35" y="130" className="cm-review-label">Ready for review</text></g>
        </g>
        <text x="80" y="196" textAnchor="middle" className="cm-stage-label">Share the context</text>
        <text x="250" y="196" textAnchor="middle" className="cm-stage-label">Explore an idea</text>
        <text x="420" y="196" textAnchor="middle" className="cm-stage-label">Improve the project</text>
      </svg>
    </MotionScene>
  );
}
