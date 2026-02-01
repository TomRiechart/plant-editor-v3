import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsApi } from '@/services/api';

export function useCollections() {
  return useQuery({
    queryKey: ['collections'],
    queryFn: collectionsApi.getAll,
  });
}

export function useCollection(id: string | null) {
  return useQuery({
    queryKey: ['collections', id],
    queryFn: () => collectionsApi.getOne(id!),
    enabled: !!id,
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => collectionsApi.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useUpdateCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; thumbnail_url?: string } }) =>
      collectionsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => collectionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useAddCollectionImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, files }: { collectionId: string; files: File[] }) =>
      collectionsApi.addImages(collectionId, files),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useSetMainImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, imageId }: { collectionId: string; imageId: string }) =>
      collectionsApi.setMainImage(collectionId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useDeleteCollectionImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, imageId }: { collectionId: string; imageId: string }) =>
      collectionsApi.deleteImage(collectionId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}

export function useReorderCollectionImages() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ collectionId, imageIds }: { collectionId: string; imageIds: string[] }) =>
      collectionsApi.reorderImages(collectionId, imageIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collections'] });
    },
  });
}
