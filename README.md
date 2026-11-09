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

## Discount popup (mystery discount scratch card)

Opens 10 seconds into a visit. Visitors scratch the card to reveal 10% off, then enter email + phone and check the texting box to get the code (MICHE10). The code is saved in their browser and added to Shopify checkout when they tap Buy now.

- **Preview any time** (nothing is sent or saved): add `?popup=scratch` or `?popup=wheel` to the site address.
- **Settings:** `config.js` → `popup` (style, delay, the scratch prize, wheel prizes). Every code must also exist in Shopify (Discounts → Create discount) or it won't work at checkout.

## Email + text sign-ups (Klaviyo)

The popup and the footer "Get the drop first" form send sign-ups to Klaviyo (`signup.js`). Email consent and text consent are recorded separately; texts only when the visitor checks the texting box.

1. Create a free Klaviyo account for Miche, then add texting: Settings → SMS → set up a US toll-free number and submit it for carrier approval. Use `https://miche-site.vercel.app/terms` and `/privacy` when it asks.
2. Create a list (for example "Website sign-ups") and set it to single opt-in.
3. Put the **public API key** (6 characters) and the **list ID** in `config.js` → `klaviyo`.
4. In Klaviyo, build a Welcome flow triggered by joining that list: an email and a text with the code MICHE10.

Until step 3 is done, nothing is saved: the popup still shows the code, and the footer form says sign-ups aren't open yet. If texting isn't approved yet, the email sign-up still goes through and the phone number is saved on the profile.
