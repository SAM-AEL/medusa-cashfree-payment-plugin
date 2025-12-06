import { defineWidgetConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Badge } from "@medusajs/ui"
import { AdminOrder } from "@medusajs/framework/types"

type AdminOrderWithPayments = AdminOrder & {
    payments?: {
        provider_id: string
        amount: number
        currency_code: string
        captured_at?: string
        id: string
        data?: Record<string, any>
    }[]
}

const CashfreeWidget = ({ data: order }: { data: AdminOrderWithPayments }) => {
    const cashfreePayment = order.payments?.find(
        (p) => p.provider_id === "cashfree"
    )

    if (!cashfreePayment) {
        return null
    }

    const metadata = cashfreePayment.data as Record<string, any> || {}

    return (
        <Container className="divide-y p-0">
            <div className="flex items-center justify-between px-6 py-4">
                <Heading level="h2">Cashfree Payment</Heading>
                <Badge color={cashfreePayment.captured_at ? "green" : "orange"}>
                    {cashfreePayment.captured_at ? "Captured" : "Pending"}
                </Badge>
            </div>

            <div className="px-6 py-4 flex flex-col gap-y-4">
                <div className="flex flex-col gap-y-1">
                    <Text size="small" className="text-ui-fg-subtle">
                        Payment ID
                    </Text>
                    <Text size="small" className="font-medium font-mono text-ui-fg-base">
                        {metadata.order_id || cashfreePayment.id}
                    </Text>
                </div>

                <div className="flex flex-col gap-y-1">
                    <Text size="small" className="text-ui-fg-subtle">
                        Session ID
                    </Text>
                    <Text size="small" className="font-medium font-mono text-ui-fg-base">
                        {metadata.payment_session_id || "N/A"}
                    </Text>
                </div>

                <div className="flex flex-col gap-y-1">
                    <Text size="small" className="text-ui-fg-subtle">
                        Amount
                    </Text>
                    <Text size="small" className="font-medium text-ui-fg-base">
                        {cashfreePayment.currency_code.toUpperCase()} {cashfreePayment.amount}
                    </Text>
                </div>
            </div>
        </Container>
    )
}

export const config = defineWidgetConfig({
    zone: "order.details.side.after",
})

export default CashfreeWidget
