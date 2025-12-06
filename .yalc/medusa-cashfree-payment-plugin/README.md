
<h1 align="center">
  <br>
  <a href="https://www.cashfree.com"><img src="https://i.postimg.cc/J4CSX1N5/idz-Bxe-INHs-1758481918631.png" alt="Cashfree Payment Plugin" width="200"></a>
  <br>
  Cashfree Payment Plugin for Medusa
  <br>
</h1>

<p align="center">
    <a href="https://www.npmjs.com/package/medusa-cashfree-payment-plugin"><img src="https://img.shields.io/npm/v/medusa-cashfree-payment-plugin" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/medusa-cashfree-payment-plugin"><img src="https://img.shields.io/npm/dw/medusa-cashfree-payment-plugin" alt="npm downloads"></a>
    <a href="https://github.com/SAM-AEL/medusa-cashfree-payment-plugin/blob/main/LICENSE"><img src="https://img.shields.io/github/license/SAM-AEL/medusa-cashfree-payment-plugin" alt="license"></a>
    <a href="https://github.com/SAM-AEL/medusa-cashfree-payment-plugin"><img src="https://img.shields.io/github/last-commit/SAM-AEL/medusa-cashfree-payment-plugin" alt="last commit"></a>
</p>

<p align="center">
  <b>A robust, production-ready Cashfree payment provider for Medusa v2 applications.</b>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-prerequisites">Prerequisites</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-storefront-usage">Storefront Usage</a> •
  <a href="#-troubleshooting">Troubleshooting</a>
</p>

---

## ✨ Features

- **全面的 Payment Support**: Accept payments via UPI, Credit/Debit Cards, Net Banking, Paylater, EMI, and Wallets.
- **Secure Handling**: Robust webhook signature verification to prevent fraud.
- **Seamless Integration**: Works natively with Medusa's checkout flow.
- **Admin Refunds**: Process partial or full refunds directly from the Medusa Admin dashboard.
- **Dual Environment**: easy switching between `sandbox` (test) and `production` modes.
- **Developer Friendly**: Detailed error logging for easier debugging.

## 📋 Prerequisites

Before you begin, ensure you have:

