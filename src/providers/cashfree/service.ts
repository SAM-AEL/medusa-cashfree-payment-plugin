import { Cashfree, CFEnvironment, OrderCreateRefundRequest, TerminateOrderRequest } from "cashfree-pg";
import { AbstractPaymentProvider, BigNumber, MedusaError } from "@medusajs/framework/utils"
import {
    InitiatePaymentInput,
    InitiatePaymentOutput,
    AuthorizePaymentInput,
    AuthorizePaymentOutput,
    CapturePaymentInput, CapturePaymentOutput, CancelPaymentInput, CancelPaymentOutput, DeletePaymentInput, DeletePaymentOutput, GetPaymentStatusInput, GetPaymentStatusOutput, RetrievePaymentInput, RetrievePaymentOutput, RefundPaymentInput, RefundPaymentOutput, UpdatePaymentInput, UpdatePaymentOutput, CreateAccountHolderInput, CreateAccountHolderOutput, DeleteAccountHolderInput, DeleteAccountHolderOutput, ListPaymentMethodsInput, ListPaymentMethodsOutput, SavePaymentMethodInput, SavePaymentMethodOutput, UpdateAccountHolderInput, UpdateAccountHolderOutput, ProviderWebhookPayload, WebhookActionResult
} from "@medusajs/framework/types"
import { generateRefundID } from "./utils";

