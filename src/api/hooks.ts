import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createTransfer, fetchMyAccount, fetchTransactions } from './endpoints';
import type { TransferRequest } from '../types/api';

export function useAccount() {
  return useQuery({
    queryKey: ['account'],
    queryFn: fetchMyAccount,
  });
}

export function useTransactions() {
  return useQuery({
    queryKey: ['transactions'],
    queryFn: () => fetchTransactions(),
  });
}

export function useTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: TransferRequest) => createTransfer(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
