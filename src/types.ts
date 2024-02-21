import {PaymentProcessorError, PaymentProcessorSessionResponse, PaymentSessionStatus} from "@medusajs/medusa";
import {StatusResponseStatus} from "comgate-node/dist/types/endpoints/status";

export interface ComgatePaymentOptions {
  merchant: number;
  secret: string;
  test: boolean;
  debug: boolean;
}

export const PaymentProviderKeys = {
  COMGATE: "comgate",
};

export type ComgatePaymentProcessorSessionResponse = Omit<PaymentProcessorSessionResponse, 'session_data'> & {
  session_data: ComgateSessionData;
};

export type ComgateSessionData = {
  status: PaymentSessionStatus,
  comgateData: {
    transId: string | null,
    status: "INITIATED" | "CREATED" | "ERROR" | StatusResponseStatus,
    redirect: string | null,
    error: PaymentProcessorError | null,
  }
}