type Options = {
    app_id: string
    secret_key: string
    environment?: "sandbox" | "production"
    webhook_secret: string
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

        // Validate and format phone number (remove any non-digit characters except +)
        const formatPhoneNumber = (phone: string) => {
            if (!phone) return "";
            return phone.replace(/[^\d+]/g, '');
        };

        // Ensure customer name is not empty
        const customerName = `${customerData.first_name || ""} ${customerData.last_name || ""}`.trim();
        if (!customerName) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Customer name is required");
        }

        // Validate amount is positive
        const numericAmount = new BigNumber(amount).numeric;
        if (numericAmount <= 0) {
            throw new MedusaError(MedusaError.Types.INVALID_DATA, "Amount must be greater than 0");
        }

        const request = {
            order_amount: numericAmount,
            order_currency: (currency_code as string).toUpperCase(),
            customer_details: {
                customer_id: customerData.id,
                customer_name: customerName,
                customer_email: customerData.email,
                customer_phone: formatPhoneNumber(customerData.phone as string || customerData.billing_address?.phone as string),
            },
            order_meta: {
                return_url: this.options_.return_url || undefined,
                notify_url: this.options_.notify_url || undefined,
                payment_methods: undefined // Let Cashfree decide supported methods
            },
            order_tags: { session_id: data?.session_id as string },
        };

        try {
            // Log the request for debugging (without sensitive data)
            this.logger_.info(`Creating Cashfree order for amount: ${numericAmount} ${currency_code}, customer: ${customerName.substring(0, Math.min(customerName.length, 20))}...`)

            // Idempotency: Use session_id as the key to prevent duplicate orders for the same session
            const idempotencyKey = data?.session_id as string;

            const response = await this.client.PGCreateOrder(request, idempotencyKey);

            this.logger_.info("Payment Initialized. Payment ID created successfully.")

            if (!response.data || !response.data.order_id) {
                throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment request failure: No order_id returned from Cashfree")
            }

            const responseData = response.data as any;
            return {
                id: responseData.order_id,
                data: {
                    ...responseData,
                    // Explicitly expose these for storefront use
                    payment_session_id: responseData.payment_session_id,
                    payment_link: responseData.payment_link
                }
            }

        } catch (error: any) {
            // Enhanced error logging for debugging
            const errorDetails = {
                message: error.message,
                status: error.status,
                code: error.code,
                request_amount: numericAmount,
                request_currency: currency_code,
                has_customer_name: !!customerName,
                has_customer_email: !!customerData.email,
                has_customer_phone: !!formatPhoneNumber(customerData.phone as string || customerData.billing_address?.phone as string)
            };

            this.logger_.error("Error setting up Cashfree order request: " + JSON.stringify(errorDetails))

            // Provide more specific error messages
            if (error.message?.includes("UNSUPPORTED")) {
                throw new MedusaError(
                    MedusaError.Types.INVALID_DATA,
                    "Cashfree API returned UNSUPPORTED error. Please check: currency code, amount format, or customer data."
                );
            }

            throw error;
        }
    }

    async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
        const externalId = input.data?.order_id as string
        if (!externalId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing order_id for authorization")

        try {
            const response = await this.client.PGFetchOrder(externalId)
            const status = response?.data?.order_status

            switch (status) {
                case "PAID":
                    return { data: { ...response.data, id: externalId }, status: "authorized" }
                case "ACTIVE":
                case "PENDING":
                    // Payment is still in progress (user on redirect page)
                    return { data: { ...response.data, id: externalId }, status: "pending" }
                case "EXPIRED":
                    return { data: { ...response.data, id: externalId }, status: "error" }
                case "TERMINATED":
                    return { data: { ...response.data, id: externalId }, status: "canceled" }
                default:
                    return { data: { ...response.data, id: externalId }, status: "error" }
            }
        } catch (error: any) {
            this.logger_.error(`Authorization failed for order ${externalId}: ${error.message}`)
            throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, "Failed to authorize payment")
        }
    }

    async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
        const externalId = input.data?.id
        if (!externalId) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Missing payment ID")

        try {
            const response = await this.client.PGFetchOrder(externalId as string)
            const status = response?.data?.order_status

            switch (status) {
                case "PAID":
                    return { data: { ...response.data, id: externalId } }
                case "ACTIVE":
                case "PENDING":
                    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Pending Payment. Try again later.")
                case "EXPIRED":
                    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment order expired.")
                case "TERMINATED":
                    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment terminated.")
                default:
                    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment not captured.")
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
                case "ACTIVE":
                    medusaStatus = "pending";
                    break;
                case "PENDING":
                    medusaStatus = "pending";
                    break;
                case "PAID":
                    medusaStatus = "captured";
                    break;
                case "EXPIRED":
                case "TERMINATED":
                    medusaStatus = "canceled";
                    break;
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

        if (!externalId) {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Cashfree updatePayment requires order_id"
            )
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

        const externalId = data.id as string;
        const order_id = data.order_id as string;
        const refundId = generateRefundID(order_id);

        const refundReq: OrderCreateRefundRequest = {
            refund_id: refundId,
            refund_amount: new BigNumber(amount).numeric,
            refund_note: `Refund for ${order_id}`,
        };

        try {

            // Idempotency: Use refundId to prevent duplicate refunds
            const res = await this.client.PGOrderCreateRefund(externalId, refundReq, refundId)

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

        // Enhanced security logging for webhook auditing
        const sourceIP = headers["x-forwarded-for"] || headers["x-real-ip"] || headers["cf-connecting-ip"] || "unknown";
        const userAgent = headers["user-agent"] || "unknown";
        const webhookType = payload.data?.type || "unknown";

        this.logger_.info(`🔐 WEBHOOK_RECEIVED: ${webhookType} from IP: ${sourceIP}, UA: ${userAgent}`);

        let signatureValid = false;
        try {
            this.client.PGVerifyWebhookSignature(
                headers["x-webhook-signature"] as string,
                rawData as string,
                headers["x-webhook-timestamp"] as string);

            signatureValid = true;
            this.logger_.info(`✅ WEBHOOK_AUTHORIZED: Signature verified for ${webhookType}`);
        } catch (err) {
            this.logger_.warn(`❌ WEBHOOK_UNAUTHORIZED: Invalid signature for ${webhookType} from ${sourceIP}`);
            throw new MedusaError(
                MedusaError.Types.UNAUTHORIZED,
                "Webhook triggered by unauthorized data."
            )
        }

        // temp cast
        const orderData: any = data.data

        try {
            let result: WebhookActionResult;

            switch (payload.data.type) {
                case "PAYMENT_SUCCESS_WEBHOOK":
                    result = {
                        action: "captured",
                        data: {
                            session_id: orderData.order.order_tags['session_id'],
                            amount: new BigNumber(orderData.order.order_amount)
                        }
                    }
                    this.logger_.info(`💰 WEBHOOK_PROCESSED: Payment captured for session ${orderData.order.order_tags['session_id']}`);
                    break;
                case "PAYMENT_FAILED_WEBHOOK":
                    result = {
                        action: "failed",
                        data: {
                            session_id: orderData.order.order_tags['session_id'],
                            amount: new BigNumber(orderData.order.order_amount)
                        }
                    }
                    this.logger_.warn(`❌ WEBHOOK_PROCESSED: Payment failed for session ${orderData.order.order_tags['session_id']}`);
                    break;
                default:
                    result = {
                        action: "not_supported",
                        data: {
                            session_id: "",
                            amount: new BigNumber(0)
                        }
                    }
                    this.logger_.info(`⚠️ WEBHOOK_PROCESSED: Unsupported webhook type ${payload.data.type}`);
            }

            return result;
        } catch (e) {
            this.logger_.error(`💥 WEBHOOK_ERROR: Failed to process webhook ${payload.data.type}: ${e.message}`);
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

        if (!webhook_secret || typeof webhook_secret !== "string") {
            throw new MedusaError(
                MedusaError.Types.INVALID_DATA,
                "Cashfree requires a valid `webhook_secret` (string) in the options."
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
