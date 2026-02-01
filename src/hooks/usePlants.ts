import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { plantsApi } from '@/services/api';

export function usePlants() {
  return useQuery({
    queryKey: ['plants'],
    queryFn: plantsApi.getAll,
  });
}

export function usePlant(id: string | null) {
  return useQuery({
    queryKey: ['plants', id],
    queryFn: () => plantsApi.getOne(id!),
    enabled: !!id,
  });
}

export function useCreatePlant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, imageFile }: { name: string; imageFile: File }) =>
      plantsApi.create(name, imageFile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });
}

export function useUpdatePlant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { name?: string; imageFile?: File } }) =>
      plantsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });
}

export function useDeletePlant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => plantsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plants'] });
    },
  });
}
