export type InvitationCode = {
  _id: string;
  code: string;
  isValid: boolean;
  quantity: number;
  usesCount: number;
  createdBy?: string;
  whoUsed: string[];
  expiryDate?: string;
};
