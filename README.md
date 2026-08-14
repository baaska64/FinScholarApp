# FinScholar App

## RevenueCat & Google Play Subscriptions

This section contains all the product IDs and instructions needed to configure the subscriptions for the app.

### Product IDs
- **Annual Plan**: `fin_premium_annual`
- **Annual Base Plan ID (Google Play)**: `annual-base`
- **RevenueCat Package Identifier for Annual**: `Annual` (Must match the default package type from RevenueCat dropdown)

### How to set up the Annual Plan

#### Step 1: Create the Annual Subscription in Google Play Console
1. Go to your [Google Play Console](https://play.google.com/console/) and select the **FinScholar** app.
2. In the left menu, scroll down to **Monetize** > **Products** and click on **Subscriptions**.
3. Click the blue **Create subscription** button at the top right.
4. **Product ID:** Type exactly `fin_premium_annual`.
5. **Name:** Type `Fin Premium Annual`.
6. Click **Create**.
7. Now you are on the subscription details page. Scroll down to the **Base plans** section and click **Add base plan**.
8. **Base plan ID:** Type `annual-base`.
9. **Type:** Select **Auto-renewing**.
10. **Billing period:** Select **Yearly** (or 1 year).
11. Scroll down to **Price and availability**, click **Set price**, enter `250` (for PHP 250), and click **Update**.
12. Click **Save** at the bottom right.
13. Finally, at the top right of the page, click **Activate** so the base plan is live and ready for RevenueCat to see.

#### Step 2: Add the Product to RevenueCat
1. Go to your [RevenueCat Dashboard](https://app.revenuecat.com/) and select your project.
2. In the left menu under **Product Setup**, click on **Products**.
3. Click the **+ New** button.
4. From the Store dropdown, select **Google Play**.
5. **Product identifier:** Type exactly `fin_premium_annual:annual-base`.
6. Click **Add product**.

#### Step 3: Attach it to your "Premium" Entitlement
1. In the left menu of RevenueCat, click on **Entitlements**.
2. Click on your existing `Premium` entitlement.
3. Click the **Attach** button.
4. Select the `fin_premium_annual:annual-base` product you just made.
5. Click **Add**.

#### Step 4: Add it to your active Offering
1. In the left menu, click on **Offerings**.
2. Click on your `default` offering (or whatever your current offering is named).
3. Under the "Packages" section, click **+ New**.
4. In the **Identifier** dropdown, you **must** select **Annual**.
5. Click **Add**.
6. You will see your new "Annual" package listed. Click on it.
7. Click **Attach**.
8. Select the `fin_premium_annual:annual-base` product.
9. Click **Attach** again.

## Android Credentials (Google Play & OAuth)

**Production SHA-1 Fingerprint**: `BB:74:0D:DD:02:6B:E7:31:84:B1:2B:61:61:0B:C4:3C:AD:B1:EB:2A`
*(Used for Google Cloud Console Android Client ID configuration)*
