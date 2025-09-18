import { randomUUID } from "crypto"

export const generateRefundID = (ORDER_ID: string) => {

    if (!ORDER_ID.startsWith("order_")) {
        throw new Error("Invalid order ID format")
    }

    const refundId = ORDER_ID.replace(/^order_/, "refund_") + `_${randomUUID().replace(/-/g, "").slice(0, Math.floor(Math.random() * 6) + 3)}`

    return refundId
}