// JSON Schema for request validation (Ajv format)
export const requestSchema = {
  type: 'object',
  required: ['apiVersion', 'operation'],
  additionalProperties: false,  // SECURITY: Reject unknown properties
  properties: {
    apiVersion: { 
      type: 'string', 
      enum: ['1.0']  // Explicit version whitelist
    },
    operation: { 
      type: 'string', 
      enum: ['validate', 'isSupported', 'getSupportedYieldIds'] 
    },
    yieldId: { 
      type: 'string',
      minLength: 1,
      maxLength: 256  // Reasonable limit
    },
    unsignedTransaction: { 
      type: 'string',
      minLength: 1,
      maxLength: 102400  // 100KB limit for transaction data
    },
    userAddress: { 
      type: 'string',
      minLength: 1,
      maxLength: 128
    },
    args: {
    type: 'object',
    additionalProperties: false,  // Security: reject unknown fields
    properties: {
        // Currently used by Tron
        validatorAddress: { type: 'string', maxLength: 128 },
        validatorAddresses: { type: 'array', items: { type: 'string', maxLength: 128 }, maxItems: 100 },
        
        // Future use - include for forward compatibility
        amount: { type: 'string', maxLength: 78 },  // Max uint256 is 78 digits
        tronResource: { type: 'string', enum: ['BANDWIDTH', 'ENERGY'] },
        providerId: { type: 'string', maxLength: 256 },
        duration: { type: 'number', minimum: 0 },
        inputToken: { type: 'string', maxLength: 128 },
        subnetId: { type: 'number', minimum: 0 },
        feeConfigurationId: { type: 'string', maxLength: 256 },
        cosmosPubKey: { type: 'string', maxLength: 256 },
        tezosPubKey: { type: 'string', maxLength: 256 },
        nominatorAddress: { type: 'string', maxLength: 128 },
        nftIds: { type: 'array', items: { type: 'string', maxLength: 256 }, maxItems: 100 },
    }
    },
    context: {
    type: 'object',
    additionalProperties: false,
    properties: {
        feeConfiguration: {
        type: 'array',
        maxItems: 100,
        items: {
            type: 'object',
            additionalProperties: false,
            properties: {
            depositFeeBps: { type: 'number', minimum: 0, maximum: 10000 },
            feeRecipientAddress: { type: 'string', maxLength: 128 },
            allocatorVaultAddress: { type: 'string', maxLength: 128 }
            }
        }
        }
    }
    }
  }
};

// Operation-specific required fields
export const operationRequirements = {
  validate: ['yieldId', 'unsignedTransaction', 'userAddress'],
  isSupported: ['yieldId'],
  getSupportedYieldIds: []
};