import { BaseValidator } from './base.validator';
import { SolanaNativeStakingValidator } from './solana';
import { LidoValidator } from './evm';
import { TronValidator } from './tron';

export { BaseEVMValidator, type EVMTransaction } from './evm';

const registry = new Map<string, BaseValidator>([
  [
    'solana-sol-native-multivalidator-staking',
    new SolanaNativeStakingValidator(),
  ],
  ['ethereum-eth-lido-staking', new LidoValidator()],
  ['tron-trx-native-staking', new TronValidator()],
]);

export const validatorRegistry: ReadonlyMap<string, BaseValidator> = registry;
