import Ajv from 'ajv';
import { createHash } from 'crypto';
import { Shield } from '../shield';
import { requestSchema, operationRequirements } from './schema';
import type {
  JsonRequest,
  JsonResponse,
  JsonSuccessResponse,
  JsonErrorResponse,
  ValidateResult,
  IsSupportedResult,
  GetSupportedYieldIdsResult,
  ErrorCode,
} from './types';

// SECURITY: Pre-compiled schema validator (prevents ReDoS on repeated calls)
const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile(requestSchema);

// SECURITY: Input size limit (100KB)
const MAX_INPUT_SIZE = 100 * 1024;

// Single Shield instance (stateless, safe to reuse)
const shield = new Shield();

/**
 * Computes SHA-256 hash of request for integrity verification.
 * Allows consumers to verify response corresponds to their request.
 */
function computeRequestHash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/**
 * Main entry point for JSON interface.
 *
 * SECURITY GUARANTEES:
 * 1. Input is validated against strict JSON schema before processing
 * 2. All responses include request hash for integrity verification
 * 3. Unknown properties are rejected (no injection via extra fields)
 * 4. All string inputs have length limits
 * 5. Function is pure (no side effects, no network calls)
 */
export function handleJsonRequest(jsonInput: string): string {
  const requestHash = computeRequestHash(jsonInput);

  // SECURITY: Check input size before parsing
  if (jsonInput.length > MAX_INPUT_SIZE) {
    return JSON.stringify(
      errorResponse(
        'SCHEMA_VALIDATION_ERROR',
        `Input exceeds maximum size of ${MAX_INPUT_SIZE} bytes`,
        requestHash,
      ),
    );
  }

  // Step 1: Parse JSON
  let request: unknown;
  try {
    request = JSON.parse(jsonInput);
  } catch (e) {
    return JSON.stringify(
      errorResponse('PARSE_ERROR', 'Invalid JSON syntax', requestHash, {
        parseError: e instanceof Error ? e.message : String(e),
      }),
    );
  }

  // Step 2: Validate against schema (SECURITY: strict validation)
  if (!validateSchema(request)) {
    return JSON.stringify(
      errorResponse(
        'SCHEMA_VALIDATION_ERROR',
        'Request does not match expected schema',
        requestHash,
        { validationErrors: validateSchema.errors },
      ),
    );
  }

  const validRequest = request as unknown as JsonRequest;

  // Step 3: Check operation-specific required fields
  const requiredFields = operationRequirements[validRequest.operation];
  for (const field of requiredFields) {
    if (
      !(field in validRequest) ||
      validRequest[field as keyof JsonRequest] === undefined
    ) {
      return JSON.stringify(
        errorResponse(
          'MISSING_REQUIRED_FIELD',
          `Operation '${validRequest.operation}' requires field '${field}'`,
          requestHash,
        ),
      );
    }
  }

  // Step 4: Route to appropriate handler
  try {
    switch (validRequest.operation) {
      case 'validate':
        return JSON.stringify(handleValidate(validRequest, requestHash));
      case 'isSupported':
        return JSON.stringify(handleIsSupported(validRequest, requestHash));
      case 'getSupportedYieldIds':
        return JSON.stringify(handleGetSupportedYieldIds(requestHash));
      default: {
        // SECURITY: Defense-in-depth - schema validation should prevent this
        const exhaustiveCheck: never = validRequest.operation;
        return JSON.stringify(
          errorResponse(
            'INTERNAL_ERROR',
            `Unknown operation: ${exhaustiveCheck}`,
            requestHash,
          ),
        );
      }
    }
  } catch (e) {
    // SECURITY: Never expose internal error details in production
    return JSON.stringify(
      errorResponse(
        'INTERNAL_ERROR',
        'An unexpected error occurred',
        requestHash,
      ),
    );
  }
}

function handleValidate(
  request: JsonRequest,
  requestHash: string,
): JsonResponse<ValidateResult> {
  const result = shield.validate({
    yieldId: request.yieldId!,
    unsignedTransaction: request.unsignedTransaction!,
    userAddress: request.userAddress!,
    args: request.args,
    context: request.context,
  });

  return successResponse(
    {
      isValid: result.isValid,
      reason: result.reason,
      details: result.details,
      detectedType: result.detectedType,
    },
    requestHash,
  );
}

function handleIsSupported(
  request: JsonRequest,
  requestHash: string,
): JsonResponse<IsSupportedResult> {
  return successResponse(
    {
      supported: shield.isSupported(request.yieldId!),
      yieldId: request.yieldId!,
    },
    requestHash,
  );
}

function handleGetSupportedYieldIds(
  requestHash: string,
): JsonResponse<GetSupportedYieldIdsResult> {
  return successResponse(
    {
      yieldIds: shield.getSupportedYieldIds(),
    },
    requestHash,
  );
}

// Helper functions for consistent response formatting
function successResponse<T>(
  result: T,
  requestHash: string,
): JsonSuccessResponse<T> {
  return {
    ok: true,
    apiVersion: '1.0',
    result,
    meta: { requestHash },
  };
}

function errorResponse(
  code: ErrorCode,
  message: string,
  requestHash: string,
  details?: unknown,
): JsonErrorResponse {
  return {
    ok: false,
    apiVersion: '1.0',
    error: { code, message, details },
    meta: { requestHash },
  };
}
