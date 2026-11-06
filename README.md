# Miche — Drop 001 site

Static site for the Volt Set: a home page (`index.html`) and a product page (`product.html`). No build step. Vercel serves the files as-is, and every push to `main` redeploys.

## Deploy on Vercel (one time)

1. Sign in at vercel.com with GitHub.
2. **Add New → Project**, pick `miche-site`, tap **Import**.
3. Leave the framework preset as **Other** and tap **Deploy**.

The site goes live at a `*.vercel.app` address. A custom domain can be added later under the project's **Domains** settings.

## Fill in before sharing

Anything in `[BRACKETS]` is a placeholder:

- `index.html` and `product.html`: drop date, free-shipping threshold, fabric, fit, founder story, shipping and return terms, contact email, social handles.
- `product.html`: the size chart measurements from the manufacturer spec sheet.
- `config.js`: prices (shown everywhere on the site).

## Photos

Put image files in `/images`.

- **Product page:** set each photo's `src` in `config.js` → `photos`, e.g. `'/images/set-front.jpg'`.
- **Home page and other spots:** each striped placeholder is a `<div class="ph …">`. Replace it with an image, keeping the ratio class, for example:
  `<img class="photo r-45" src="/images/hero.jpg" alt="Volt set on body">`

## Selling (connect Shopify)

This site doesn't take payments itself. "Buy now" sends the customer to Shopify checkout once `config.js` has:

- `shopDomain`: the store address, e.g. `miche.myshopify.com`
- `variants`: the Shopify variant ID for each piece and size

Until then, "Buy now" tells visitors checkout isn't open yet.

## Email signup

Paste a form endpoint from an email tool (for example a Formspree form URL) into `signupEndpoint` in `config.js`. Until then, the form tells visitors signups aren't open yet.
