import ComgateClient from "comgate-node";
import {EOL} from "os";

import {
  AbstractPaymentProcessor,
  CartService,
  isPaymentProcessorError,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentSessionStatus,
} from "@medusajs/medusa";

import {
  ComgatePaymentOptions,
  ComgatePaymentProcessorSessionResponse,
  ComgateSessionData,
  PaymentProviderKeys
} from "../types";

import { MedusaError } from "medusa-core-utils";
import { StatusResponseStatus } from "comgate-node/dist/types/endpoints/status";

abstract class ComgateBase extends AbstractPaymentProcessor {
  static identifier = PaymentProviderKeys.COMGATE;

  protected readonly options_: ComgatePaymentOptions;
  public comgateClient: ComgateClient;
  protected readonly cartService: CartService;

  protected constructor(_, options) {
    super(_, options);

    this.options_ = options;

    this.init();

    this.cartService = _.cartService;
  }

  protected init(): void {
    this.comgateClient =
      this.comgateClient ||
      new ComgateClient({
        merchant: this.options_.merchant,
        secret: this.options_.secret,
        test: this.options_.test
      });
  }

  async getPaymentStatus(paymentSessionData: ComgateSessionData
  ): Promise<PaymentSessionStatus> {
    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "getPaymentStatus", "start")
    }

    const transId = paymentSessionData.comgateData.transId as string;

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "getPaymentStatus", "data: ", {
        transId: transId
      })
    }

    try {
      const transactionStatus = await this.getComgateTransactionStatus(transId);
      if (this.options_.debug) {
        console.log("ComgateMedusa: " + "getPaymentStatus", "response: ", {
          transId: transactionStatus
        })
      }
      return transactionStatus.status
    } catch (error) {
      if (this.options_.debug) {
        console.log("ComgateMedusa: " + "getPaymentStatus", "error: ", error)
      }
      return PaymentSessionStatus.ERROR;
    }

  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | ComgatePaymentProcessorSessionResponse> {

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "initiatePayment", "start")
    }

    const session_data: ComgateSessionData = {
      status: PaymentSessionStatus.PENDING,
      comgateData: {
        transId: null,
        status: "INITIATED",
        redirect: null,
        error: null,
      }
    };

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "initiatePayment", "session_data: ", session_data)
    }

    return {
      session_data: session_data
    };
  }

  async authorizePayment(
    paymentSessionData: ComgateSessionData,
    context?: Record<string, unknown>
  ): Promise<
    | PaymentProcessorError
    | {
        status: PaymentSessionStatus;
        data: ComgatePaymentProcessorSessionResponse["session_data"];
      }
  > {

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "authorizePayment", "start")
    }

    const transId = paymentSessionData.comgateData.transId as string;

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "authorizePayment", "transId: ", transId)
    }

    const transactionStatus = await this.getComgateTransactionStatus(transId);

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "authorizePayment", "response: ", transactionStatus)
    }


    const sessionData = {
      status: transactionStatus.status,
      data: {
        status: transactionStatus.status,
        comgateData: {
          transId: paymentSessionData.comgateData.transId,
          status: transactionStatus.comgateStatus,
          redirect: paymentSessionData.comgateData.redirect,
          error: transactionStatus.comgateError,
        }
      }
    }

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "authorizePayment", "sessionData: ", sessionData)
    }

    return sessionData;
  }

  async cancelPayment(
    paymentSessionData: ComgateSessionData
  ): Promise<
    PaymentProcessorError | ComgatePaymentProcessorSessionResponse["session_data"]
  > {

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "cancelPayment", "start")
    }

    const transId = paymentSessionData.comgateData.transId as string;

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "cancelPayment", "transId: ", transId)
    }

    try {
      const { code, message } = await this.comgateClient.cancel({
        transId: transId,
      });

      if (this.options_.debug) {
        console.log("ComgateMedusa: " + "cancelPayment", "response: ", code, message)
      }

      if (code === 0) {
        return {
          status: PaymentSessionStatus.CANCELED,
          comgateData: {
            transId: paymentSessionData.comgateData.transId,
            status: "CANCELLED",
            redirect: paymentSessionData.comgateData.redirect,
            error: null,
          }
        };
      } else if (code === 1400) {
        const error: PaymentProcessorError = {
          error: message,
          code: String(code),
        };
        return error;
      } else {
        const error: PaymentProcessorError = {
          error: message,
          code: String(code),
        };
        return error;
      }
    } catch (error: any) {
      return this.buildError("An error occurred in cancelPayment", error);
    }
  }

  async capturePayment(
    paymentSessionData: ComgateSessionData
  ): Promise<
    PaymentProcessorError | ComgatePaymentProcessorSessionResponse["session_data"]
  > {
    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "capturePayment", "start")
    }

    const error: PaymentProcessorError = {
      error:
        "Unable to capture payment doesn't support capturePayment",
      code: "Unsupported",
    };
    return error;
  }

  async deletePayment(
    paymentSessionData: ComgateSessionData
  ): Promise<
    PaymentProcessorError | ComgatePaymentProcessorSessionResponse["session_data"]
  > {
    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "deletePayment", "start")
    }
    return await this.cancelPayment(paymentSessionData);
  }

  async refundPayment(
    paymentSessionData: ComgateSessionData,
    refundAmount: number
  ): Promise<
    PaymentProcessorError | ComgatePaymentProcessorSessionResponse["session_data"]
  > {
    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "refundPayment", "start")
    }

    const transId = paymentSessionData.comgateData.transId as string;

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "refundPayment", "transId: ", transId)
      console.log("ComgateMedusa: " + "refundPayment", "amount: ", String(refundAmount))
    }

    try {
      const refundPayment = await this.comgateClient.refund({
        transId: transId,
        amount: String(refundAmount),
      });

      if (this.options_.debug) {
        console.log("ComgateMedusa: " + "refundPayment", "response: ", refundPayment)
      }

      if (refundPayment.code !== 0) {
        const error: PaymentProcessorError = {
          error: String(refundPayment.message),
          code: String(refundPayment.code),
        };
        return this.buildError("Failed to refund payment", error);
      }

      return {
        status: paymentSessionData.status,
        comgateData: {
          transId: paymentSessionData.comgateData.transId,
          status: paymentSessionData.comgateData.status,
          redirect: paymentSessionData.comgateData.redirect,
          error: null,
        }
      };
    } catch (error: any) {
      return this.buildError("Failed to refund payment", error);
    }
  }

  async retrievePayment(
    paymentSessionData: ComgateSessionData
  ): Promise<
    PaymentProcessorError | ComgatePaymentProcessorSessionResponse["session_data"]
  > {
    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "retrievePayment", "start")
    }

    const transId = paymentSessionData.comgateData.transId as string;

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "retrievePayment", "transId: ", transId)
    }

    try {
      const transactionStatus = await this.getComgateTransactionStatus(transId);

      if (this.options_.debug) {
        console.log("ComgateMedusa: " + "retrievePayment", "response: ", transactionStatus)
      }

      return {
        status: transactionStatus.status,
        comgateData: {
          transId: paymentSessionData.comgateData.transId,
          status: transactionStatus.comgateStatus,
          redirect: paymentSessionData.comgateData.redirect,
          error: transactionStatus.comgateError,
        }
      };
    } catch (error: any) {
      return this.buildError("Failed to retrieve payment", error);
    }
  }

  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | ComgatePaymentProcessorSessionResponse | void> {

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "updatePayment", "start")
    }

    //const { amount, customer } = context;
    const paymentSessionData = context.paymentSessionData as ComgateSessionData;
    //const transId = paymentSessionData.comgateData.transId as string;

    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "updatePayment", "paymentSessionData: ", paymentSessionData)
    }

    return {
      session_data: paymentSessionData
    };
  }

  async updatePaymentData(
    sessionId: string,
    data: ComgateSessionData
  ): Promise<
    ComgatePaymentProcessorSessionResponse["session_data"] | PaymentProcessorError
  > {
    if (this.options_.debug) {
      console.log("ComgateMedusa: " + "updatePaymentData", "start")
      console.log("ComgateMedusa: " + "updatePaymentData", "data: ", data)
    }
    return data;
  }

  protected buildError(
    message: string,
    e: PaymentProcessorError | Error
  ): PaymentProcessorError {
    return {
      error: message,
      code: "code" in e ? e.code : "",
      detail: isPaymentProcessorError(e)
        ? `${e.error}${EOL}${e.detail ?? ""}`
        : "detail" in e
        ? e.detail
        : e.message ?? "",
    };
  }

  private async getComgateTransactionStatus(transId: string): Promise<{
    status: PaymentSessionStatus,
    comgateStatus: StatusResponseStatus | "ERROR",
    comgateError: PaymentProcessorError | null
  }>
  {
    let status: PaymentSessionStatus;
    let comgateStatus: StatusResponseStatus | "ERROR";
    let comgateError: PaymentProcessorError | null = null;

    try {
      const paymentStatus = await this.comgateClient.status({
        transId,
      });

      if (paymentStatus.code !== "0") {
        status = PaymentSessionStatus.ERROR;
        comgateStatus = "ERROR";
        const error: PaymentProcessorError = {
          error: paymentStatus.message,
          code: String(paymentStatus.code),
          detail: paymentStatus.message
        };
        comgateError = this.buildError("Error Comgate API payment status Response", error);
      } else {
        switch (paymentStatus.status.toUpperCase()) {
          case "PENDING":
            status = PaymentSessionStatus.AUTHORIZED;
          break;
          case "PAID":
            status = PaymentSessionStatus.AUTHORIZED;
          break;
          case "AUTHORIZED":
            status = PaymentSessionStatus.AUTHORIZED;
          break;
          case "CANCELLED":
            status = PaymentSessionStatus.CANCELED;
          break;
          default:
            status = PaymentSessionStatus.PENDING;
        }
        comgateStatus = paymentStatus.status;
      }
    } catch (error) {
      status = PaymentSessionStatus.ERROR;
      comgateStatus = "ERROR";
      comgateError = this.buildError("Error in calling Comgate API payment status", error);
    }

    return {
      status: status,
      comgateStatus: comgateStatus,
      comgateError: comgateError
    };
  }
}

export default ComgateBase;
