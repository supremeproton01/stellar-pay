export interface StellarAsset {
  code: string;
  issuer?: string;
}

export interface SwapParams {
  sourceAccount: string;
  sourceAsset: StellarAsset;
  sourceAmount: string;
  destinationAccount: string;
  destinationAsset: StellarAsset;
  destinationAmount?: string;
  slippage?: string;
  memo?: string;
  path?: StellarAsset[];
}

export interface SwapResult {
  success: boolean;
  swapId: string;
  stellarTransactionHash?: string;
  sourceAsset: StellarAsset;
  sourceAmount: string;
  destinationAsset: StellarAsset;
  destinationAmount: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  path?: StellarAsset[];
}
