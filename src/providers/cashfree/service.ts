import { Cashfree, CFEnvironment, OrderCreateRefundRequest, TerminateOrderRequest } from "cashfree-pg";
import { AbstractPaymentProvider, BigNumber, MedusaError } from "@medusajs/framework/utils"
import {
    InitiatePaymentInput,
    InitiatePaymentOutput,
    AuthorizePaymentInput,
    AuthorizePaymentOutput,
    CapturePaymentInput, CapturePaymentOutput, CancelPaymentInput, CancelPaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, RetrievePaymentInput, RetrievePaymentOutput, RefundPaymentInput, RefundPaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, CreateAccountHolderInput, CreateAccountHolderOutput, DeleteAccountHolderInput, DeleteAccountHolderOutput, ListPaymentMethodsInput, ListPaymentMethodsOutput, SavePaymentMethodInput, SavePaymentMethodOutput, UpdateAccountHolderInput, UpdateAccountHolderOutput, ProviderWebhookPayload, WebhookActionResult
} from "@medusajs/framework/types"
import { randomUUID } from "crypto";
import { generateRefundID } from "./utils";

type Options = {
    app_id: string
    secret_key: string
    environment?: "sandbox" | "production"
    webhook_secret?: string
    return_url?: string
    notify_url?: string
}

type InjectedDependencies = {
    logger: any
    client: Cashfree
}

class CashfreePaymentProviderService extends AbstractPaymentProvider<Options> {

    static identifier = "cashfree"

    protected logger_: any
    protected options_: Options

    protected client: Cashfree

    constructor(
        container: InjectedDependencies,
        options: Options
    ) {
        super(container, options)

        this.logger_ = container.logger
        this.options_ = options

        const environment = options.environment === "production"
            ? CFEnvironment.PRODUCTION
            : CFEnvironment.SANDBOX

        this.client = new Cashfree(environment, options.app_id, options.secret_key)
    }

    async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
        const { amount, currency_code, data, context } = input
        const customerData = context?.customer;

        if (!customerData || !customerData.billing_address?.phone || !data?.session_id)
            throw new MedusaError(MedusaError.Types.NOT_FOUND, "Customer not found")

        const request = {
            order_amount: new BigNumber(amount).numeric,
            order_currency: (currency_code as string).toUpperCase(),
            customer_details: {
                customer_id: customerData.id,
                customer_name: customerData.first_name + " " + customerData.last_name,
                customer_email: customerData.email,
                customer_phone: customerData.phone as string || customerData.billing_address?.phone as string,
            },
            order_meta: {
                return_url: this.options_.return_url || undefined,
                notify_url: this.options_.notify_url || undefined
            },
            order_tags: { session_id: data?.session_id as string },
        };

