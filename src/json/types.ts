import type { ActionArguments, ValidationContext } from '../types';

export interface JsonRequest {
  apiVersion: '1.0';
  operation: 'validate' | 'isSupported' | 'getSupportedYieldIds';
  yieldId?: string;
  unsignedTransaction?: string;
  userAddress?: string;
  args?: ActionArguments;
  context?: ValidationContext;
}

export interface JsonSuccessResponse<T> {
  ok: true;
  apiVersion: '1.0';
  result: T;
  meta: {
    requestHash: string;  // SHA-256 of request for integrity verification
  };
}

export interface JsonErrorResponse {
  ok: false;
  apiVersion: '1.0';
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
  meta: {
    requestHash: string;
  };
}

export type JsonResponse<T> = JsonSuccessResponse<T> | JsonErrorResponse;

export type ErrorCode = 
  | 'PARSE_ERROR'           // Invalid JSON syntax
  | 'SCHEMA_VALIDATION_ERROR' // Failed Ajv validation
  | 'MISSING_REQUIRED_FIELD'  // Operation-specific required field missing
  | 'INTERNAL_ERROR';         // Unexpected error (should never happen)

// Result types for each operation
export interface ValidateResult {
  isValid: boolean;
  reason?: string;
  details?: unknown;
  detectedType?: string;
}

export interface IsSupportedResult {
  supported: boolean;
  yieldId: string;
}

export interface GetSupportedYieldIdsResult {
  yieldIds: string[];
}