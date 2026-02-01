const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.error || 'Request failed');
  }

  return data.data as T;
}

// Collections API
export const collectionsApi = {
  getAll: () => request('/collections'),

  getOne: (id: string) => request(`/collections/${id}`),

  create: (name: string) =>
    request('/collections', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  update: (id: string, data: { name?: string; thumbnail_url?: string }) =>
    request(`/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/collections/${id}`, {
      method: 'DELETE',
    }),

  addImages: async (id: string, files: File[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    const response = await fetch(`${API_BASE}/collections/${id}/images`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  setMainImage: (collectionId: string, imageId: string) =>
    request(`/collections/${collectionId}/images/${imageId}/main`, {
      method: 'PUT',
    }),

  deleteImage: (collectionId: string, imageId: string) =>
    request(`/collections/${collectionId}/images/${imageId}`, {
      method: 'DELETE',
    }),

  reorderImages: (id: string, imageIds: string[]) =>
    request(`/collections/${id}/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ imageIds }),
    }),
};

// Plants API
export const plantsApi = {
  getAll: () => request('/plants'),

  getOne: (id: string) => request(`/plants/${id}`),

  create: async (name: string, imageFile: File) => {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', imageFile);

    const response = await fetch(`${API_BASE}/plants`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();
    if (!data.success) throw new Error(data.error);
    return data.data;
  },

  update: async (id: string, data: { name?: string; imageFile?: File }) => {
    const formData = new FormData();
    if (data.name) formData.append('name', data.name);
    if (data.imageFile) formData.append('image', data.imageFile);

    const response = await fetch(`${API_BASE}/plants/${id}`, {
      method: 'PUT',
      body: formData,
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error);
    return result.data;
  },

  delete: (id: string) =>
    request(`/plants/${id}`, {
      method: 'DELETE',
    }),
};

// Settings API
export const settingsApi = {
  getAll: () => request<Record<string, string>>('/settings'),

  get: (key: string) => request<Record<string, string>>(`/settings/${key}`),

  update: (key: string, value: string) =>
    request(`/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }),

  updateAll: (settings: Record<string, string>) =>
    request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
};

// Generate API
export const generateApi = {
  generate: (data: {
    canvasDataUrl: string;
    plants: Array<{ name: string; imageUrl: string; color: string }>;
    mode: 'single' | 'multi';
  }) =>
    request<{ images: string[] }>('/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

// Implement API (returns SSE stream)
export const implementApi = {
  start: (_data: {
    originalImageUrl: string;
    editedImageUrl: string;
    targetImages: any[];
    plants: Array<{ name: string; imageUrl: string }>;
    prompts?: {
      analyze?: string;
      generate?: string;
      apply?: string;
    };
  }): EventSource | null => {
    // For SSE, we need to use POST but EventSource only supports GET
    // So we'll use fetch with streaming instead
    return null; // Will implement with fetch streaming
  },

  // Use this for streaming implementation
  startWithFetch: async (
    data: {
      originalImageUrl: string;
      editedImageUrl: string;
      targetImages: any[];
      plants: Array<{ name: string; imageUrl: string }>;
      prompts?: {
        analyze?: string;
        generate?: string;
        apply?: string;
      };
    },
    onMessage: (event: any) => void,
    onError: (error: Error) => void,
    onComplete: () => void
  ) => {
    try {
      const response = await fetch(`${API_BASE}/implement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              onMessage(data);
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      onComplete();
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  },
};
