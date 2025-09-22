<h1 align="center">
  <br>
  <a href="https://www.cashfree.com"><img src="https://i.postimg.cc/J4CSX1N5/idz-Bxe-INHs-1758481918631.png" alt="Markdownify" width="200"></a>
  <br>
 for Medusa 2.0+
  <br>
</h1>

<p align="center">
    <img src="https://img.shields.io/npm/v/medusa-cashfree-payment-plugin" alt="medusa-cashfree-payment-plugin">
    <img src="https://img.shields.io/npm/dw/medusa-cashfree-payment-plugin" alt="medusa-cashfree-payment-plugin">  
    <img src="https://img.shields.io/github/contributors/SAM-AEL/medusa-cashfree-payment-plugin" alt="medusa-cashfree-payment-plugin">  
 <img src="https://img.shields.io/github/last-commit/SAM-AEL/medusa-cashfree-payment-plugin" alt="medusa-cashfree-payment-plugin">
</p>
  
<h4 align="center">Accept payments from customers through <a href="https://www.cashfree.com" target="_blank">Cashfree</a>'s robust payment gateway..</h4>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#%EF%B8%8F-installation">Installation</a> •
  <a href="#-setup-guide">Setup Guide</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-troubleshooting">Troubleshooting</a> •
  <a href="#-contributing">Contributing</a> •
  <a href="#-license">License</a>
</p>

## ✨ Features

- 💳 **Multiple Payment Methods** - _UPI, Credit/Debit Cards, Net Banking, Paylater, EMI and Wallets_

- 💸 **Easy Refunds** - _Process refunds directly from Medusa admin panel_

- 🔒 **Secure Transactions** - _Webhook verification and PCI DSS compliance_

- 🌍 **Dual Environment** - _Sandbox testing and production ready_

- ⚡ **Real-time Updates** - _Instant payment status synchronization_

## 📋 Prerequisites

- [MedusaJS](https://docs.medusajs.com/) 2 store

- [Cashfree Payments](https://merchant.cashfree.com/) merchant account

## 🚧 To Do:

- **_Rewrite the plugin with more optimizations and code cleanup._**

## 🛠️ Installation

#### Step 1: Install the Plugin

Choose your preferred package manager:

```bash

# npm

npm  install  medusa-cashfree-payment-plugin



# yarn

yarn  add  medusa-cashfree-payment-plugin



# pnpm

pnpm  add  medusa-cashfree-payment-plugin

```

#### Step 2: Configure Plugin

Add the plugin to your `medusa-config.js`:

```javascript

module.exports = defineConfig({

  modules: [

  // ... other plugins

    {
      resolve: "@medusajs/medusa/payment",
      options: {
      providers: [
        {
          resolve: "medusa-cashfree-payment-plugin/providers/cashfree",
          id: "cashfree",
          options: {
            app_id: process.env.CASHFREE_APP_ID,
            secret_key: process.env.CASHFREE_SECRET_KEY,
            environment: process.env.CASHFREE_ENV,
            webhook_secret: process.env.CASHFREE_WEBHOOK_SECRET,
            return_url: process.env.CASHFREE_RETURN_URL,
            notify_url: process.env.CASHFREE_NOTIFY_URL
          }
        }
      ]}
    }

  ];

})

```

#### Step 3: Environment Variables

Create or update your `.env` file:

```env

# Cashfree Configuration

CASHFREE_APP_ID=your_app_id_here
CASHFREE_SECRET_KEY=your_secret_key_here
CASHFREE_ENVIRONMENT=sandbox
CASHFREE_WEBHOOK_SECRET=your_webhook_secret_here
CASHFREE_RETURN_URL=https://your-store-domain.com/processing/order
CASHFREE_NOTIFY_URL=https://your-store-domain.com/hooks/payment/cashfree_cashfree

```

> ⚠️ **Security Note**: Never commit your production credentials to version control.

### ⚙️ Cashfree Configuration Options

| Option           | Type   | Required | Default   | Description                                                             |
| ---------------- | ------ | -------- | --------- | ----------------------------------------------------------------------- |
| `app_id`         | string | ✅       | -         | Your Cashfree App ID                                                    |
| `secret_key`     | string | ✅       | -         | Your Cashfree Secret Key                                                |
| `environment`    | string | ❌       | `sandbox` | Environment to use (`sandbox` or `production`)                          |
| `webhook_secret` | string | ❌       | -         | Webhook secret for signature verification                               |
| `return_url`     | string | ❌       | -         | URL to redirect the customer to after payment is complete               |
| `notify_url`     | string | ❌       | -         | URL to receive webhook notifications from Cashfree about payment status |

### 🎯 Setup Guide

### Enable Payment Provider

1. Navigate to **Medusa Admin → Settings → Regions**

2. Select your target region - India

3. In **Payment Providers**, select `cashfree`

4. Click **Save Changes**

### Configure Webhooks

1. Go to [Cashfree Dashboard](https://merchant.cashfree.com/) → **Developers → Webhooks**

2. Click **Add Webhook**

3. Configure webhook URL. You can use the `notify_url` from your `.env` file or another URL.

```

https://your-store-domain.com/hooks/payment/cashfree_cashfree

```

4. Select these events:

- `PAYMENT_SUCCESS_WEBHOOK`

- `PAYMENT_FAILED_WEBHOOK`

5. Add your webhook secret to .env - `(CASHFREE_WEBHOOK_SECRET)`

6. Save configuration

##### Note -

**`return_url`:** The `return_url` is where the customer is redirected after completing the payment. It's important to set this to a page on your storefront that can handle the order completion process.

**`notify_url`:** This is the webhook endpoint of your server where Cashfree will send automatic updates (like payment success, failure, or refund) for each order. Default is `https://yoursite.com/hooks/payment/cashfree_cashfree`.

### 🔧 API Reference

This plugin implements the complete `AbstractPaymentProvider` interface:

#### Core Methods

- `initiatePayment()` - Initialize payment session
- `authorizePayment()` - Authorize payment amount
- `capturePayment()` - Capture authorized payment
- `cancelPayment()` - Cancel pending payment
- `refundPayment()` - Process refunds

#### Utility Methods

- `getPaymentStatus()` - Get current payment status
- `retrievePayment()` - Fetch payment details
- `updatePayment()` - Update payment information
- `deletePayment()` - Remove payment record

### 🐛 Troubleshooting

#### Common Issues

**_Plugin not appearing in admin_**

```bash

# Restart your Medusa server

npm  run  dev

```

**_Webhook verification failing_**

- Ensure webhook secret matches in both Cashfree dashboard and `.env`

- Check webhook URL is publicly accessible

**_Payment status not updating_**

- Verify webhook events are properly configured

- Check server logs for webhook errors

### Getting Help

- 📖 [Cashfree Documentation](https://docs.cashfree.com/)

- 💬 [MedusaJS Discord](https://discord.gg/medusajs)

- 🐛 [Report Issues](https://github.com/SAM-AEL/medusa-cashfree-payment-plugin/issues)

### 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository

2. Create your feature branch (`git checkout -b feature/amazing-feature`)

3. Commit your changes (`git commit -m 'Add amazing feature'`)

4. Push to the branch (`git push origin feature/amazing-feature`)

5. Open a Pull Request

### 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

### 🙏 Acknowledgments

- [MedusaJS](https://medusajs.com/) - for the best open-source e-commerce platform.

- [Cashfree](https://cashfree.com/) - for providing reliable payment processing service.

---

<h1 align="center">
  <br> 
  Thank you 🫶
  <br>
</h1>
