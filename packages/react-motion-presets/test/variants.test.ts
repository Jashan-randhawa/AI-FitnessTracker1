import { describe, it, expect } from 'vitest';
import {
  staggerContainer,
  staggerFast,
  staggerItem,
  slideLeft,
  slideRight,
  scaleUp,
  reducedMotionItem,
  prefersReducedMotion,
  StaggerContainer,
  StaggerItem,
} from '../src/variants';

describe('react-motion-presets: variants', () => {
  it('defines correct container stagger timings', () => {
    expect(staggerContainer.show).toBeDefined();
    expect((staggerContainer.show as any).transition.staggerChildren).toBe(0.05);

    expect(staggerFast.show).toBeDefined();
    expect((staggerFast.show as any).transition.staggerChildren).toBe(0.03);
  });

  it('defines spring transition physics for item rise', () => {
    expect(staggerItem.hidden).toEqual({ opacity: 0, y: 15 });
    expect(staggerItem.show).toBeDefined();
    expect((staggerItem.show as any).transition.type).toBe('spring');
    expect((staggerItem.show as any).transition.staggerChildren).toBeUndefined();
  });

  it('defines slide-in and scale-up entrance variants', () => {
    expect(slideLeft.hidden).toEqual({ opacity: 0, x: -30 });
    expect(slideRight.hidden).toEqual({ opacity: 0, x: 30 });
    expect(scaleUp.hidden).toEqual({ opacity: 0, scale: 0.9 });
  });

  it('defines reduced motion crossfade variant', () => {
    expect(reducedMotionItem.hidden).toEqual({ opacity: 0 });
    expect(reducedMotionItem.show).toEqual({
      opacity: 1,
      transition: { duration: 0.15 },
    });
  });

  it('provides backwards-compatible alias exports', () => {
    expect(StaggerContainer).toBe(staggerContainer);
    expect(StaggerItem).toBe(staggerItem);
  });

  it('safely evaluates prefersReducedMotion in node/SSR', () => {
    expect(typeof prefersReducedMotion()).toBe('boolean');
  });
});
