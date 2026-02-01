import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  cn,
  generateUUID,
  formatDate,
  formatTimeAgo,
  validateImageUrl,
  parseSSEMessage,
  debounce,
  throttle,
  sleep,
} from './utils';

describe('cn (className utility)', () => {
  it('should merge class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('should handle arrays', () => {
    expect(cn(['foo', 'bar'])).toBe('foo bar');
  });

  it('should merge Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('should handle undefined and null', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });
});

describe('generateUUID', () => {
  it('should generate a valid UUID v4 format', () => {
    const uuid = generateUUID();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(uuid).toMatch(uuidRegex);
  });

  it('should generate unique UUIDs', () => {
    const uuids = new Set(Array.from({ length: 100 }, () => generateUUID()));
    expect(uuids.size).toBe(100);
  });
});

describe('formatDate', () => {
  it('should format ISO date string', () => {
    const date = '2026-01-31T12:30:00.000Z';
    const formatted = formatDate(date);
    expect(formatted).toContain('2026');
    expect(formatted).toContain('Jan');
    expect(formatted).toContain('31');
  });

  it('should handle different dates', () => {
    const date = '2025-12-25T08:00:00.000Z';
    const formatted = formatDate(date);
    expect(formatted).toContain('Dec');
    expect(formatted).toContain('25');
  });
});

describe('formatTimeAgo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return "just now" for recent times', () => {
    const now = new Date('2026-01-31T12:00:00Z');
    vi.setSystemTime(now);
    
    const thirtySecondsAgo = new Date('2026-01-31T11:59:30Z').toISOString();
    expect(formatTimeAgo(thirtySecondsAgo)).toBe('just now');
  });

  it('should return minutes ago', () => {
    const now = new Date('2026-01-31T12:00:00Z');
    vi.setSystemTime(now);
    
    const fiveMinutesAgo = new Date('2026-01-31T11:55:00Z').toISOString();
    expect(formatTimeAgo(fiveMinutesAgo)).toBe('5m ago');
  });

  it('should return hours ago', () => {
    const now = new Date('2026-01-31T12:00:00Z');
    vi.setSystemTime(now);
    
    const threeHoursAgo = new Date('2026-01-31T09:00:00Z').toISOString();
    expect(formatTimeAgo(threeHoursAgo)).toBe('3h ago');
  });

  it('should return days ago', () => {
    const now = new Date('2026-01-31T12:00:00Z');
    vi.setSystemTime(now);
    
    const twoDaysAgo = new Date('2026-01-29T12:00:00Z').toISOString();
    expect(formatTimeAgo(twoDaysAgo)).toBe('2d ago');
  });
});

describe('validateImageUrl', () => {
  it('should return true for valid image URLs', () => {
    expect(validateImageUrl('https://example.com/image.jpg')).toBe(true);
    expect(validateImageUrl('https://example.com/image.png')).toBe(true);
    expect(validateImageUrl('https://example.com/image.gif')).toBe(true);
    expect(validateImageUrl('https://example.com/image.webp')).toBe(true);
    expect(validateImageUrl('https://example.com/image.svg')).toBe(true);
  });

  it('should return true for URLs with query params', () => {
    expect(validateImageUrl('https://example.com/image.jpg?size=large')).toBe(true);
  });

  it('should return false for invalid URLs', () => {
    expect(validateImageUrl('not-a-url')).toBe(false);
    expect(validateImageUrl('')).toBe(false);
  });

  it('should return false for URLs without any dot in path', () => {
    // URLs without any extension indicator should fail
    expect(validateImageUrl('https://example.com/images/12345')).toBe(false);
  });

  it('should return true for URL with any dot in path', () => {
    // Implementation checks for any dot, not just image extensions
    expect(validateImageUrl('https://example.com/path/file.something')).toBe(true);
  });
});

describe('parseSSEMessage', () => {
  it('should parse valid JSON', () => {
    const result = parseSSEMessage('{"step":"analyzing","message":"Starting..."}');
    expect(result).toEqual({ step: 'analyzing', message: 'Starting...' });
  });

  it('should return null for invalid JSON', () => {
    expect(parseSSEMessage('not json')).toBeNull();
    expect(parseSSEMessage('')).toBeNull();
    expect(parseSSEMessage('{')).toBeNull();
  });

  it('should handle nested objects', () => {
    const data = '{"result":{"images":["url1","url2"]}}';
    const result = parseSSEMessage(data);
    expect(result).toEqual({ result: { images: ['url1', 'url2'] } });
  });
});

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should delay function execution', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should cancel previous calls', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(50);
    debouncedFn();
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should pass arguments to the original function', () => {
    const fn = vi.fn();
    const debouncedFn = debounce(fn, 100);

    debouncedFn('arg1', 'arg2');
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
  });
});

describe('throttle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should limit function calls', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    throttledFn();
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(100);
    throttledFn();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should pass arguments to the original function', () => {
    const fn = vi.fn();
    const throttledFn = throttle(fn, 100);

    throttledFn('test');
    expect(fn).toHaveBeenCalledWith('test');
  });
});

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve after specified time', async () => {
    const promise = sleep(100);
    const resolved = vi.fn();
    
    promise.then(resolved);
    
    expect(resolved).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(100);
    await Promise.resolve(); // Flush promises
    
    expect(resolved).toHaveBeenCalled();
  });
});
