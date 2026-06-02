import * as StellarSdk from 'stellar-sdk';

export interface ReceivePaymentParams {
  address: string;
  timeoutMs?: number;
  assetCode?: string;
  assetIssuer?: string;
  from?: string;
}

export interface ReceivePaymentResult {
  transactionHash: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
  from: string;
  to: string;
  memo?: string | null;
  createdAt: string;
}

type IncomingPaymentRecord =
  | StellarSdk.Horizon.ServerApi.PaymentOperationRecord
  | StellarSdk.Horizon.ServerApi.PathPaymentOperationRecord
  | StellarSdk.Horizon.ServerApi.PathPaymentStrictSendOperationRecord;

export class StellarService {
  private server: StellarSdk.Horizon.Server;
  private sourceKeypair!: StellarSdk.Keypair;

  constructor() {
    // Default to testnet if not explicitly set
    const networkUrl = process.env.STELLAR_NETWORK_URL || 'https://horizon-testnet.stellar.org';
    this.server = new StellarSdk.Horizon.Server(networkUrl);

    // In production, this must be securely injected
    const secret =
      process.env.STELLAR_STORAGE_SECRET ||
      'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'; // Replace with a valid testnet secret for local dev

    try {
      this.sourceKeypair = StellarSdk.Keypair.fromSecret(secret);
    } catch {
      console.warn('Invalid STELLAR_STORAGE_SECRET. Stellar operations will fail.');
    }
  }

  /**
   * Sends funds from the operational storage to a destination address
   */
  async sendFunds(
    destinationAddress: string,
    amount: string,
    assetCode?: string,
    assetIssuer?: string,
  ): Promise<string> {
    try {
      const sourceAccount = await this.server.loadAccount(this.sourceKeypair.publicKey());
      const asset =
        assetCode && assetIssuer
          ? new StellarSdk.Asset(assetCode, assetIssuer)
          : StellarSdk.Asset.native();

      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        networkPassphrase: process.env.STELLAR_NETWORK_URL?.includes('public')
          ? StellarSdk.Networks.PUBLIC
          : StellarSdk.Networks.TESTNET,
      })
        .addOperation(
          StellarSdk.Operation.payment({
            destination: destinationAddress,
            asset,
            amount: amount,
          }),
        )
        .setTimeout(30)
        .build();

      transaction.sign(this.sourceKeypair);

      const response = await this.server.submitTransaction(transaction);
      return response.hash;
    } catch (error) {
      console.error('Stellar transaction failed:', error);
      throw error; // Rethrow to let the worker handle the failure state
    }
  }

  async createReceivePayment(params: ReceivePaymentParams): Promise<ReceivePaymentResult> {
    const { address, timeoutMs = 30000, assetCode, assetIssuer, from } = params;

    if (!StellarSdk.StrKey.isValidEd25519PublicKey(address)) {
      throw new Error(`Invalid Stellar address: ${address}`);
    }

    return new Promise<ReceivePaymentResult>((resolve, reject) => {
      let streamClosed = false;
      const cleanup = () => {
        if (!streamClosed && subscription) {
          subscription();
          streamClosed = true;
        }
        clearTimeout(timer);
      };

      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timeout waiting for incoming payment to ${address}`));
      }, timeoutMs);

      let subscription: (() => void) | undefined;

      try {
        subscription = this.server
          .payments()
          .forAccount(address)
          .cursor('now')
          .stream({
            onmessage: (payment: StellarSdk.Horizon.ServerApi.OperationRecord) => {
              if (
                payment.type !== 'payment' &&
                payment.type !== 'path_payment_strict_receive' &&
                payment.type !== 'path_payment_strict_send'
              ) {
                return;
              }

              const paymentRecord = payment as IncomingPaymentRecord;

              if (paymentRecord.to !== address) {
                return;
              }

              if (from && paymentRecord.from !== from) {
                return;
              }

              const paymentAssetCode = paymentRecord.asset_code || 'XLM';
              const paymentAssetIssuer = paymentRecord.asset_issuer;

              if (assetCode && paymentAssetCode !== assetCode) {
                return;
              }

              if (assetIssuer && paymentAssetIssuer !== assetIssuer) {
                return;
              }

              cleanup();
              const transactionMemo = (paymentRecord as unknown as { transaction_memo?: unknown })
                .transaction_memo;

              resolve({
                transactionHash: paymentRecord.transaction_hash,
                amount: paymentRecord.amount,
                assetCode: paymentAssetCode,
                assetIssuer: paymentAssetIssuer,
                from: paymentRecord.from,
                to: paymentRecord.to,
                memo: typeof transactionMemo === 'string' ? transactionMemo : null,
                createdAt: paymentRecord.created_at,
              });
            },
            onerror: (event: MessageEvent) => {
              cleanup();
              reject(new Error(`Stellar stream error: ${event?.type || 'unknown'}`));
            },
          });
      } catch (error) {
        cleanup();
        reject(error);
      }
    });
  }
}
