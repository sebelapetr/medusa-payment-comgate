import type {
    MiddlewaresConfig,
} from "@medusajs/medusa"
import cors from "cors"

const COMGATE_TRANS_WEBHOOK_ORIGIN = "89.185.236.55"

export const config: MiddlewaresConfig = {
    routes: [
        {
            matcher: "/comgate/webhooks",
            middlewares: [
                cors({
                    origin: COMGATE_TRANS_WEBHOOK_ORIGIN,
                    credentials: false,
                }),
            ],
        },
    ],
}
