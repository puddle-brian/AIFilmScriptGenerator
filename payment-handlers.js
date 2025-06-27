/**
 * Payment System Integration for Film Script Generator
 * Handles Stripe payments and credit purchases
 */

class PaymentHandler {
    constructor(dbClient) {
        this.dbClient = dbClient;
        this.webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        
        // Check for required environment variables first
        if (!process.env.STRIPE_SECRET_KEY) {
            throw new Error('STRIPE_SECRET_KEY environment variable is required');
        }
        
        // Initialize Stripe with the secret key from environment
        this.stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        
        console.log('✅ Stripe initialized with key:', process.env.STRIPE_SECRET_KEY.substring(0, 15) + '...');
    }

    /**
     * Create Stripe checkout session for credit purchase
     */
    async createCheckoutSession(user, credits, priceInCents, packageName) {
        try {
            const session = await this.stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${packageName} - ${credits} Credits`,
                            description: `Credits for Film Script Generator - Never expire`,
                        },
                        unit_amount: priceInCents,
                    },
                    quantity: 1,
                }],
                mode: 'payment',
                success_url: `${process.env.BASE_URL || 'http://localhost:3000'}/buy-credits.html?success=true`,
                cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/buy-credits.html?canceled=true`,
                metadata: {
                    userId: user.id.toString(),
                    username: user.username,
                    credits: credits.toString(),
                    packageName: packageName
                },
                // Optional: Pre-fill customer email if available
                ...(user.email && { customer_email: user.email })
            });

            return { sessionId: session.id };
        } catch (error) {
            console.error('Error creating checkout session:', error);
            throw new Error('Failed to create payment session');
        }
    }

    /**
     * Handle successful payment webhook from Stripe
     */
    async handlePaymentSuccess(event) {
        const session = event.data.object;
        const { userId, username, credits, packageName } = session.metadata;

        try {
            // Add credits to user account
            await this.dbClient.query(
                'UPDATE users SET credits_remaining = credits_remaining + $1, total_credits_purchased = total_credits_purchased + $2 WHERE id = $3',
                [parseInt(credits), parseInt(credits), parseInt(userId)]
            );

            // Log the purchase transaction
            await this.dbClient.query(`
                INSERT INTO credit_transactions (
                    user_id, transaction_type, credits_amount, notes, payment_method, payment_id
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
                parseInt(userId),
                'purchase',
                parseInt(credits),
                `Credit purchase: ${packageName}`,
                'stripe',
                session.payment_intent
            ]);

            console.log(`✅ Payment processed: ${credits} credits added to user ${username}`);
            
            return { success: true };
        } catch (error) {
            console.error('Error processing payment:', error);
            
            // Log failed transaction for investigation
            try {
                await this.dbClient.query(`
                    INSERT INTO credit_transactions (
                        user_id, transaction_type, credits_amount, notes, payment_method, payment_id
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                    parseInt(userId),
                    'purchase_failed',
                    parseInt(credits),
                    `Payment processing failed: ${error.message}`,
                    'stripe',
                    session.payment_intent
                ]);
            } catch (logError) {
                console.error('Failed to log failed transaction:', logError);
            }
            
            throw error;
        }
    }

    /**
     * Verify webhook signature
     */
    verifyWebhookSignature(payload, signature) {
        try {
            return this.stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);
        } catch (error) {
            console.error('Webhook signature verification failed:', error);
            throw new Error('Invalid webhook signature');
        }
    }

    /**
     * Get payment history for a user
     */
    async getPaymentHistory(userId, limit = 10) {
        try {
            const result = await this.dbClient.query(`
                SELECT 
                    credits_amount,
                    notes,
                    payment_method,
                    created_at
                FROM credit_transactions 
                WHERE user_id = $1 AND transaction_type = 'purchase'
                ORDER BY created_at DESC
                LIMIT $2
            `, [userId, limit]);

            return result.rows;
        } catch (error) {
            console.error('Error fetching payment history:', error);
            throw new Error('Failed to fetch payment history');
        }
    }
}

module.exports = PaymentHandler; 