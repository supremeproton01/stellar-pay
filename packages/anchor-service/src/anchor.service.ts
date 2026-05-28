import type {
  DirectPaymentParams,
  DirectPaymentResult,
  Sep12KycData,
} from './interfaces/direct-payment.interface';

interface Sep31PaymentRecord {
  paymentId: string;
  senderId: string;
  receiverId: string;
  amount: string;
  assetCode: string;
  originalTransactionRef: string;
  stellarTransactionHash?: string;
  status: 'pending' | 'completed' | 'failed';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class AnchorService {
  private readonly payments = new Map<string, Sep31PaymentRecord>();

  async createSep31DirectPayment(params: DirectPaymentParams): Promise<DirectPaymentResult> {
    // Validate KYC via SEP-12 (stub - would call SEP-12 endpoints)
    const senderValid = this.validateKyc(params.senderKyc);
    const receiverValid = this.validateKyc(params.receiverKyc);

    if (!senderValid) {
      return this.buildError(params, 'Sender KYC validation failed');
    }

    if (!receiverValid) {
      return this.buildError(params, 'Receiver KYC validation failed');
    }

    const paymentId = `sep31_${crypto.randomUUID().split('-').join('').slice(0, 16)}`;

    const record: Sep31PaymentRecord = {
      paymentId,
      senderId: params.senderId,
      receiverId: params.receiverId,
      amount: params.amount,
      assetCode: params.assetCode,
      originalTransactionRef: params.originalTransactionRef,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.payments.set(paymentId, record);

    try {
      // Execute Stellar SEP-31 payment (stub - would use stellar-sdk)
      // const txHash = await this.submitStellarPayment(...);
      const txHash = `tx_${crypto.randomUUID().split('-').join('').slice(0, 16)}`;

      record.stellarTransactionHash = txHash;
      record.status = 'completed';
      record.updatedAt = new Date().toISOString();
      this.payments.set(paymentId, record);

      return {
        success: true,
        paymentId,
        stellarTransactionHash: txHash,
        originalTransactionRef: params.originalTransactionRef,
        amount: params.amount,
        assetCode: params.assetCode,
        status: 'completed',
        createdAt: record.createdAt,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      record.status = 'failed';
      record.error = errorMessage;
      record.updatedAt = new Date().toISOString();
      this.payments.set(paymentId, record);

      return {
        success: false,
        paymentId,
        originalTransactionRef: params.originalTransactionRef,
        amount: params.amount,
        assetCode: params.assetCode,
        status: 'failed',
        error: errorMessage,
        createdAt: record.createdAt,
      };
    }
  }

  getPayment(paymentId: string): Sep31PaymentRecord | undefined {
    return this.payments.get(paymentId);
  }

  getAllPayments(): Sep31PaymentRecord[] {
    return Array.from(this.payments.values());
  }

  private validateKyc(_kyc: Record<string, unknown> | Sep12KycData): boolean {
    // TODO: Call SEP-12 KYC endpoint to validate sender/receiver info
    // const response = await fetch(`https://anchor.example.com/sep12/customer`, {
    //   method: 'GET',
    //   headers: { Authorization: `Bearer ${this.authToken}` },
    //   body: JSON.stringify(_kyc),
    // });
    // return response.ok;
    return true;
  }

  private buildError(params: DirectPaymentParams, error: string): DirectPaymentResult {
    return {
      success: false,
      paymentId: '',
      originalTransactionRef: params.originalTransactionRef,
      amount: params.amount,
      assetCode: params.assetCode,
      status: 'failed',
      error,
      createdAt: new Date().toISOString(),
    };
  }
}
