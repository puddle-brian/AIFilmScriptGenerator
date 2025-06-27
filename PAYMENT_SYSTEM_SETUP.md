# Payment System Setup Guide

This guide walks you through setting up Stripe payments for your Film Script Generator credit system.

## Overview

The payment system is designed to be:
- **Minimal**: Only adds what's necessary for payments
- **Clean**: Separates payment logic from your existing code  
- **Scalable**: Can handle increasing transaction volume
- **Secure**: Uses Stripe's best practices for payment processing

## Setup Steps

### 1. Install Dependencies

```bash
npm install stripe
```

### 2. Create Stripe Account

1. Go to [https://stripe.com](https://stripe.com) and create an account
2. Complete the onboarding process
3. Get your API keys from the Stripe Dashboard

### 3. Environment Variables

Add these to your `.env` file:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Base URL for redirects (change for production)
BASE_URL=http://localhost:3000
```

### 4. Update Frontend

Update the Stripe publishable key in `public/buy-credits.html`:

```javascript
const stripe = Stripe('pk_test_your_stripe_publishable_key_here');
```

### 5. Configure Stripe Webhooks

1. In your Stripe Dashboard, go to **Developers > Webhooks**
2. Click **Add endpoint**
3. Add endpoint URL: `https://yourdomain.com/api/stripe-webhook`
4. Select event: `checkout.session.completed`
5. Copy the webhook signing secret to your `.env` file

### 6. Test the System

1. Start your server: `npm start`
2. Visit: `http://localhost:3000/buy-credits`
3. Use Stripe's test card numbers:
   - Success: `4242424242424242`
   - Declined: `4000000000000002`

## File Structure

```
FilmScriptGenerator/
├── payment-handlers.js          # Payment logic (NEW)
├── public/buy-credits.html      # Credit purchase page (NEW)
├── server.js                    # Updated with payment endpoints
└── package.json                 # Updated with Stripe dependency
```

## How It Works

### 1. User Flow
1. User clicks "Buy Credits" button
2. System creates Stripe checkout session
3. User redirected to Stripe payment page
4. After payment, user redirected back with success/cancel status
5. Webhook processes the payment and adds credits

### 2. Integration Points
- **Credit Widget**: Existing widget shows updated balance
- **Database**: Uses existing `credit_transactions` table
- **Authentication**: Uses existing API key system

### 3. Security Features
- Webhook signature verification
- Server-side payment processing
- No sensitive data stored locally
- PCI compliance through Stripe

## Pricing Strategy

The default packages are:

- **Starter**: 500 credits for $5.00 ($0.01/credit)
- **Popular**: 2,000 credits for $15.00 ($0.0075/credit) - 25% savings
- **Pro**: 5,000 credits for $30.00 ($0.006/credit) - 40% savings

You can modify these in `public/buy-credits.html`.

## Production Deployment

### 1. Switch to Live Keys
Replace test keys with live keys in production:
```env
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
```

### 2. Update Base URL
```env
BASE_URL=https://yourdomain.com
```

### 3. Configure Production Webhook
Update webhook endpoint to your production domain.

## Monitoring & Analytics

### Available Data
- Transaction history via `/api/my-payment-history`
- Admin view in existing admin panel
- Stripe dashboard for payment analytics

### Key Metrics
- Credit purchase conversion rate
- Average order value
- Customer lifetime value
- Payment success/failure rates

## Troubleshooting

### Common Issues

**Payment not completing:**
- Check webhook is configured correctly
- Verify webhook secret matches
- Check server logs for webhook errors

**Credits not added:**
- Check database connection
- Verify webhook endpoint is reachable
- Check transaction logs in `credit_transactions` table

**Frontend errors:**
- Verify publishable key is correct
- Check browser console for JavaScript errors
- Ensure user is authenticated

### Support

For Stripe-specific issues:
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Support](https://support.stripe.com)

For integration issues:
- Check server logs
- Review `credit_transactions` table
- Test with Stripe test cards

## Future Enhancements

The system is designed to easily add:
- Subscription billing
- Multiple payment methods (PayPal, Apple Pay)
- Bulk credit discounts
- Promotional codes
- Tax handling
- International currencies

## Security Best Practices

1. **Never expose secret keys** in frontend code
2. **Always verify webhooks** using Stripe signatures  
3. **Use HTTPS** in production
4. **Monitor transactions** for suspicious activity
5. **Keep Stripe SDK updated** for security patches

---

## Quick Start Checklist

- [ ] Install Stripe dependency (`npm install stripe`)
- [ ] Create Stripe account and get API keys
- [ ] Add environment variables to `.env`
- [ ] Update publishable key in `buy-credits.html`
- [ ] Configure webhook in Stripe dashboard
- [ ] Test with Stripe test cards
- [ ] Deploy and test production webhook

Your payment system is now ready for users to purchase credits! 