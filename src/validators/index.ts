import { BaseValidator } from './base.validator';
import {
  MarinadeMsolValidator,
  MarinadeNativeValidator,
  SolanaNativeStakingValidator,
} from './solana';
import {
  EverstakeValidator,
  EVERSTAKE_NETWORKS,
  LidoValidator,
  RocketPoolValidator,
} from './evm';
import { TronValidator } from './tron';
import { ERC4626Validator, loadEmbeddedRegistry } from './evm/erc4626';

export { BaseEVMValidator, type EVMTransaction } from './evm';

const registry = new Map<string, BaseValidator>([
  [
    'solana-sol-native-multivalidator-staking',
    new SolanaNativeStakingValidator(),
  ],
  ['solana-sol-marinade-staking', new MarinadeMsolValidator()],
  [
    'solana-sol-marinade-native-max-yield-staking',
    new MarinadeNativeValidator(),
  ],
  ['ethereum-eth-lido-staking', new LidoValidator()],
  ['tron-trx-native-staking', new TronValidator()],
  ['ethereum-eth-reth-staking', new RocketPoolValidator()],
  [
    'ethereum-eth-everstake-staking',
    new EverstakeValidator(EVERSTAKE_NETWORKS.mainnet),
  ],
  [
    'ethereum-hoodi-eth-everstake-staking',
    new EverstakeValidator(EVERSTAKE_NETWORKS.hoodi),
  ],
]);

export const GENERIC_ERC4626_PROTOCOLS = new Set([
  'angle',
  'curve',
  'euler',
  'fluid',
  'gearbox',
  'idle-finance',
  'lista',
  'morpho',
  'sky',
  'summer-fi',
  'venus-flux',
  'yearn',
  'yo-protocol',
]);

const erc4626Config = loadEmbeddedRegistry();
for (const vault of erc4626Config.vaults) {
  if (!GENERIC_ERC4626_PROTOCOLS.has(vault.protocol)) continue;
  const singleVaultConfig = {
    vaults: [vault],
    lastUpdated: erc4626Config.lastUpdated,
  };
  registry.set(vault.yieldId, new ERC4626Validator(singleVaultConfig));
}

export const validatorRegistry: ReadonlyMap<string, BaseValidator> = registry;
