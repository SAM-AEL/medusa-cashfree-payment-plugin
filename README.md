# 🚀 Medusa Cashfree Payment Plugin

> **Seamlessly integrate Cashfree Payments with MedusaJS V2 e-commerce stores**

Accept payments from customers through Cashfree's robust payment gateway.
---

## ✨ Features

- 💳 **Multiple Payment Methods** - UPI, Credit/Debit Cards, Net Banking, Paylater, EMI and Wallets
- 💸 **Easy Refunds** - Process refunds directly from Medusa admin panel
- 🔒 **Secure Transactions** - Webhook verification and PCI DSS compliance
- 🌍 **Dual Environment** - Sandbox testing and production ready
- ⚡ **Real-time Updates** - Instant payment status synchronization
- 💲 **Cashfree server sdk** - under the hood.

## 📋 Prerequisites

- [MedusaJS V2](https://docs.medusajs.com/) store
- [Cashfree Payments](https://merchant.cashfree.com/) merchant account

## 🛠️ Installation

### Step 1: Install the Plugin

Choose your preferred package manager:

```bash
# npm
npm install medusa-cashfree-payment-plugin

# yarn  
yarn add medusa-cashfree-payment-plugin

# pnpm
pnpm add medusa-cashfree-payment-plugin
```

### Step 2: Configure Plugin

Add the plugin to your `medusa-config.js`:

```javascript
const plugins = [
  // ... other plugins
  {
    resolve: `medusa-cashfree-payment-plugin`,
    options: {
      app_id: process.env.CASHFREE_APP_ID,
      secret_key: process.env.CASHFREE_SECRET_KEY,
      environment: process.env.CASHFREE_ENVIRONMENT, // "sandbox" or "production"
      webhook_secret: process.env.CASHFREE_WEBHOOK_SECRET,
      return_url: process.env.CASHFREE_RETURN_URL,
      notify_url: process.env.CASHFREE_NOTIFY_URL,
    },
  },
];
```

### Step 3: Environment Variables

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

## ⚙️ Configuration Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `app_id` | string | ✅ | - | Your Cashfree App ID |
| `secret_key` | string | ✅ | - | Your Cashfree Secret Key |
| `environment` | string | ❌ | `sandbox` | Environment (`sandbox` or `production`) |
| `webhook_secret` | string | ❌ | - | Webhook secret for signature verification |
| `return_url` | string | ❌ | - | The URL to redirect the customer to after payment is complete. |
| `notify_url` | string | ❌ | - | The URL to send webhook notifications to. This will be used by Cashfree to send payment status updates. |

## 🎯 Setup Guide

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

## 🔧 API Reference

This plugin implements the complete `AbstractPaymentProvider` interface:

### Core Methods
- `initiatePayment()` - Initialize payment session
- `authorizePayment()` - Authorize payment amount
- `capturePayment()` - Capture authorized payment
- `cancelPayment()` - Cancel pending payment
- `refundPayment()` - Process refunds

### Utility Methods  
- `getPaymentStatus()` - Get current payment status
- `retrievePayment()` - Fetch payment details
- `updatePayment()` - Update payment information
- `deletePayment()` - Remove payment record

## 🐛 Troubleshooting

### Common Issues

**Plugin not appearing in admin**
```bash
# Restart your Medusa server
npm run dev
```

**Webhook verification failing**
- Ensure webhook secret matches in both Cashfree dashboard and `.env`
- Check webhook URL is publicly accessible

**Payment status not updating**
- Verify webhook events are properly configured
- Check server logs for webhook errors

### Getting Help

- 📖 [Cashfree Documentation](https://docs.cashfree.com/)
- 💬 [MedusaJS Discord](https://discord.gg/medusajs)
- 🐛 [Report Issues](https://github.com/SAM-AEL/medusa-cashfree-payment-plugin/issues)

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [MedusaJS](https://medusajs.com/) - for the best open-source e-commerce platform.
- [Cashfree](https://cashfree.com/) - for providing reliable payment processing service.

---

**[⭐ Star this repo](https://github.com/SAM-AEL/medusa-cashfree-payment-plugin)** if you found it helpful!

---
[![npm version](https://badge.fury.io/js/medusa-cashfree-payment-plugin.svg)](https://badge.fury.io/js/medusa-cashfree-payment-plugin) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)