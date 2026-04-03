export const TOKEN_PRICE_USD = 0.005;

export interface WalletOverviewResponseDto {
  walletTokenBalance: number;
  tokenPriceUsd: number;
  canAccessMarketplace: boolean;
  marketplaceStatus: 'OPEN' | 'LOCKED';
  reason?: string;
}

export interface CreateTokenPurchaseRequestDto {
  tokenCount: number;
}

export interface TokenPurchaseRequestResponseDto {
  id: number;
  requestedTokenCount: number;
  totalAmountUsd: number;
  paymentProofUrl: string;
  status: string;
  rejectionReason: string | null;
  adminNote: string | null;
  reviewedBy: number | null;
  reviewedAt: Date | null;
  creditedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
