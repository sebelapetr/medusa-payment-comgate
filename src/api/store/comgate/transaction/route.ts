import {CartService, MedusaRequest, MedusaResponse} from "@medusajs/medusa"
import ComgateProviderService from "../../../../services/comgate-provider";
import {CreateCountry, CreateCurr, CreateRequest} from "comgate-node/dist/types/endpoints/create";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
    try {
        const cartId = req.body.cart_id;

        const plugin = req.scope.resolve<ComgateProviderService>("comgateProviderService")

        const comgateClient = plugin.comgateClient;

        const cartService = req.scope.resolve<CartService>("cartService")

        const cart = await cartService.retrieveWithTotals(cartId)

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
            initRecurring: false,
            prepareOnly: true,
            preauth: false,
            verification: false,
        };

        try {
            const transaction = await comgateClient.create(options);
            if (transaction.code !== 0) {
                res.status(400).send(`Comgate Error: ${transaction.code}: ${transaction.message}`)
                return
            } else {
                res.status(200).send({
                    redirect: transaction.redirect,
                });
                return;
            }
        } catch (e) {
            res.status(400).send(`Medusa Error: ${e.message}`)
            return
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
