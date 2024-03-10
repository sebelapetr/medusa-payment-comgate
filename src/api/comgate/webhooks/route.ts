import {
    AbstractCartCompletionStrategy,
    CartService, IdempotencyKeyService,
    MedusaRequest,
    MedusaResponse,
    OrderService
} from "@medusajs/medusa"
import {ComgateStatusRequest} from "../../../types";
import {UpdateOrderInput} from "@medusajs/medusa/dist/types/orders";
import ComgateProviderService from "../../../services/comgate-provider";
import {MedusaError} from "medusa-core-utils";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    try {

        const container = req.scope;
        const requestBody = req.body as ComgateStatusRequest;

        const cartService = container.resolve<CartService>("cartService");
        const orderService = container.resolve<OrderService>("orderService");
        const cartId = "cart_" + requestBody.refId;

        const cart = await cartService
            .retrieve(cartId)
            .catch(() => undefined);

        if (!cart) {
            res.status(404).send(`Api Error: Cart with id ` + cartId + ` not found.`)
            return
        }

        switch (requestBody.status) {
            case "PAID":
            case "AUTHORIZED":
                const manager = container.resolve("manager");
                await manager.transaction(async (transactionManager) => {
                    await completeCart(requestBody.transId, cartId, container,  transactionManager)
                    await capturePayment(cartId, transactionManager, container)
                });
                res.status(200).send();
                return;
                break;
            case "CANCELLED":
                const order = await orderService
                    .retrieveByCartId(cartId)
                    .catch(() => undefined);
                if (order) {
                    await orderService.cancel(order.id);
                }
                res.status(200).send();
                break;
            default:
                res.sendStatus(204);
                return;
        }

    } catch (err) {
        res.status(400).send(`Api Error: ${err.message}`)
        return
    }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
    res.status(200).send({
        status: "OK"
    })
    return;
}

async function completeCart(
                                           eventId,
                                           cartId,
                                           container,
                                           transactionManager,
                                       ) {

    const orderService = container.resolve("orderService");

    const order = await orderService
        .retrieveByCartId(cartId)
        .catch(() => undefined);

    if (!order) {
        const completionStrategy: AbstractCartCompletionStrategy = container.resolve("cartCompletionStrategy");
        const cartService: CartService = container.resolve("cartService");
        const idempotencyKeyService: IdempotencyKeyService = container.resolve("idempotencyKeyService");
        const idempotencyKeyServiceTx = idempotencyKeyService.withTransaction(transactionManager);

        let idempotencyKey = await idempotencyKeyServiceTx
            .retrieve({
                request_path: "/comgate/webhooks",
                idempotency_key: eventId,
            })
            .catch(() => undefined);

        if (!idempotencyKey) {
            idempotencyKey = await idempotencyKeyService
                .withTransaction(transactionManager)
                .create({
                    request_path: "/comgate/webhooks",
                    idempotency_key: eventId,
                });
        }

        const cart = await cartService
            .withTransaction(transactionManager)
            .retrieve(cartId, { select: ["context"] });

        const { response_code, response_body } = await completionStrategy
            .withTransaction(transactionManager)
            .complete(cartId, idempotencyKey, { ip: cart.context?.ip as string });
        if (response_code !== 200) {
            throw new MedusaError(
                MedusaError.Types.UNEXPECTED_STATE,
                response_body["message"] as string,
                response_body["code"] as string
            );
        }
    }
}

async function capturePayment(
                                             cartId,
                                             transactionManager,
                                             container,
                                         ) {
    const orderService = container.resolve("orderService") as OrderService;
    const order = await orderService
        .withTransaction(transactionManager)
        .retrieveByCartId(cartId)
        .catch(() => {});
    if (order?.payment_status !== "captured") {
        await orderService
            .withTransaction(transactionManager)
            .capturePayment(order!.id);
    }
}

