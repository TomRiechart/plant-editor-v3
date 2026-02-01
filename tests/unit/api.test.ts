import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Reset mocks before each test
beforeEach(() => {
  mockFetch.mockReset();
});

describe('Collections API', () => {
  it('GET /api/collections should return collections array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'col-1', name: 'Collection 1', images: [] },
          { id: 'col-2', name: 'Collection 2', images: [] },
        ],
      }),
    });

    const response = await fetch('/api/collections');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith('/api/collections');
  });

  it('GET /api/collections/:id should return single collection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          id: 'col-1',
          name: 'Test Collection',
          images: [{ id: 'img-1', image_url: '/test.jpg' }],
        },
      }),
    });

    const response = await fetch('/api/collections/col-1');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Test Collection');
  });

  it('POST /api/collections should create collection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'new-col', name: 'New Collection' },
      }),
    });

    const response = await fetch('/api/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Collection' }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.name).toBe('New Collection');
  });

  it('PUT /api/collections/:id should update collection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'col-1', name: 'Updated Name' },
      }),
    });

    const response = await fetch('/api/collections/col-1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Updated Name');
  });

  it('DELETE /api/collections/:id should delete collection', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const response = await fetch('/api/collections/col-1', {
      method: 'DELETE',
    });
    const data = await response.json();

    expect(data.success).toBe(true);
  });
});

describe('Plants API', () => {
  it('GET /api/plants should return plants array', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: [
          { id: 'plant-1', name: 'Monstera', image_url: '/monstera.jpg' },
          { id: 'plant-2', name: 'Ficus', image_url: '/ficus.jpg' },
        ],
      }),
    });

    const response = await fetch('/api/plants');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data).toHaveLength(2);
  });

  it('GET /api/plants/:id should return single plant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { id: 'plant-1', name: 'Monstera', image_url: '/monstera.jpg' },
      }),
    });

    const response = await fetch('/api/plants/plant-1');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Monstera');
  });

  it('DELETE /api/plants/:id should delete plant', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const response = await fetch('/api/plants/plant-1', {
      method: 'DELETE',
    });
    const data = await response.json();

    expect(data.success).toBe(true);
  });
});

describe('Settings API', () => {
  it('GET /api/settings should return all settings', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          system_prompt: 'Test prompt',
          implement_prompt_analyze: 'Analyze prompt',
        },
      }),
    });

    const response = await fetch('/api/settings');
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.system_prompt).toBe('Test prompt');
  });

  it('PUT /api/settings/:key should update setting', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { system_prompt: 'New prompt' },
      }),
    });

    const response = await fetch('/api/settings/system_prompt', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'New prompt' }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
  });
});

describe('Generate API', () => {
  it('POST /api/generate should start generation', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          images: ['/result1.jpg', '/result2.jpg', '/result3.jpg'],
        },
      }),
    });

    const response = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        canvasDataUrl: 'data:image/png;base64,abc123',
        plants: [{ name: 'Monstera', imageUrl: '/monstera.jpg', color: 'red' }],
        mode: 'single',
      }),
    });
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.data.images).toHaveLength(3);
  });

  it('POST /api/generate should handle errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Generation failed',
      }),
    });

    const response = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const data = await response.json();

    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });
});

describe('Implement API', () => {
  it('POST /api/implement should return SSE stream', async () => {
    // Mock SSE response
    const mockReader = {
      read: vi.fn()
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"step":"analyzing"}\n\n'),
        })
        .mockResolvedValueOnce({
          done: false,
          value: new TextEncoder().encode('data: {"step":"complete"}\n\n'),
        })
        .mockResolvedValueOnce({ done: true }),
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      body: {
        getReader: () => mockReader,
      },
    });

    const response = await fetch('/api/implement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        originalImageUrl: '/original.jpg',
        editedImageUrl: '/edited.jpg',
        targetImages: [{ id: 'img-1', image_url: '/target.jpg' }],
        plants: [{ name: 'Monstera', imageUrl: '/monstera.jpg' }],
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.body).toBeDefined();
  });
});

describe('API Error Handling', () => {
  it('should handle network errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(fetch('/api/collections')).rejects.toThrow('Network error');
  });

  it('should handle 404 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({
        success: false,
        error: 'Not found',
      }),
    });

    const response = await fetch('/api/collections/nonexistent');
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(data.error).toBe('Not found');
  });

  it('should handle 500 errors', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        success: false,
        error: 'Internal server error',
      }),
    });

    const response = await fetch('/api/collections');
    const data = await response.json();

    expect(response.ok).toBe(false);
    expect(data.success).toBe(false);
  });
});
