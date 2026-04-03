export interface AdminListPurchaseRequestsQueryDto {
  status?: string;
  search?: string;
  userId?: number;
}

export interface AdminReviewPurchaseRequestDto {
  action: 'APPROVE' | 'REJECT';
  reason?: string;
  note?: string;
}
