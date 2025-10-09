import { Shield } from '../../../shield';
import { TransactionType } from '../../../types';
import { TronWeb } from 'tronweb';

describe('TronValidator via Shield', () => {
  const shield = new Shield();
  const yieldId = 'tron-trx-native-staking';

  const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
  });

  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  describe('isSupported', () => {
    it('should support tron-trx-native-staking yield', () => {
      expect(shield.isSupported(yieldId)).toBe(true);
      expect(shield.getSupportedYieldIds()).toContain(yieldId);
    });
  });

  describe('validate - Real Transactions', () => {
    it('should validate real claim rewards transaction', () => {
      const claimTx =
        '{"txID":"9aa4e6b625df3576eebe31d23cd277c5c36bbd5f200f17bb531ccc682e8b0321","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"4143edd6b0921ac39ae61605085a93dd5140e1c7cf"},"type_url":"type.googleapis.com/protocol.WithdrawBalanceContract"},"type":"WithdrawBalanceContract"}],"ref_block_bytes":"1932","ref_block_hash":"b9d40780530e8930","expiration":1759925124000,"timestamp":1759924764000},"raw_data_hex":"0a0219322208b9d40780530e893040a0f7d89d9c335a53080d124f0a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e576974686472617742616c616e6365436f6e747261637412170a154143edd6b0921ac39ae61605085a93dd5140e1c7cf70e0fac29d9c33","visible":false}';

      const userAddress = 'TGAPCEGDzbHLF8RzmyAWJZiY9iELhXKYRm';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: claimTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.CLAIM_REWARDS);
    });

    it('should reject real claim rewards transaction with wrong user address', () => {
      const claimTx =
        '{"txID":"9aa4e6b625df3576eebe31d23cd277c5c36bbd5f200f17bb531ccc682e8b0321","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"4143edd6b0921ac39ae61605085a93dd5140e1c7cf"},"type_url":"type.googleapis.com/protocol.WithdrawBalanceContract"},"type":"WithdrawBalanceContract"}],"ref_block_bytes":"1932","ref_block_hash":"b9d40780530e8930","expiration":1759925124000,"timestamp":1759924764000},"raw_data_hex":"0a0219322208b9d40780530e893040a0f7d89d9c335a53080d124f0a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e576974686472617742616c616e6365436f6e747261637412170a154143edd6b0921ac39ae61605085a93dd5140e1c7cf70e0fac29d9c33","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: claimTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const claimAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.CLAIM_REWARDS,
      );
      expect(claimAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real vote transaction', () => {
      const voteTx =
        '{"txID":"d833679c65ef03a8d9c22fd7f1b1822ab161bf96d6abc58cd76823d246c5b7ca","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"41057bca13d5460ba59b2b2f31875d3f6fc0697efa","votes":[{"vote_address":"41a4ce68cfcdd27884bde52cec653354048e0aa989","vote_count":2960}]},"type_url":"type.googleapis.com/protocol.VoteWitnessContract"},"type":"VoteWitnessContract"}],"ref_block_bytes":"1788","ref_block_hash":"6fb654ffee691687","expiration":1759923846000,"timestamp":1759923486000},"raw_data_hex":"0a02178822086fb654ffee69168740f0f68a9d9c335a6b080412670a30747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e566f74655769746e657373436f6e747261637412330a1541057bca13d5460ba59b2b2f31875d3f6fc0697efa121a0a1541a4ce68cfcdd27884bde52cec653354048e0aa98910901770b0faf49c9c33","visible":false}';

      const userAddress = 'TAUCg45zy5JCyzR5xEBX2EKm2bVNFvDKn5';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: voteTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.VOTE);
    });

    it('should validate real vote transaction with validator address args', () => {
      const voteTx =
        '{"txID":"d833679c65ef03a8d9c22fd7f1b1822ab161bf96d6abc58cd76823d246c5b7ca","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"41057bca13d5460ba59b2b2f31875d3f6fc0697efa","votes":[{"vote_address":"41a4ce68cfcdd27884bde52cec653354048e0aa989","vote_count":2960}]},"type_url":"type.googleapis.com/protocol.VoteWitnessContract"},"type":"VoteWitnessContract"}],"ref_block_bytes":"1788","ref_block_hash":"6fb654ffee691687","expiration":1759923846000,"timestamp":1759923486000},"raw_data_hex":"0a02178822086fb654ffee69168740f0f68a9d9c335a6b080412670a30747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e566f74655769746e657373436f6e747261637412330a1541057bca13d5460ba59b2b2f31875d3f6fc0697efa121a0a1541a4ce68cfcdd27884bde52cec653354048e0aa98910901770b0faf49c9c33","visible":false}';

      const userAddress = 'TAUCg45zy5JCyzR5xEBX2EKm2bVNFvDKn5';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: voteTx,
        userAddress,
        args: {
          validatorAddresses: ['TQzd66b9EFVHJfZK5AmiVhBjtJvXGeSPPZ'],
        },
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.VOTE);
    });

    it('should reject real vote transaction with wrong user address', () => {
      const voteTx =
        '{"txID":"d833679c65ef03a8d9c22fd7f1b1822ab161bf96d6abc58cd76823d246c5b7ca","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"41057bca13d5460ba59b2b2f31875d3f6fc0697efa","votes":[{"vote_address":"41a4ce68cfcdd27884bde52cec653354048e0aa989","vote_count":2960}]},"type_url":"type.googleapis.com/protocol.VoteWitnessContract"},"type":"VoteWitnessContract"}],"ref_block_bytes":"1788","ref_block_hash":"6fb654ffee691687","expiration":1759923846000,"timestamp":1759923486000},"raw_data_hex":"0a02178822086fb654ffee69168740f0f68a9d9c335a6b080412670a30747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e566f74655769746e657373436f6e747261637412330a1541057bca13d5460ba59b2b2f31875d3f6fc0697efa121a0a1541a4ce68cfcdd27884bde52cec653354048e0aa98910901770b0faf49c9c33","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: voteTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const voteAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.VOTE,
      );
      expect(voteAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real withdraw transaction', () => {
      const withdrawTx =
        '{"txID":"0145ec8ed4cfad5b614139bf58235e2428cd9e0dc2970287ca6a6fced32423c0","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"418157bf85775bc14ae8af74c1fe86808bf2c65c3e"},"type_url":"type.googleapis.com/protocol.WithdrawExpireUnfreezeContract"},"type":"WithdrawExpireUnfreezeContract"}],"ref_block_bytes":"1751","ref_block_hash":"31bfd6037b66177a","expiration":1759923681000,"timestamp":1759923321000},"raw_data_hex":"0a021751220831bfd6037b66177a40e8ed809d9c335a5a083812560a3b747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5769746864726177457870697265556e667265657a65436f6e747261637412170a15418157bf85775bc14ae8af74c1fe86808bf2c65c3e70a8f1ea9c9c33","visible":false}';

      const userAddress = 'TMm7HemvJCFbxx9oe2cQcyePjfDjc5JDDc';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: withdrawTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.WITHDRAW);
    });

    it('should reject real withdraw transaction with wrong user address', () => {
      const withdrawTx =
        '{"txID":"0145ec8ed4cfad5b614139bf58235e2428cd9e0dc2970287ca6a6fced32423c0","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"418157bf85775bc14ae8af74c1fe86808bf2c65c3e"},"type_url":"type.googleapis.com/protocol.WithdrawExpireUnfreezeContract"},"type":"WithdrawExpireUnfreezeContract"}],"ref_block_bytes":"1751","ref_block_hash":"31bfd6037b66177a","expiration":1759923681000,"timestamp":1759923321000},"raw_data_hex":"0a021751220831bfd6037b66177a40e8ed809d9c335a5a083812560a3b747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e5769746864726177457870697265556e667265657a65436f6e747261637412170a15418157bf85775bc14ae8af74c1fe86808bf2c65c3e70a8f1ea9c9c33","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: withdrawTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const withdrawAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.WITHDRAW,
      );
      expect(withdrawAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real freeze energy transaction', () => {
      const freezeTx =
        '{"txID":"bcce7b5dc925dcea81d8bcd42a025300b811d330cefee1195c6e9aeb0ea5b3f2","raw_data":{"contract":[{"parameter":{"value":{"resource":"ENERGY","frozen_balance":3500000000,"owner_address":"41ba9406e2290365a47277de962130fc0f2927421e"},"type_url":"type.googleapis.com/protocol.FreezeBalanceV2Contract"},"type":"FreezeBalanceV2Contract"}],"ref_block_bytes":"1200","ref_block_hash":"20e4efb6a2473e98","expiration":1759919598000,"timestamp":1759919238000},"raw_data_hex":"0a021200220820e4efb6a2473e9840b0d3879b9c335a5b083612570a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e467265657a6542616c616e63655632436f6e7472616374121f0a1541ba9406e2290365a47277de962130fc0f2927421e108086f7840d180170f0d6f19a9c33","visible":false}';

      const userAddress = 'TSyk1pyZawUgYQ2cCuWovrKUpffetKxqJb';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: freezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.FREEZE_ENERGY);
    });

    it('should reject real freeze energy transaction with wrong user address', () => {
      const freezeTx =
        '{"txID":"bcce7b5dc925dcea81d8bcd42a025300b811d330cefee1195c6e9aeb0ea5b3f2","raw_data":{"contract":[{"parameter":{"value":{"resource":"ENERGY","frozen_balance":3500000000,"owner_address":"41ba9406e2290365a47277de962130fc0f2927421e"},"type_url":"type.googleapis.com/protocol.FreezeBalanceV2Contract"},"type":"FreezeBalanceV2Contract"}],"ref_block_bytes":"1200","ref_block_hash":"20e4efb6a2473e98","expiration":1759919598000,"timestamp":1759919238000},"raw_data_hex":"0a021200220820e4efb6a2473e9840b0d3879b9c335a5b083612570a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e467265657a6542616c616e63655632436f6e7472616374121f0a1541ba9406e2290365a47277de962130fc0f2927421e108086f7840d180170f0d6f19a9c33","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: freezeTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const freezeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.FREEZE_ENERGY,
      );
      expect(freezeAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real unfreeze energy transaction', () => {
      const unfreezeTx =
        '{"txID":"53d3b92af1efced368224c6d0081626840af6dfbf48fe507acca2e2b6572c5f3","raw_data":{"contract":[{"parameter":{"value":{"resource":"ENERGY","owner_address":"41f896ca7a340d7838a59864c6b8c86c85cb41b9cc","unfreeze_balance":579000000},"type_url":"type.googleapis.com/protocol.UnfreezeBalanceV2Contract"},"type":"UnfreezeBalanceV2Contract"}],"ref_block_bytes":"0441","ref_block_hash":"57caa9aa29f455f1","expiration":1759909041000,"timestamp":1759908681000},"raw_data_hex":"0a020441220857caa9aa29f455f140e8a683969c335a5d083712590a36747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e556e667265657a6542616c616e63655632436f6e7472616374121f0a1541f896ca7a340d7838a59864c6b8c86c85cb41b9cc10c0ad8b9402180170a8aaed959c33","visible":false}';

      const userAddress = 'TYddDmdLkdoGZYm6ZpYaC9WWBqxZRk6YKT';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: unfreezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNFREEZE_ENERGY);
    });

    it('should reject real unfreeze energy transaction with wrong user address', () => {
      const unfreezeTx =
        '{"txID":"53d3b92af1efced368224c6d0081626840af6dfbf48fe507acca2e2b6572c5f3","raw_data":{"contract":[{"parameter":{"value":{"resource":"ENERGY","owner_address":"41f896ca7a340d7838a59864c6b8c86c85cb41b9cc","unfreeze_balance":579000000},"type_url":"type.googleapis.com/protocol.UnfreezeBalanceV2Contract"},"type":"UnfreezeBalanceV2Contract"}],"ref_block_bytes":"0441","ref_block_hash":"57caa9aa29f455f1","expiration":1759909041000,"timestamp":1759908681000},"raw_data_hex":"0a020441220857caa9aa29f455f140e8a683969c335a5d083712590a36747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e556e667265657a6542616c616e63655632436f6e7472616374121f0a1541f896ca7a340d7838a59864c6b8c86c85cb41b9cc10c0ad8b9402180170a8aaed959c33","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: unfreezeTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const unfreezeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNFREEZE_ENERGY,
      );
      expect(unfreezeAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real unfreeze bandwidth transaction', () => {
      const unfreezeTx =
        '{"txID":"549a0a7701f9310d8a0f2837c844eaada07e60c259b7fdf83cac544fabb579c0","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"419c9ece237a8bc6cd9a93718275b9f42038d4a0fb","unfreeze_balance":10680000000},"type_url":"type.googleapis.com/protocol.UnfreezeBalanceV2Contract"},"type":"UnfreezeBalanceV2Contract"}],"ref_block_bytes":"a422","ref_block_hash":"1d21d34c18cc3ae0","expiration":1738002903000,"timestamp":1738002543000},"raw_data_hex":"0a02a42222081d21d34c18cc3ae040d8dfaec8ca325a5b083712570a36747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e556e667265657a6542616c616e63655632436f6e7472616374121d0a15419c9ece237a8bc6cd9a93718275b9f42038d4a0fb1080bccfe4277098e398c8ca32","visible":false}';

      const userAddress = 'TQFLexwUKagmfRQmGPqJRkrHQkF1JrGPYJ';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: unfreezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNFREEZE_BANDWIDTH);
    });

    it('should reject real unfreeze bandwidth transaction with wrong user address', () => {
      const unfreezeTx =
        '{"txID":"549a0a7701f9310d8a0f2837c844eaada07e60c259b7fdf83cac544fabb579c0","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"419c9ece237a8bc6cd9a93718275b9f42038d4a0fb","unfreeze_balance":10680000000},"type_url":"type.googleapis.com/protocol.UnfreezeBalanceV2Contract"},"type":"UnfreezeBalanceV2Contract"}],"ref_block_bytes":"a422","ref_block_hash":"1d21d34c18cc3ae0","expiration":1738002903000,"timestamp":1738002543000},"raw_data_hex":"0a02a42222081d21d34c18cc3ae040d8dfaec8ca325a5b083712570a36747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e556e667265657a6542616c616e63655632436f6e7472616374121d0a15419c9ece237a8bc6cd9a93718275b9f42038d4a0fb1080bccfe4277098e398c8ca32","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: unfreezeTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const unfreezeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNFREEZE_BANDWIDTH,
      );
      expect(unfreezeAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real freeze bandwidth transaction', () => {
      const freezeTx =
        '{"txID":"821e65f6515ef916be5ea90b81999224bc2d785ec8a24439e099b295ca91db28","raw_data":{"contract":[{"parameter":{"value":{"frozen_balance":23000000,"owner_address":"41eb63f920ce15fc647dd074adb38954a91dc4dcd4"},"type_url":"type.googleapis.com/protocol.FreezeBalanceV2Contract"},"type":"FreezeBalanceV2Contract"}],"ref_block_bytes":"baad","ref_block_hash":"8423251e9aab3732","expiration":1700645559000,"timestamp":1700645199000},"raw_data_hex":"0a02baad22088423251e9aab373240d8b5ffb2bf315a58083612540a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e467265657a6542616c616e63655632436f6e7472616374121c0a1541eb63f920ce15fc647dd074adb38954a91dc4dcd410c0e7fb0a7098b9e9b2bf31","visible":false}';

      const userAddress = 'TXRqZPuvcZMGwzZyJpekueL6nPa6uPPNTW';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: freezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.FREEZE_BANDWIDTH);
    });

    it('should reject real freeze bandwidth transaction with wrong user address', () => {
      const freezeTx =
        '{"txID":"821e65f6515ef916be5ea90b81999224bc2d785ec8a24439e099b295ca91db28","raw_data":{"contract":[{"parameter":{"value":{"frozen_balance":23000000,"owner_address":"41eb63f920ce15fc647dd074adb38954a91dc4dcd4"},"type_url":"type.googleapis.com/protocol.FreezeBalanceV2Contract"},"type":"FreezeBalanceV2Contract"}],"ref_block_bytes":"baad","ref_block_hash":"8423251e9aab3732","expiration":1700645559000,"timestamp":1700645199000},"raw_data_hex":"0a02baad22088423251e9aab373240d8b5ffb2bf315a58083612540a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e467265657a6542616c616e63655632436f6e7472616374121c0a1541eb63f920ce15fc647dd074adb38954a91dc4dcd410c0e7fb0a7098b9e9b2bf31","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: freezeTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const freezeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.FREEZE_BANDWIDTH,
      );
      expect(freezeAttempt?.reason).toContain('does not match user address');
    });

    it('should validate real legacy unfreeze bandwidth transaction', () => {
      const legacyUnfreezeTx =
        '{"txID":"3520e0927ea6608345d01d0f2cd3049b8488447a91fe9bd7493dbc7733910c6b","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"411d99e7fa6bef5e4df67e20963d0f8de4e16a4b8a"},"type_url":"type.googleapis.com/protocol.UnfreezeBalanceContract"},"type":"UnfreezeBalanceContract"}],"ref_block_bytes":"48b2","ref_block_hash":"85cae5017208fe4c","expiration":1729869234000,"timestamp":1729868874000},"raw_data_hex":"0a0248b2220885cae5017208fe4c40d0fef6a1ac325a53080c124f0a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e556e667265657a6542616c616e6365436f6e747261637412170a15411d99e7fa6bef5e4df67e20963d0f8de4e16a4b8a709082e1a1ac32","visible":false}';

      const userAddress = 'TCfiyD8KTX61qvg7T6XZeZhNRRPPD5bwtz';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: legacyUnfreezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(
        TransactionType.UNFREEZE_LEGACY_BANDWIDTH,
      );
    });

    it('should reject real legacy unfreeze bandwidth transaction with wrong user address', () => {
      const legacyUnfreezeTx =
        '{"txID":"3520e0927ea6608345d01d0f2cd3049b8488447a91fe9bd7493dbc7733910c6b","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"411d99e7fa6bef5e4df67e20963d0f8de4e16a4b8a"},"type_url":"type.googleapis.com/protocol.UnfreezeBalanceContract"},"type":"UnfreezeBalanceContract"}],"ref_block_bytes":"48b2","ref_block_hash":"85cae5017208fe4c","expiration":1729869234000,"timestamp":1729868874000},"raw_data_hex":"0a0248b2220885cae5017208fe4c40d0fef6a1ac325a53080c124f0a34747970652e676f6f676c65617069732e636f6d2f70726f746f636f6c2e556e667265657a6542616c616e6365436f6e747261637412170a15411d99e7fa6bef5e4df67e20963d0f8de4e16a4b8a709082e1a1ac32","visible":false}';

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: legacyUnfreezeTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const legacyUnfreezeAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNFREEZE_LEGACY_BANDWIDTH,
      );
      expect(legacyUnfreezeAttempt?.reason).toContain(
        'does not match user address',
      );
    });

    it('should validate synthetic undelegate bandwidth transaction', () => {
      const undelegateTx = JSON.stringify({
        txID: 'synthetic-undelegate-bandwidth-test',
        raw_data: {
          contract: [
            {
              parameter: {
                value: {
                  owner_address: '41cb4a2c67a37fa22a80a10988dd954d9f2c834cf7',
                  receiver_address:
                    '41a4ce68cfcdd27884bde52cec653354048e0aa989',
                  balance: 1000000,
                  resource: 'BANDWIDTH',
                },
                type_url:
                  'type.googleapis.com/protocol.UnDelegateResourceContract',
              },
              type: 'UnDelegateResourceContract',
            },
          ],
          ref_block_bytes: 'e979',
          ref_block_hash: '9b56037474cd829d',
          expiration: 1759691787000,
          timestamp: 1759691427000,
        },
      });

      const userAddress = 'TUW72fPVWwTQzWWn77jRbrS5CmXD7j4e2a';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: undelegateTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNDELEGATE_BANDWIDTH);
    });

    it('should validate synthetic undelegate energy transaction', () => {
      const undelegateTx = JSON.stringify({
        txID: 'synthetic-undelegate-energy-test',
        raw_data: {
          contract: [
            {
              parameter: {
                value: {
                  owner_address: '41cb4a2c67a37fa22a80a10988dd954d9f2c834cf7',
                  receiver_address:
                    '41a4ce68cfcdd27884bde52cec653354048e0aa989',
                  balance: 2000000,
                  resource: 'ENERGY',
                },
                type_url:
                  'type.googleapis.com/protocol.UnDelegateResourceContract',
              },
              type: 'UnDelegateResourceContract',
            },
          ],
          ref_block_bytes: 'e979',
          ref_block_hash: '9b56037474cd829d',
          expiration: 1759691787000,
          timestamp: 1759691427000,
        },
      });

      const userAddress = 'TUW72fPVWwTQzWWn77jRbrS5CmXD7j4e2a';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: undelegateTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNDELEGATE_ENERGY);
    });

    it('should validate synthetic legacy unfreeze bandwidth transaction', () => {
      const legacyUnfreezeTx = JSON.stringify({
        txID: 'synthetic-legacy-unfreeze-bandwidth-test',
        raw_data: {
          contract: [
            {
              parameter: {
                value: {
                  owner_address: '41cb4a2c67a37fa22a80a10988dd954d9f2c834cf7',
                  resource: 'BANDWIDTH',
                },
                type_url:
                  'type.googleapis.com/protocol.UnfreezeBalanceContract',
              },
              type: 'UnfreezeBalanceContract',
            },
          ],
          ref_block_bytes: 'e979',
          ref_block_hash: '9b56037474cd829d',
          expiration: 1759691787000,
          timestamp: 1759691427000,
        },
      });

      const userAddress = 'TUW72fPVWwTQzWWn77jRbrS5CmXD7j4e2a';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: legacyUnfreezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(
        TransactionType.UNFREEZE_LEGACY_BANDWIDTH,
      );
    });

    it('should validate synthetic legacy unfreeze energy transaction', () => {
      const legacyUnfreezeTx = JSON.stringify({
        txID: 'synthetic-legacy-unfreeze-energy-test',
        raw_data: {
          contract: [
            {
              parameter: {
                value: {
                  owner_address: '41cb4a2c67a37fa22a80a10988dd954d9f2c834cf7',
                  resource: 'ENERGY',
                },
                type_url:
                  'type.googleapis.com/protocol.UnfreezeBalanceContract',
              },
              type: 'UnfreezeBalanceContract',
            },
          ],
          ref_block_bytes: 'e979',
          ref_block_hash: '9b56037474cd829d',
          expiration: 1759691787000,
          timestamp: 1759691427000,
        },
      });

      const userAddress = 'TUW72fPVWwTQzWWn77jRbrS5CmXD7j4e2a';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: legacyUnfreezeTx,
        userAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNFREEZE_LEGACY_ENERGY);
    });

    it('should reject synthetic undelegate bandwidth transaction with wrong user address', () => {
      const undelegateTx = JSON.stringify({
        txID: 'synthetic-undelegate-bandwidth-test',
        raw_data: {
          contract: [
            {
              parameter: {
                value: {
                  owner_address: '41cb4a2c67a37fa22a80a10988dd954d9f2c834cf7',
                  receiver_address:
                    '41a4ce68cfcdd27884bde52cec653354048e0aa989',
                  balance: 1000000,
                  resource: 'BANDWIDTH',
                },
                type_url:
                  'type.googleapis.com/protocol.UnDelegateResourceContract',
              },
              type: 'UnDelegateResourceContract',
            },
          ],
          ref_block_bytes: 'e979',
          ref_block_hash: '9b56037474cd829d',
          expiration: 1759691787000,
          timestamp: 1759691427000,
        },
      });

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: undelegateTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const undelegateAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNDELEGATE_BANDWIDTH,
      );
      expect(undelegateAttempt?.reason).toContain(
        'does not match user address',
      );
    });

    it('should reject synthetic undelegate energy transaction with wrong user address', () => {
      const undelegateTx = JSON.stringify({
        txID: 'synthetic-undelegate-energy-test',
        raw_data: {
          contract: [
            {
              parameter: {
                value: {
                  owner_address: '41cb4a2c67a37fa22a80a10988dd954d9f2c834cf7',
                  receiver_address:
                    '41a4ce68cfcdd27884bde52cec653354048e0aa989',
                  balance: 2000000,
                  resource: 'ENERGY',
                },
                type_url:
                  'type.googleapis.com/protocol.UnDelegateResourceContract',
              },
              type: 'UnDelegateResourceContract',
            },
          ],
          ref_block_bytes: 'e979',
          ref_block_hash: '9b56037474cd829d',
          expiration: 1759691787000,
          timestamp: 1759691427000,
        },
      });

      const wrongUserAddress = 'THkanDLCofAmrRUR2RgyZVm8h74eTMfkmX';
      const result = shield.validate({
        yieldId,
        unsignedTransaction: undelegateTx,
        userAddress: wrongUserAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('No matching operation pattern found');

      const undelegateAttempt = result.details?.attempts?.find(
        (a: any) => a.type === TransactionType.UNDELEGATE_ENERGY,
      );
      expect(undelegateAttempt?.reason).toContain(
        'does not match user address',
      );
    });
  });

  describe('SDK Transaction Construction Tests', () => {
    const testAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';

    it('should validate SDK-constructed freeze transactions', async () => {
      const freezeBandwidthTx =
        await tronWeb.transactionBuilder.freezeBalanceV2(
          1000000,
          'BANDWIDTH',
          testAddress,
        );

      let result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(freezeBandwidthTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.FREEZE_BANDWIDTH);

      await delay(500);

      const freezeEnergyTx = await tronWeb.transactionBuilder.freezeBalanceV2(
        1000000,
        'ENERGY',
        testAddress,
      );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(freezeEnergyTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.FREEZE_ENERGY);
    });

    it('should validate SDK-constructed unfreeze transactions', async () => {
      await delay(500);

      const unfreezeBandwidthTx =
        await tronWeb.transactionBuilder.unfreezeBalanceV2(
          1000000,
          'BANDWIDTH',
          testAddress,
        );

      let result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(unfreezeBandwidthTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNFREEZE_BANDWIDTH);

      await delay(500);

      const unfreezeEnergyTx =
        await tronWeb.transactionBuilder.unfreezeBalanceV2(
          1000000,
          'ENERGY',
          testAddress,
        );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(unfreezeEnergyTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNFREEZE_ENERGY);
    });

    it('should validate SDK-constructed vote transaction', async () => {
      await delay(500);

      const validatorAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';
      const voteTx = await tronWeb.transactionBuilder.vote(
        {
          [validatorAddress]: 1000,
        },
        testAddress,
      );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(voteTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.VOTE);
    });

    it('should validate SDK-constructed withdraw transaction', async () => {
      await delay(500);

      const withdrawTx =
        await tronWeb.transactionBuilder.withdrawExpireUnfreeze(testAddress);

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(withdrawTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.WITHDRAW);
    });

    it('should validate SDK-constructed claim rewards transaction', async () => {
      await delay(500);

      const claimTx =
        await tronWeb.transactionBuilder.withdrawBlockRewards(testAddress);

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(claimTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.CLAIM_REWARDS);
    });

    it('should validate SDK-constructed undelegate transactions', async () => {
      await delay(500);

      const receiverAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';

      const undelegateBandwidthTx =
        await tronWeb.transactionBuilder.undelegateResource(
          1000000,
          receiverAddress,
          'BANDWIDTH',
          testAddress,
        );

      let result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(undelegateBandwidthTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNDELEGATE_BANDWIDTH);

      await delay(500);

      const undelegateEnergyTx =
        await tronWeb.transactionBuilder.undelegateResource(
          1000000,
          receiverAddress,
          'ENERGY',
          testAddress,
        );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(undelegateEnergyTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNDELEGATE_ENERGY);
    });

    it('should validate SDK-constructed legacy unfreeze transactions', async () => {
      await delay(500);

      const legacyUnfreezeBandwidthTx =
        await tronWeb.transactionBuilder.unfreezeBalance(
          'BANDWIDTH',
          testAddress,
          testAddress,
        );

      let result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(legacyUnfreezeBandwidthTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(
        TransactionType.UNFREEZE_LEGACY_BANDWIDTH,
      );

      await delay(500);

      const legacyUnfreezeEnergyTx =
        await tronWeb.transactionBuilder.unfreezeBalance(
          'ENERGY',
          testAddress,
          testAddress,
        );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(legacyUnfreezeEnergyTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.UNFREEZE_LEGACY_ENERGY);
    });

    it('should block SDK-constructed malicious transactions', async () => {
      await delay(500);

      const maliciousAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';

      const transferTx = await tronWeb.transactionBuilder.sendTrx(
        maliciousAddress,
        1000000,
        testAddress,
      );

      let result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(transferTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious/,
      );

      await delay(500);

      const delegateTx = await tronWeb.transactionBuilder.delegateResource(
        1000000,
        maliciousAddress,
        'BANDWIDTH',
        testAddress,
      );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(delegateTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious/,
      );
    });
  });

  describe('Security Tests - Blocking Non-Staking Transactions', () => {
    it('should block TRX transfer transaction disguised as staking', async () => {
      await delay(500);

      const fromAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';
      const toAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';

      const transferTx = await tronWeb.transactionBuilder.sendTrx(
        toAddress,
        1000000,
        fromAddress,
      );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(transferTx),
        userAddress: fromAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should block TRC20 transfer transaction', async () => {
      await delay(500);

      const fromAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';
      const toAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';
      const usdtContract = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

      const contractTx = await tronWeb.transactionBuilder.triggerSmartContract(
        usdtContract,
        'transfer(address,uint256)',
        {},
        [
          { type: 'address', value: toAddress },
          { type: 'uint256', value: 1000000 },
        ],
        fromAddress,
      );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(contractTx.transaction),
        userAddress: fromAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should block asset transfer (TRC10) transaction', async () => {
      await delay(500);

      const fromAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';
      const toAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';

      const assetTransferTx = await tronWeb.transactionBuilder.sendAsset(
        toAddress,
        100000,
        '1000001',
        fromAddress,
      );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(assetTransferTx),
        userAddress: fromAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should block smart contract creation transaction', async () => {
      await delay(500);

      const fromAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';

      const createContractTx =
        await tronWeb.transactionBuilder.createSmartContract(
          {
            abi: JSON.stringify([{ name: 'test', type: 'function' }]),
            bytecode: '608060405234801561001057600080fd5b50',
            name: 'TestContract',
            userFeePercentage: 100,
          },
          fromAddress,
        );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(createContractTx),
        userAddress: fromAddress,
      });

      expect(result.isValid).toBe(false);

      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should block account permission update transaction', () => {
      const updatePermissionTx =
        '{"txID":"fake-permission-update-tx-id","raw_data":{"contract":[{"parameter":{"value":{"owner_address":"41eb63f920ce15fc647dd074adb38954a91dc4dcd4","owner":{"type":0,"permission_name":"owner","threshold":1,"keys":[{"address":"41a4ce68cfcdd27884bde52cec653354048e0aa989","weight":1}]}},"type_url":"type.googleapis.com/protocol.AccountPermissionUpdateContract"},"type":"AccountPermissionUpdateContract"}],"ref_block_bytes":"1932","ref_block_hash":"b9d40780530e8930","expiration":1759925124000,"timestamp":1759924764000},"raw_data_hex":"0a0219322208b9d40780530e893040a0f7d89d9c33","visible":false}';

      const result = shield.validate({
        yieldId,
        unsignedTransaction: updatePermissionTx,
        userAddress: 'TWrNNdLHhMYM8oUL5xNZH5GyBHnk5UgBKJ',
      });

      expect(result.isValid).toBe(false);

      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should block delegate resource transaction when expecting undelegate', async () => {
      await delay(500);

      const fromAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';
      const toAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';

      const delegateTx = await tronWeb.transactionBuilder.delegateResource(
        1000000,
        toAddress,
        'BANDWIDTH',
        fromAddress,
        false,
      );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(delegateTx),
        userAddress: fromAddress,
      });

      expect(result.isValid).toBe(false);
      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should block exchange transaction', async () => {
      await delay(500);

      const fromAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';

      const exchangeTx = await tronWeb.transactionBuilder.tradeExchangeTokens(
        1,
        '_',
        1000000,
        100,
        fromAddress,
      );

      const result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(exchangeTx),
        userAddress: fromAddress,
      });

      expect(result.isValid).toBe(false);

      expect(result.reason).toMatch(
        /No matching operation pattern found|Transaction may be malicious or corrupted/,
      );
    });

    it('should allow valid staking transactions', async () => {
      await delay(500);

      const testAddress = 'TUxd6v64YTWkfpFpNDdtgc5Ps4SfGxwizT';
      const freezeBandwidthTx =
        await tronWeb.transactionBuilder.freezeBalanceV2(
          23000000,
          'BANDWIDTH',
          testAddress,
        );

      let result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(freezeBandwidthTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.FREEZE_BANDWIDTH);

      await delay(500);

      const freezeEnergyTx = await tronWeb.transactionBuilder.freezeBalanceV2(
        3500000000,
        'ENERGY',
        testAddress,
      );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(freezeEnergyTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.FREEZE_ENERGY);

      await delay(500);

      const validatorAddress = 'TGzz8gjYiYRqpfmDwnLxfgPuLVNmpCswVp';
      const voteTx = await tronWeb.transactionBuilder.vote(
        {
          [validatorAddress]: 2960,
        },
        testAddress,
      );

      result = shield.validate({
        yieldId,
        unsignedTransaction: JSON.stringify(voteTx),
        userAddress: testAddress,
      });

      expect(result.isValid).toBe(true);
      expect(result.detectedType).toBe(TransactionType.VOTE);
    });
  });
});
