// Pre-loaded funnel templates. Each step matches the TemplateStep shape in
// backend/lib/schema.ts (FunnelStepSchema extended with `hint` and
// `selectorCandidates`). DOMAIN_PLACEHOLDER is swapped for the user's real
// tab origin when a template is loaded into the side panel.
(function () {
  const DOMAIN_PLACEHOLDER = 'https://your-site.example';

  const SHOPIFY_CHECKOUT = {
    templateId: 'shopify_checkout_v1',
    vertical: 'shopify_checkout',
    name: 'Shopify Checkout',
    description: 'Product view through order confirmation, mapped to Shopify’s stock Dawn theme + native checkout.',
    funnelName: 'Shopify Checkout',
    steps: [
      {
        order: 1,
        label: 'Product Viewed',
        urlPattern: `${DOMAIN_PLACEHOLDER}/products/:id`,
        trigger: { type: 'pageview', selector: null },
        hint: 'Fires whenever a shopper lands on any product page. Adjust the path if your store doesn’t use the default /products/:handle structure.',
      },
      {
        order: 2,
        label: 'Add to Cart',
        urlPattern: `${DOMAIN_PLACEHOLDER}/products/:id`,
        trigger: { type: 'click', selector: 'button[name="add"]' },
        selectorCandidates: ['button[name="add"]', '.product-form__submit', 'form[action*="/cart/add"] button[type="submit"]'],
        hint: 'The "Add to cart" button on the product page. Matches Shopify’s Dawn theme by default.',
      },
      {
        order: 3,
        label: 'Checkout Started',
        urlPattern: `${DOMAIN_PLACEHOLDER}/cart`,
        trigger: { type: 'click', selector: 'button[name="checkout"]' },
        selectorCandidates: ['button[name="checkout"]', '#checkout', '.cart__checkout-button'],
        hint: 'The "Checkout" button on the cart page or cart drawer.',
      },
      {
        order: 4,
        label: 'Shipping Info Added',
        urlPattern: `${DOMAIN_PLACEHOLDER}/checkout`,
        trigger: { type: 'pageview', selector: null },
        hint: 'Shopify Checkout is a locked, separate domain (often checkout.<yourstore>.com). Confirm the real origin — it can’t be customized like your storefront.',
      },
      {
        order: 5,
        label: 'Payment Info Added',
        urlPattern: `${DOMAIN_PLACEHOLDER}/checkout?step=payment_method`,
        trigger: { type: 'pageview', selector: null },
        hint: 'The payment step of Shopify’s multi-stage checkout. Query param may differ if you use Shop Pay or an accelerated checkout.',
      },
      {
        order: 6,
        label: 'Purchase',
        urlPattern: `${DOMAIN_PLACEHOLDER}/checkout/thank_you`,
        trigger: { type: 'pageview', selector: null },
        hint: 'Shopify’s order confirmation / thank-you page — the standard purchase-complete URL.',
      },
    ],
  };

  const SAAS_TRIAL_SIGNUP = {
    templateId: 'saas_trial_signup_v1',
    vertical: 'saas_trial_signup',
    name: 'SaaS Trial Signup',
    description: 'Landing page through first authenticated dashboard view, for a typical self-serve free-trial funnel.',
    funnelName: 'SaaS Trial Signup',
    steps: [
      {
        order: 1,
        label: 'Landing Page View',
        urlPattern: `${DOMAIN_PLACEHOLDER}/`,
        trigger: { type: 'pageview', selector: null },
        hint: 'Any marketing/landing page a visitor arrives on.',
      },
      {
        order: 2,
        label: 'Start Trial Clicked',
        urlPattern: `${DOMAIN_PLACEHOLDER}/`,
        trigger: { type: 'click', selector: 'a[href*="signup"]' },
        selectorCandidates: ['a[href*="signup"]', '[data-cta="start-trial"]', '.cta-start-trial'],
        hint: 'Your primary "Start free trial" / "Get started" call-to-action button.',
      },
      {
        order: 3,
        label: 'Signup Form Submitted',
        urlPattern: `${DOMAIN_PLACEHOLDER}/signup`,
        trigger: { type: 'formSubmit', selector: 'form#signup-form' },
        selectorCandidates: ['form#signup-form', 'form[action*="signup"]', 'form[action*="register"]'],
        formFields: ['email', 'password'],
        hint: 'The signup form itself — wraps the email/password fields.',
      },
      {
        order: 4,
        label: 'Email Verified',
        urlPattern: `${DOMAIN_PLACEHOLDER}/verify`,
        trigger: { type: 'pageview', selector: null },
        hint: 'Landing page after the user clicks the email-verification link. Adjust if verification redirects straight into onboarding.',
      },
      {
        order: 5,
        label: 'Trial Activated',
        urlPattern: `${DOMAIN_PLACEHOLDER}/dashboard`,
        trigger: { type: 'pageview', selector: null },
        hint: 'First authenticated view of the product dashboard — the moment the trial actually starts being used.',
      },
    ],
  };

  const LEAD_GEN_FORM = {
    templateId: 'lead_gen_form_v1',
    vertical: 'lead_gen_form',
    name: 'Lead Gen Form',
    description: 'Landing page through thank-you page, for a form-based lead capture funnel (HubSpot / Webflow / Gravity Forms).',
    funnelName: 'Lead Gen Form',
    steps: [
      {
        order: 1,
        label: 'Landing Page View',
        urlPattern: `${DOMAIN_PLACEHOLDER}/`,
        trigger: { type: 'pageview', selector: null },
        hint: 'The landing page traffic arrives on.',
      },
      {
        order: 2,
        label: 'Form Started',
        urlPattern: `${DOMAIN_PLACEHOLDER}/`,
        trigger: { type: 'click', selector: '[data-cta="open-form"]' },
        selectorCandidates: ['[data-cta="open-form"]', '.hero-cta', 'a[href="#form"]'],
        hint: 'The button that reveals or scrolls to your lead form (e.g. "Get a Quote", "Request a Demo").',
      },
      {
        order: 3,
        label: 'Lead Form Submitted',
        urlPattern: `${DOMAIN_PLACEHOLDER}/`,
        trigger: { type: 'formSubmit', selector: 'form.hs-form' },
        selectorCandidates: ['form.hs-form', 'form[data-form-id]', 'form[id^="gform_"]'],
        formFields: ['email', 'name', 'phone'],
        hint: 'Your lead capture form. Matches common builders: HubSpot (form.hs-form), Webflow (form[data-form-id]), Gravity Forms (form[id^=gform_]).',
      },
      {
        order: 4,
        label: 'Thank You Page View',
        urlPattern: `${DOMAIN_PLACEHOLDER}/thank-you`,
        trigger: { type: 'pageview', selector: null },
        hint: 'Confirmation page after form submission. Adjust if you show an inline success message instead of redirecting.',
      },
    ],
  };

  window.FunnelTemplates = {
    DOMAIN_PLACEHOLDER,
    list: [SHOPIFY_CHECKOUT, SAAS_TRIAL_SIGNUP, LEAD_GEN_FORM],
  };
})();
