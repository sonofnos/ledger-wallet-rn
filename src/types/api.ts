export interface User {
  id: string;
  email: string;
  fullName: string;
}

export interface Account {
  id: string;
  ownerId: string;
  balanceCents: number;
  currency: string;
  accountNumber: string;
}

export type TransactionType = 'credit' | 'debit';
export type TransactionStatus = 'completed' | 'failed' | 'pending';

export interface Transaction {
  id: string;
  type: TransactionType;
  amountCents: number;
  counterparty: string;
  status: TransactionStatus;
  createdAt: string;
}

export interface TransactionPage {
  items: Transaction[];
  nextCursor: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface TransferRequest {
  toAccountNumber: string;
  amountCents: number;
  idempotencyKey: string;
}

export interface TransferResponse {
  id: string;
  status: TransactionStatus;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