- A [Medusa v2](https://docs.medusajs.com/) backend server.
- A [Cashfree Merchant Account](https://merchant.cashfree.com/) (Sign up if you haven't).
- API Keys (`App ID` and `Secret Key`) from your Cashfree Dashboard.

## 🛠️ Installation

In your Medusa project directory, install the plugin using your preferred package manager:

```bash
# Using npm
npm install medusa-cashfree-payment-plugin

# Using yarn
yarn add medusa-cashfree-payment-plugin

# Using pnpm
pnpm add medusa-cashfree-payment-plugin
```

## ⚙️ Configuration

### 1. Add to Medusa Config

Open your `medusa-config.js` (or `medusa-config.ts`) and add the module to the `modules` array:

```javascript
module.exports = defineConfig({
  projectConfig: {
    // ...
  },
  // IMPORTANT: Add the plugin to the plugins array for Admin Widgets to work
  plugins: [
    "medusa-cashfree-payment-plugin"
  ],
  modules: [
    // ... other modules
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "medusa-cashfree-payment-plugin",
            id: "cashfree",
            options: {
              app_id: process.env.CASHFREE_APP_ID,
              secret_key: process.env.CASHFREE_SECRET_KEY,
              environment: process.env.CASHFREE_ENVIRONMENT || "sandbox", // 'sandbox' or 'production'
              webhook_secret: process.env.CASHFREE_WEBHOOK_SECRET,
              return_url: process.env.CASHFREE_RETURN_URL, // Optional but recommended
              notify_url: process.env.CASHFREE_NOTIFY_URL  // Optional
            }
          }
        ]
      }
    }
  ]
});
```

### 2. Configure Environment Variables

Add the following keys to your `.env` file. These are **critical** for the plugin to function.

```env
# Cashfree API Credentials
CASHFREE_APP_ID=your_app_id_here
CASHFREE_SECRET_KEY=your_secret_key_here

# Environment (sandbox or production)
CASHFREE_ENVIRONMENT=sandbox

# Webhook Secret (From Cashfree Dashboard -> Developers -> Webhooks)
CASHFREE_WEBHOOK_SECRET=your_webhook_secret_here

# Store URLs
CASHFREE_RETURN_URL=https://your-store.com/order/confirmed
CASHFREE_NOTIFY_URL=https://your-medusa-backend.com/hooks/payment/cashfree_cashfree
```

> [!IMPORTANT]
> **Never commit real API keys to GitHub.** Use environment variables for all sensitive credentials.

### 3. Setup Webhooks (Critical)

For the order status to update automatically in Medusa (from `Pending` to `Captured`), you **must** configure webhooks in Cashfree.

1.  Log in to the **Cashfree Dashboard**.
2.  Go to **Developers** > **Webhooks**.
3.  Click **Add Webhook** for the Payment Gateway.
4.  Enter your **Notification URL**:
    ```
    https://<YOUR_MEDUSA_BACKEND_URL>/hooks/payment/cashfree_cashfree
    ```
5.  Select the following events:
    - `PAYMENT_SUCCESS_WEBHOOK`
    - `PAYMENT_FAILED_WEBHOOK`
6.  Save and copy the **Webhook Secret**. Paste this into your `.env` file as `CASHFREE_WEBHOOK_SECRET`.

## 🛒 Storefront Usage

To use Cashfree in your Medusa Storefront (Next.js or other):

1.  **Enable in Region**:
    - Go to your Medusa Admin.
    - Navigate to **Settings** > **Regions**.
    - Select the region (e.g., "India").
    - Under **Payment Providers**, check `cashfree` and save.

2.  **Checkout Flow**:
    - When a customer reaches the payment step during checkout, "Cashfree" will appear as a payment option.
    - Upon selecting it and clicking "Place Order", the plugin's `initiatePayment` method is called.
    - **Frontend Implementation**: Your storefront must handle the response. The plugin returns a `payment_session` valid for Cashfree. You typically redirect the user to the `payment_link` provided in the session data, or use the Cashfree SDK on the frontend with the `payment_session_id`.

    > **Note for Next.js Starter**: If you are using the standard Medusa Next.js Starter, it generally handles the redirection for external payment providers automatically if the `data` contains a `payment_link`.

## 🔧 Admin Usage

### Refunds
You can easily refund orders directly from the Medusa Admin:
1.  Open the **Order** details page.
2.  Scroll to the **Payment** section.
3.  Click **Refund**.
4.  Enter the amount and note.
5.  The plugin will instantly process the refund via Cashfree's API and update the order status.

## 🐛 Troubleshooting

| Issue | Possible Cause | Solution |
| :--- | :--- | :--- |
| **"UNSUPPORTED" Error** | Invalid currency or amount format | Ensure you are using `INR` (if restricted by Cashfree) and the amount is valid. |
| **Payment Status Stuck at Pending** | Webhooks not configured | Verify `CASHFREE_NOTIFY_URL` is correct and accessible. Check Medusa server logs for `WEBHOOK_RECEIVED`. |
| **Signature Verification Failed** | Wrong Webhook Secret | Ensure `CASHFREE_WEBHOOK_SECRET` in `.env` matches the one in Cashfree Dashboard exactly. |
| **CORS Errors** | Frontend/Backend mismatch | Ensure your Storefront URL and Backend URL are correctly configured in CORS settings. |

## 🤝 Contributing

Contributions are welcome!
1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/new-feature`).
3.  Commit your changes.
4.  Push to the branch and open a Pull Request.

## 📄 License

MIT © [SAM-AEL](https://github.com/SAM-AEL)