        try {
            const response = await this.client.PGCreateOrder(request);

            this.logger_.warn("Payment Initialized. Payment ID created successfully.")

            if (!response.data || !response.data.order_id) {
                throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment request failure. Please try again.")
            }

            return { id: response.data.order_id, data: response.data as any }

        } catch (error: any) {
            this.logger_.error("Error setting up order request: " + JSON.stringify(error?.response?.data || error))
            throw error;
        }
    }

    async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
        const externalId = input.data?.order_id
        return { data: { id: externalId }, status: "authorized" }
    }

    async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
        const externalId = input.data?.id
        if (!externalId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing payment ID")

        try {
            const response = await this.client.PGFetchOrder(externalId as string)
            const status = response?.data?.order_status

            switch (status) {
                case "PAID": return { data: { ...response.data, id: externalId } }
                case "ACTIVE": throw new MedusaError(MedusaError.Types.NOT_FOUND, "Pending Payment. Try again later.")
                case "EXPIRED": throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment order expired.")
                case "TERMINATED": throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment terminated.")
                default: throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment not captured.")
            }
        } catch (error) {
            if (!(error instanceof MedusaError)) {
                this.logger_.error("Unexpected capture error:", error)
                throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message || "Unknown error")
            }
            throw error
        }
    }

    async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
        const externalId = input.data?.order_id as string
        if (!externalId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing order_id")

        try {
            const getOrderResp = await this.client.PGFetchOrder(externalId)
            const currentStatus: string = getOrderResp.data?.order_status || "UNKNOWN"

            if (currentStatus === "PAID") throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Order already paid, cannot cancel.")
            if (["TERMINATED", "EXPIRED"].includes(currentStatus)) return { data: input.data }

            const terminateReq: TerminateOrderRequest = { order_status: "TERMINATED" }
            await this.client.PGTerminateOrder(externalId, terminateReq)

            return { data: { ...input.data, canceled: true } }
        } catch (err) {
            this.logger_.error(`Error canceling Cashfree order ${externalId}: ${JSON.stringify(err?.response?.data) || err}`)
            throw err
        }
    }

    async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
        const externalId = input.data?.order_id as string
        try {
            const getOrderResp = await this.client.PGFetchOrder(externalId)
            const currentStatus = getOrderResp.data.order_status
            if (currentStatus === "PAID") {
                this.logger_.warn(`Order ${externalId} already paid, cannot terminate.`)
                return { data: input.data }
            }
            const terminateReq: TerminateOrderRequest = { order_status: "TERMINATED" }
            await this.client.PGTerminateOrder(externalId, terminateReq)
            return { data: input.data }
        } catch (err) {
            this.logger_.error("Error terminating Cashfree order: " + JSON.stringify(err?.response?.data || err))
            throw err
        }
    }

    async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
        const externalId = input.data?.order_id as string
        if (!externalId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Cashfree getPaymentStatus requires order_id")

        try {
            const response = await this.client.PGFetchOrder(externalId)
            const status = response.data?.order_status || "UNKNOWN"

            let medusaStatus: GetPaymentStatusOutput["status"]
            switch (status) {
                case "ACTIVE": medusaStatus = "pending"; break
                case "PAID": medusaStatus = "captured"; break
                case "EXPIRED": case "TERMINATED": medusaStatus = "canceled"; break
                default: medusaStatus = "error"
            }

            return { data: { ...input.data, ...response.data }, status: medusaStatus }

        } catch (err) {

            this.logger_.error("Error fetching Cashfree order status: " + JSON.stringify(err?.response?.data || err))
            throw new MedusaError(
                MedusaError.Types.NOT_FOUND,
                "Order not found"
            )

        }
    }

    async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
        const externalId = input.data?.order_id as string
        if (!externalId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Cashfree retrievePayment requires order_id")

        try {
            const response = await this.client.PGFetchOrder(externalId)
            return { data: { ...input.data, ...response.data } }
        } catch (err) {
            this.logger_.error("Error retrieving Cashfree order: " + JSON.stringify(err?.response?.data || err))
            throw err
        }
    }

    async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
        const { data } = input
        const externalId = data?.id

        if (data) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Cashfree updatePayment requires order_id")
        }

        try {
            await this.deletePayment({ data: { order_id: externalId } })
        } catch (err: any) {
            this.logger_.warn(`Failed to delete old order ${externalId}: ${err.message}`)
        }

        try {

            const response = await this.initiatePayment(input)
            return { data: response.data, status: "pending" }

        } catch (err: any) {

            this.logger_.error(`Failed to initiate new order: ${err.message}`)
            throw new MedusaError(
                MedusaError.Types.NOT_FOUND,
                "Failed to update payment. Please try again."
            )
        }
    }

    async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
        const { amount, data, context } = input;

        if (!data?.id || !data?.order_id) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid payment data for refund");
        }

        this.logger_.info(`Initiating refund for order ${JSON.stringify(input, null, 2)} with amount ${amount}`);

        const externalId = data.id as string;
        const order_id = data.order_id as string;
        const refundId = generateRefundID(order_id);

        const refundReq: OrderCreateRefundRequest = {
            refund_id: refundId,
            refund_amount: new BigNumber(amount).numeric,
            refund_note: `Refund for ${order_id}`,
        };

        try {

            const res = await this.client.PGOrderCreateRefund(externalId, refundReq)

            this.logger_.info(
                `Refund for order ${order_id} API response: ${JSON.stringify(res.data)}`
            )

            switch (res.data.refund_status) {
                case "SUCCESS":
                case "PENDING":
                case "ONHOLD":
                    return {
                        data: {
                            ...data,
                            refunds: [
                                ...(Array.isArray(data?.refunds) ? data.refunds : []),
                                {
                                    ...res.data
                                },
                            ],
                            last_refund_index:
                                (Array.isArray(data?.refunds) ? data.refunds.length : 0),
                        },
                    }
                default:
                    throw new MedusaError(
                        MedusaError.Types.UNEXPECTED_STATE,
                        `Refund failure: ${res.data.refund_status}`
                    )
            }

        } catch (err: any) {
            const message = err.response?.data || err.message;
            throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Error: " + message);
        }
    }

    async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {

        const {
            data,
            rawData,
            headers
        } = payload

        try {
            this.client.PGVerifyWebhookSignature(
                headers["x-webhook-signature"] as string,
                rawData as string,
                headers["x-webhook-timestamp"] as string);
        } catch (err) {
            throw new MedusaError(
                MedusaError.Types.UNAUTHORIZED,
                "Webhook triggered by unauthorized data."
            )
        }

        const orderData: any = data.data

        this.logger_.info(`Received Cashfree webhook: ${JSON.stringify(payload.data)}`)

        try {
            switch (payload.data.type) {
                case "PAYMENT_SUCCESS_WEBHOOK":
                    return {
                        action: "captured",
                        data: {
                            session_id: orderData.order.order_tags['session_id'],
                            amount: new BigNumber(orderData.order.order_amount)
                        }
                    }
                case "PAYMENT_FAILED_WEBHOOK":
                    return {
                        action: "failed",
                        data: {
                            session_id: orderData.order.order_tags['session_id'],
                            amount: new BigNumber(orderData.order.order_amount)
                        }
                    }
                default:
                    return {
                        action: "not_supported",
                        data: {
                            session_id: "",
                            amount: new BigNumber(0)
                        }
                    }
            }
        } catch (e) {
            return { action: "failed", data: { session_id: orderData.order.order_tags['session_id'], amount: new BigNumber(payload.data.amount as number) } }
        }

    }

    async createAccountHolder() { throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "UNSUPPORTED") }
    async updateAccountHolder() { throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "UNSUPPORTED") }
    async deleteAccountHolder() { throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "UNSUPPORTED") }
    async savePaymentMethod() { throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "UNSUPPORTED") }
    async listPaymentMethods() { throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "UNSUPPORTED") }

    // Validation Method
    async validateOptions(options: Record<any, any>): Promise<void> {
        const { app_id, secret_key, environment, webhook_secret, return_url, notify_url } = options

        if (!app_id || typeof app_id !== "string") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Cashfree requires a valid `app_id` (string) in the options."
            )
        }

        if (!secret_key || typeof secret_key !== "string") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Cashfree requires a valid `secret_key` (string) in the options."
            )
        }

        if (environment && !["sandbox", "production"].includes(environment)) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                `Invalid environment "${environment}". Use "sandbox" or "production".`
            )
        }

        if (webhook_secret && typeof webhook_secret !== "string") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "`webhook_secret` must be a string if provided."
            )
        }

        if (return_url && typeof return_url !== "string") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "`return_url` must be a string if provided."
            )
        }

        if (notify_url && typeof notify_url !== "string") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "`notify_url` must be a string if provided."
            )
        }

        this.logger_.info(
            `✅ Cashfree provider options validated. Using ${environment || "sandbox"} environment`
        )
    }

}

export default CashfreePaymentProviderService
