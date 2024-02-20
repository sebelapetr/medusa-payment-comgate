import ComgateClient from "comgate-node";
import { EOL } from "os";
import {
  AbstractPaymentProcessor,
  CartService,
  isPaymentProcessorError,
  PaymentProcessorContext,
  PaymentProcessorError,
  PaymentProcessorSessionResponse,
  PaymentSessionStatus,
} from "@medusajs/medusa";
import { ComgatePaymentOptions, PaymentProviderKeys } from "../types";
import {
  CreateCountry,
  CreateCurr,
  CreateRequest,
} from "comgate-node/dist/types/endpoints/create";
import { MedusaError } from "medusa-core-utils";

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

    if (this.cartService.retrieveWithTotals === undefined) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Your Medusa installation contains an outdated cartService implementation. Update your Medusa installation."
      );
    }
  }

  protected init(): void {
    this.comgateClient =
      this.comgateClient ||
      new ComgateClient({
        merchant: this.options_.merchant,
        secret: this.options_.secret,
        test: this.options_.test,
      });
  }

  async getPaymentStatus(
    paymentSessionData: Record<string, unknown>
  ): Promise<PaymentSessionStatus> {
    if (this.options_.test) {
      console.info(
        "getPaymentStatus",
        JSON.stringify(paymentSessionData, null, 2)
      );
    }

    const paymentId = paymentSessionData.id as string;

    try {
      const paymentStatus = await this.comgateClient.status({
        transId: paymentId,
      });

      if (paymentStatus.code !== 0) {
        return PaymentSessionStatus.ERROR;
      }

      switch (paymentStatus.status) {
        case "PENDING":
          return PaymentSessionStatus.PENDING;
        case "PAID":
          return PaymentSessionStatus.AUTHORIZED;
        case "AUTHORIZED":
          return PaymentSessionStatus.AUTHORIZED;
        case "CANCELLED":
          return PaymentSessionStatus.CANCELED;
        default:
          return PaymentSessionStatus.PENDING;
      }
    } catch (error) {
      return PaymentSessionStatus.ERROR;
    }
  }

  async initiatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse> {
    const session_data = {
      transId: "test",
    };
    try {
      return {
        session_data: session_data as any,
        update_requests: {
          customer_metadata: {
            comgateClientid: "asdf",
          },
        },
      };
    } catch (error: any) {
      return this.buildError(
        "An error occurred in InitiatePayment during the creation of the comgate payment intent",
        error
      );
    }
  }

  async authorizePayment(
    paymentSessionData: Record<string, unknown> & {
      cartId: string;
    },
    context?: Record<string, unknown>
  ): Promise<
    | PaymentProcessorError
    | {
        status: PaymentSessionStatus;
        data: PaymentProcessorSessionResponse["session_data"];
      }
  > {
    const { cartId } = paymentSessionData;
    const cart = await this.cartService.retrieveWithTotals(cartId);
    if (this.options_.test) {
      console.info("InitiatePayment", JSON.stringify(context, null, 2));
    }

    const options: CreateRequest = {
      country: cart.billing_address
        ? (cart.billing_address.country_code?.toUpperCase() as CreateCountry)
        : (cart.shipping_address?.country_code?.toUpperCase() as CreateCountry),
      price: cart.total,
      curr: cart.region.currency_code.toUpperCase() as CreateCurr,
      label: "Order from eshop",
      refId: cart.id.replace("cart_", ""),
      method: "ALL",
      email: cart.email,
      lang: "cs", // todo
      prepareOnly: false,
      preauth: false,
      initRecurring: false,
      verification: false,
    };

    try {
      const session_data = await this.comgateClient.create(options);
      if (session_data.code !== 0) {
        const error: PaymentProcessorError = {
          error: session_data.message,
          code: String(session_data.code),
        };
        return error;
      }
      return {
        data: session_data,
        status: PaymentSessionStatus.PENDING,
      };
    } catch (e) {
      return this.buildError(
        "An error occurred in InitiatePayment during the creation of the razorpay payment intent",
        e
      );
    }
  }

  async cancelPayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    const paymentId = paymentSessionData.id as string;

    try {
      const { code, message } = await this.comgateClient.cancel({
        transId: paymentId,
      });

      if (code === 0) {
        return {
          id: paymentId,
          code,
          message,
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
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    const error: PaymentProcessorError = {
      error:
        "Unable to capture payment as razorpay doesn't support cancellation",
      code: "Unsupported",
    };
    return error;
  }

  async deletePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    return await this.cancelPayment(paymentSessionData);
  }

  async refundPayment(
    paymentSessionData: Record<string, unknown>,
    refundAmount: number
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    if (this.options_.test) {
      console.info(
        "RefundPayment",
        JSON.stringify({ paymentSessionData, refundAmount }, null, 2)
      );
    }

    const paymentId = paymentSessionData.id as string;

    try {
      const refundPayment = await this.comgateClient.refund({
        transId: paymentId,
        amount: String(refundAmount),
      });

      if (refundPayment.code !== 0) {
        const error: PaymentProcessorError = {
          error: String(refundPayment.message),
          code: String(refundPayment.code),
        };
        return this.buildError("Failed to refund payment", error);
      }

      return paymentSessionData;
    } catch (error: any) {
      return this.buildError("Failed to refund payment", error);
    }
  }

  async retrievePayment(
    paymentSessionData: Record<string, unknown>
  ): Promise<
    PaymentProcessorError | PaymentProcessorSessionResponse["session_data"]
  > {
    if (this.options_.test) {
      console.info(
        "RetrievePayment",
        JSON.stringify(paymentSessionData, null, 2)
      );
    }

    const paymentId = paymentSessionData.id as string;

    try {
      const payment = await this.comgateClient.status({
        transId: paymentId,
      });

      if (payment.code !== 0) {
        const error: PaymentProcessorError = {
          error: String(payment.message),
          code: String(payment.code),
        };
        return this.buildError("Failed to get payment", error);
      }

      return payment as unknown as PaymentProcessorSessionResponse["session_data"];
    } catch (error: any) {
      return this.buildError("Failed to retrieve payment", error);
    }
  }

  async updatePayment(
    context: PaymentProcessorContext
  ): Promise<PaymentProcessorError | PaymentProcessorSessionResponse | void> {
    if (this.options_.test) {
      console.info("UpdatePayment", JSON.stringify(context, null, 2));
    }
    const { amount, customer, paymentSessionData } = context;
    const paymentId = paymentSessionData.id as string;

    const newPaymentSessionOrder = {
      session_data: paymentSessionData as any,
      update_requests: customer?.metadata?.comgateClientid
        ? undefined
        : {
            customer_metadata: {
              comgateClientId: "Asfsf",
            },
          },
    };
    return { session_data: { ...newPaymentSessionOrder.session_data } };
  }

  async updatePaymentData(
    sessionId: string,
    data: Record<string, unknown>
  ): Promise<
    PaymentProcessorSessionResponse["session_data"] | PaymentProcessorError
  > {
    const error: PaymentProcessorError = {
      error: "Unable to cancel as razorpay doesn't support cancellation",
      code: "Unsupported",
    };
    return error;
  }
  /*
  /**
   * Constructs Razorpay Webhook event
   * @param {object} data - the data of the webhook request: req.body
   * @param {object} signature - the Razorpay signature on the event, that
   *    ensures integrity of the webhook event
   * @return {object} Razorpay Webhook event
   */

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
}

export default ComgateBase;
