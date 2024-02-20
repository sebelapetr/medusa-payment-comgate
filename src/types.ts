export interface ComgatePaymentOptions {
  merchant: number;
  secret: string;
  test: boolean;
}

export const PaymentProviderKeys = {
  COMGATE: "comgate",
};
