import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, listUsers, updateUser } from '../api/users';
import { UserCreate, UserOut, UserUpdate } from '../types/users';
import { queryKeys } from '../api/queryKeys';

export function useUserList() {
  return useQuery({
    queryKey: queryKeys.userList(),
    queryFn: listUsers,
  });
}

// These three write the response straight into the cached list (as the pre-migration screen
// did with local state) instead of invalidating, so the row updates immediately without an
// extra round trip.
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UserCreate) => createUser(payload),
    onSuccess: created => {
      queryClient.setQueryData<UserOut[]>(queryKeys.userList(), current =>
        [...(current ?? []), created].sort((first, second) => first.username.localeCompare(second.username)),
      );
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: UserUpdate }) => updateUser(userId, payload),
    onSuccess: updated => {
      queryClient.setQueryData<UserOut[]>(queryKeys.userList(), current =>
        current?.map(item => (item.id === updated.id ? updated : item)),
      );
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => deleteUser(userId),
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<UserOut[]>(queryKeys.userList(), current =>
        current?.filter(item => item.id !== userId),
      );
    },
  });
}
