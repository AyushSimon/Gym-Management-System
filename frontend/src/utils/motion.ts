import type { Variants } from "framer-motion";

/** Shared easing + variants so motion stays consistent. Only opacity and transform are animated. */
export const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const pageVariants: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE } },
  exit: { opacity: 0, transition: { duration: 0.12 } },
};

/** Parent that reveals its children one after another (kept short so it never feels slow). */
export const staggerParent: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.02 } },
};

export const rise: Variants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.24, ease: EASE } },
};

export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
};
