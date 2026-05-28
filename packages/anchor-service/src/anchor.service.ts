import type { RefundResult } from './interfaces/refund-result.interface';
import type {
  AnchorTransaction,
  AnchorTransactionStatus,
} from './interfaces/transaction.interface';

export class AnchorService {
  private readonly transactions = new Map<string, AnchorTransaction>();

  registerTransaction(tx: AnchorTransaction): void {
    this.transactions.set(tx.id, { ...tx, amountRefunded: tx.amountRefunded ?? 0 });
  }

  async processAnchorRefund(transactionId: string): Promise<RefundResult> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      return {
        transactionId,
        success: false,
        amountRefunded: 0,
        totalAmount: 0,
        isPartialRefund: false,
        status: 'failed',
        error: `Transaction ${transactionId} not found`,
        refundedAt: new Date().toISOString(),
      };
    }

    if (tx.status === 'refunded') {
      return {
        transactionId,
        success: false,
        amountRefunded: tx.amountRefunded,
        totalAmount: tx.amount,
        isPartialRefund: false,
        status: 'failed',
        error: 'Transaction has already been fully refunded',
        refundedAt: new Date().toISOString(),
      };
    }

    if (tx.status !== 'failed') {
      return {
        transactionId,
        success: false,
        amountRefunded: tx.amountRefunded,
        totalAmount: tx.amount,
        isPartialRefund: false,
        status: 'failed',
        error: `Transaction is in status '${tx.status}' and cannot be refunded`,
        refundedAt: new Date().toISOString(),
      };
    }

    const remaining = tx.amount - tx.amountRefunded;
    const isPartial = tx.amountRefunded > 0 && remaining > 0;

    tx.amountRefunded = tx.amount;
    tx.updatedAt = new Date().toISOString();

    let newStatus: AnchorTransactionStatus;
    if (isPartial) {
      newStatus = 'partially_refunded';
    } else {
      newStatus = 'refunded';
    }
    tx.status = newStatus;
    this.transactions.set(tx.id, tx);

    return {
      transactionId,
      success: true,
      amountRefunded: remaining,
      totalAmount: tx.amount,
      isPartialRefund: isPartial,
      status: newStatus,
      refundedAt: new Date().toISOString(),
    };
  }

  getTransaction(id: string): AnchorTransaction | undefined {
    return this.transactions.get(id);
  }

  getAllTransactions(): AnchorTransaction[] {
    return Array.from(this.transactions.values());
  }
}
