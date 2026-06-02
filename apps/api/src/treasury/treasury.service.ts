import { Injectable, BadRequestException } from '@nestjs/common';
import * as StellarSdk from '@stellar/stellar-sdk';
import { AssetReserve, RedeemResponse } from './interfaces/proof-of-reserves.interface';
import { RedemptionRepository } from '../modules/database/redemption.repository';
import { RedeemDto } from './dto/redeem.dto';

interface MerchantBalance {
  merchantId: string;
  asset: string;
  balance: number;
}

interface HorizonAssetRecord {
  amount?: string;
}

interface HorizonBalanceRecord {
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

interface SorobanBurnResult {
  hash?: string;
  transactionHash?: string;
  id?: string;
}

interface SorobanClient {
  contractCall(
    contractId: string,
    functionName: string,
    args: unknown[],
  ): Promise<SorobanBurnResult>;
}

interface SorobanClientConstructor {
  new (url: string): SorobanClient;
}

@Injectable()
export class TreasuryService {
  // In-memory merchant balances for validation (stub)
  private readonly merchantBalances: MerchantBalance[] = [];

  private readonly horizonUrl =
    process.env.STELLAR_HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

  private readonly issuerPublicKey = process.env.ISSUER_PUBLIC_KEY;

  private get horizonServer(): StellarSdk.Horizon.Server {
    return new StellarSdk.Horizon.Server(this.horizonUrl);
  }

  constructor(private readonly redemptionRepo: RedemptionRepository) {}

  private getAssetIssuer(): string {
    if (!this.issuerPublicKey) {
      throw new BadRequestException('Missing ISSUER_PUBLIC_KEY environment variable');
    }
    return this.issuerPublicKey;
  }

  async getTotalSupply(assetCode: string): Promise<string> {
    const issuer = this.getAssetIssuer();
    const response = await this.horizonServer.assets().forCode(assetCode).forIssuer(issuer).call();

    const assetRecord = response.records?.[0] as HorizonAssetRecord | undefined;
    return assetRecord?.amount ?? '0';
  }

  async getTreasuryBalance(assetCode: string, treasuryAddress: string): Promise<string> {
    const issuer = this.getAssetIssuer();
    const account = await this.horizonServer.loadAccount(treasuryAddress);
    const balance = account.balances.find(
      (b): b is HorizonBalanceRecord => b.asset_code === assetCode && b.asset_issuer === issuer,
    );
    return balance?.balance ?? '0';
  }

  calculateReserveRatio(treasuryBalance: string, totalSupply: string): number {
    const treasury = parseFloat(treasuryBalance);
    const supply = parseFloat(totalSupply);

    if (supply === 0) return 0;

    return Math.round((treasury / supply) * 10000) / 100; // Return as percentage with 2 decimals
  }

  async getAssetReserve(assetCode: string): Promise<AssetReserve> {
    // TODO: Get treasury address from config service
    // const treasuryAddress = await this.configService.getTreasuryAddress();
    const treasuryAddress = process.env.TREASURY_WALLET_ADDRESS ?? 'TREASURY_ADDRESS_NOT_SET';

    const [totalSupply, treasuryBalance] = await Promise.all([
      this.getTotalSupply(assetCode),
      this.getTreasuryBalance(assetCode, treasuryAddress),
    ]);

    const reserveRatio = this.calculateReserveRatio(treasuryBalance, totalSupply);

    return {
      symbol: assetCode,
      total_supply: totalSupply,
      treasury_balance: treasuryBalance,
      reserve_ratio: reserveRatio,
    };
  }

  async redeem(dto: RedeemDto, merchantId: string): Promise<RedeemResponse> {
    // 1. Validate merchant has sufficient balance
    const balance = this.merchantBalances.find(
      (b) => b.merchantId === merchantId && b.asset === dto.currency,
    );

    if (!balance || balance.balance < dto.amount) {
      throw new BadRequestException(
        `Insufficient ${dto.currency} balance. Available: ${balance?.balance ?? 0}, Requested: ${dto.amount}`,
      );
    }

    const sorobanRpcUrl = process.env.SOROBAN_RPC_URL;
    const contractId = process.env.MIRROR_ASSET_CONTRACT_ID;
    if (!sorobanRpcUrl || !contractId) {
      throw new BadRequestException(
        'SOROBAN_RPC_URL and MIRROR_ASSET_CONTRACT_ID must be configured for redemption',
      );
    }

    // 2. Invoke Soroban burn function
    const SorobanClient = (StellarSdk as unknown as { SorobanClient: SorobanClientConstructor })
      .SorobanClient;
    const sorobanClient = new SorobanClient(sorobanRpcUrl);
    const burnTx = await sorobanClient.contractCall(contractId, 'burn', [
      merchantId,
      dto.amount.toString(),
      dto.currency,
    ]);

    const burnTxHash =
      burnTx.hash ||
      burnTx.transactionHash ||
      burnTx.id ||
      `burn_${crypto.randomUUID().split('-').join('').slice(0, 16)}`;

    // 3. Deduct balance after successful burn
    balance.balance -= dto.amount;

    // 4. Create redemption record for withdrawal worker
    const redemptionId = `rdm_${crypto.randomUUID().split('-').join('').slice(0, 16)}`;
    await this.redemptionRepo.create({
      id: redemptionId,
      status: 'PENDING',
      destinationAddress: dto.destination,
      amount: dto.amount.toString(),
    });

    return {
      redemption_id: redemptionId,
      amount: dto.amount,
      currency: dto.currency,
      destination: dto.destination,
      status: 'pending',
      burn_tx_hash: burnTxHash,
      created_at: new Date().toISOString(),
    };
  }
}
