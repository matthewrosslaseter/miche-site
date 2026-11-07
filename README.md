# Miche — Drop 001 site

Site for the Miche Fitted Set (neon and pink): a home page (`index.html`), a product page (`product.html`) and a photo picker (`/photos`). Every push to `main` redeploys on Vercel. The build (`scripts/build.mjs`) pulls the shoot photos from Dropbox, shrinks them, and sorts each one into neon or pink.

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
  `<img class="photo r-45" src="/images/hero.jpg" alt="Fitted set on body">`

## Selling (connect Shopify)

This site doesn't take payments itself. "Buy now" sends the customer to Shopify checkout once `config.js` has:

- `shopDomain`: the store address, e.g. `miche.myshopify.com`
- `variants`: the Shopify variant ID for each piece and size

Until then, "Buy now" tells visitors checkout isn't open yet.

## Colors (neon and pink)

The product page has a button for each color in `config.js` → `colorways`. Tapping one shows only that color's photos.

- The build sorts every shoot photo by color automatically. If one lands in the wrong color, fix it at `/photos` (second menu under the photo) or in `config.js` → `colorOverrides`.
- `colorPhotos` sets which photos show first for each color; more photos of that color fill in up to `galleryLimit`.
- Shopify variant IDs are set per color in `variants`.

## Discount popup (spin the wheel / scratch card)

Visitors enter email + phone, agree to texts, then spin a wheel or scratch a card to reveal a discount code. The code is saved in their browser and added to Shopify checkout when they tap Buy now.

- **Preview any time** (nothing is sent or saved): add `?popup=wheel` or `?popup=scratch` to the site address.
- **Turn it on for visitors:** in `config.js` → `popup`, set `enabled: true`, pick `style: 'wheel'` or `'scratch'`, and set `signupEndpoint`. It stays off until both are set, so no one's info goes nowhere.
- **Prizes and odds:** edit `popup.prizes`. Each code must also exist in Shopify (Discounts → Create discount) or it won't work at checkout. `weight` controls how often each prize comes up.
- **Text-message consent:** the checkbox line covers the standard disclosures. Add real links for `privacyUrl` and `termsUrl`. The texting tool (Klaviyo, Postscript, Attentive, etc.) handles sending and STOP/HELP replies.
- The popup sends `{ email, phone, sms_consent, source, page }` as JSON to `signupEndpoint`.

## Email signup

Paste a form endpoint from an email tool (for example a Formspree form URL) into `signupEndpoint` in `config.js`. Until then, the form tells visitors signups aren't open yet.
