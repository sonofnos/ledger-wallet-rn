import { apiRequest } from './client';
import type {
  Account,
  AuthResponse,
  TransactionPage,
  TransferRequest,
  TransferResponse,
} from '../types/api';

export function login(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    auth: false,
  });
}

export function register(email: string, password: string, fullName: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: { email, password, fullName },
    auth: false,
  });
}

export function fetchMyAccount(): Promise<Account> {
  return apiRequest<Account>('/accounts/me');
}

export function fetchTransactions(cursor?: string): Promise<TransactionPage> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
  return apiRequest<TransactionPage>(`/transactions${query}`);
}

export function createTransfer(payload: TransferRequest): Promise<TransferResponse> {
  return apiRequest<TransferResponse>('/transfers', {
    method: 'POST',
    body: payload,
  });
}
