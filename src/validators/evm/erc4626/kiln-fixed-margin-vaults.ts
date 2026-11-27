/**
 * Shield uses this to force redeem margin "10" (no legacy amount scaling).
 */
const KILN_FIXED_MARGIN_VAULTS = new Set(
  [
    '0x75e4ce661a49b6bfb2d5b1a8231e32ab47f8b706',
    '0x2df453aa9ac59dc05030979ca67af4bbff424333',
    '0x696b456c1c79416cce302d09e935b3cb80d0cdc5',
    '0xc81ab5de4871a447f1003b90c7ff8c961702eeb2',
    '0x8168aebc65b4181f6faae8094ca133a272d03ca9',
    '0xe7bf38c635426caacfa95966c4c6064e7637fe0a',
    '0x804ee40b227b9003bb7bf2880cf502466544f208',
    '0x9c4e4c15d0532204186ef757b246253a65b4562d',
    '0x6c310b55d6728423b3bddb9d07a6c21bb6efbdcb',
    '0xeee56dc1fb5ed6ebc596da2ea1d1ecd83409f4e4',
    '0xd972f93d3f8a1b0ae072cd21ccbb6344f3407275',
    '0xbf45a2e9bba728037a714380899fd7c4ee587312',
    '0x15dcc1978f68c5e0d7a298a65fcc879e2d673d43',
    '0x90788f682463d1ac00bd2230b15a4bd0d32a3e46',
    '0x75ee9f7aa08d20788898103f28f640fff0fb85fc',
    '0xb962e0b467e4eda5b8df916c5756f9753d46914f',
    '0x96d6c438c704a2de8cdce435803a10d329b72e68',
    '0x290f5566a5269a52ad70d01ac860456b3b964f01',
    '0x2a7822d6764dfc7a945a4c38776624cb542b32f6',
    '0x67c18866e6f6bee1e9b6d0bb9055a65dba8e9348',
    '0x13a5a916356242879b9509fd12bf8e4760a3f438',
    '0x1eb1994c6de521686f5b97b017ff6afab81ff2bb',
    '0x7e865ed02f31fd3e595ef4f4b893335cf7b0af9d',
    '0x73be9526629e0c615ce22603e9efd2f3ef9b523a',
    '0xf7d7dd99b71f12a88bd6fbe421893680c02274d7',
    '0x7861a5fa53ca5367fc8a8e558944fd967f49ca43',
    '0xcec1d0f1f1c162006b027da0679a530ca42addae',
    '0xd07ddf07b8b42b30fcca1e6739d7e3df14102a29',
  ].map((a) => a.toLowerCase()),
);

export function isKilnFixedMarginVault(address: string): boolean {
  return KILN_FIXED_MARGIN_VAULTS.has(address.toLowerCase());
}
