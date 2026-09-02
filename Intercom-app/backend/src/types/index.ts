export type Nullable<T> = T | null;

export type PaginationQuery = {
  page?: number;
  limit?: number;
};

export type AuthenticatedUser = {
  id: number;
  email: string;
  role: string;
};

export type {
  IntelligenceEmployeeMatch,
  IntelligenceRelatedCase,
  IntelligenceSnapshot
} from './intelligence.types.js';
