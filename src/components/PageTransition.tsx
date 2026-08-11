import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';

// Snappy route transitions: the exit is near-instant (so `mode="wait"` barely
// pauses before the next page enters) and the enter is a quick spring. This
// keeps navigation feeling immediate while retaining a touch of polish.
const MOTION: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.995 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 520, damping: 36, mass: 0.6 } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.09, ease: 'easeIn' } },
};

// prefers-reduced-motion: fade only, no movement.
const REDUCED: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.06 } },
};

export const PageTransition = forwardRef<HTMLDivElement, { children: ReactNode }>(
  ({ children }, ref) => {
    const reduce = useReducedMotion();
    return (
      <motion.div ref={ref} initial="initial" animate="animate" exit="exit" variants={reduce ? REDUCED : MOTION}>
        {children}
      </motion.div>
    );
  }
);

PageTransition.displayName = 'PageTransition';
