export interface PaymentIntentType {
  id: string;
  amount: number;
  currency: string;
  assetCode?: string;
  assetIssuer?: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export type {
  Horizon,
  PaymentChannelStatus,
  PaymentChannelAsset,
  PaymentChannelDistribution,
  PaymentChannelSigner,
  PaymentChannel,
  ChannelCloseResult,
} from './payment-channel';

export { buildChannelCloseTransaction, closePaymentChannel } from './payment-channel';

export * from './stellar.service';
