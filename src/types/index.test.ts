import { describe, it, expect } from 'vitest';
import { BRUSH_COLORS, BRUSH_COLORS_SOLID } from './index';

describe('BRUSH_COLORS', () => {
  it('should have red color with alpha', () => {
    expect(BRUSH_COLORS.red).toBe('rgba(239, 68, 68, 0.6)');
  });

  it('should have blue color with alpha', () => {
    expect(BRUSH_COLORS.blue).toBe('rgba(59, 130, 246, 0.6)');
  });

  it('should have yellow color with alpha', () => {
    expect(BRUSH_COLORS.yellow).toBe('rgba(234, 179, 8, 0.6)');
  });

  it('should have exactly 3 colors', () => {
    expect(Object.keys(BRUSH_COLORS)).toHaveLength(3);
  });

  it('should have alpha value of 0.6', () => {
    Object.values(BRUSH_COLORS).forEach((color) => {
      expect(color).toContain('0.6)');
    });
  });
});

describe('BRUSH_COLORS_SOLID', () => {
  it('should have red as hex', () => {
    expect(BRUSH_COLORS_SOLID.red).toBe('#ef4444');
  });

  it('should have blue as hex', () => {
    expect(BRUSH_COLORS_SOLID.blue).toBe('#3b82f6');
  });

  it('should have yellow as hex', () => {
    expect(BRUSH_COLORS_SOLID.yellow).toBe('#eab308');
  });

  it('should have exactly 3 colors', () => {
    expect(Object.keys(BRUSH_COLORS_SOLID)).toHaveLength(3);
  });

  it('should be valid hex colors', () => {
    const hexRegex = /^#[0-9a-f]{6}$/i;
    Object.values(BRUSH_COLORS_SOLID).forEach((color) => {
      expect(color).toMatch(hexRegex);
    });
  });
});
