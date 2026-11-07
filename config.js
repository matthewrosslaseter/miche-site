/*
  MICHE SITE SETTINGS
  Edit this file to connect the site to the Shopify store and the email list.
  Nothing else needs code changes.
*/
window.MICHE_CONFIG = {
  // Prices shown everywhere on the site.
  prices: {
    set: '$125',
    hoodie: '$65',
    pants: '$65'
  },

  // Shopify store address, without https:// — e.g. 'miche.myshopify.com'
  shopDomain: '',

  // Colorways. The build sorts every shoot photo into one of these by color.
  // swatch: leave '' to use the shade measured from the photos, or set a hex like '#EB93AD'.
  colorways: [
    { id: 'neon', name: 'Neon', swatch: '' },
    { id: 'pink', name: 'Pink', swatch: '' }
  ],

  // Fix a photo the build put in the wrong color: { IMG_3194: 'pink' }. Use 'none' to keep a photo off the product page.
  colorOverrides: {},

  // Shopify variant IDs for each color, piece and size.
  // Find one in Shopify admin: Products → open the product → click the size variant.
  // The variant ID is the long number at the end of the page address (…/variants/1234567890).
  // When a size has an ID, "Buy now" sends the customer straight to Shopify checkout.
  variants: {
    neon: {
      set:    { XS: '', S: '', M: '', L: '' },
      hoodie: { XS: '', S: '', M: '', L: '' },
      pants:  { XS: '', S: '', M: '', L: '' }
    },
    pink: {
      set:    { XS: '', S: '', M: '', L: '' },
      hoodie: { XS: '', S: '', M: '', L: '' },
      pants:  { XS: '', S: '', M: '', L: '' }
    }
  },

  // Shoot photos pulled from the Dropbox folder. Pick them at /photos on the site,
  // then put each photo's name here (e.g. hero: 'IMG_3207'). Empty = striped placeholder.
  shoot: {
    hero: 'IMG_3221', setNeon: 'IMG_3178', setPink: 'IMG_3212', zipup: 'IMG_3227', pants: 'IMG_3171', macro: 'IMG_3168',
    wild1: '', wild2: '', wild3: ''
  },

  // Product page photos for each color. These show first, then more photos of that color fill in
  // (up to galleryLimit). A photo only shows under its own color.
  colorPhotos: {
    neon: ['IMG_3161', 'IMG_3166', 'IMG_3176'],
    pink: ['IMG_3212', 'IMG_3217']
  },
  galleryLimit: 12,

  // Email signup: paste the form endpoint from an email tool (for example a Formspree form URL).
  // Leave empty until it's connected — the form will say signups aren't open yet.
  // The discount popup sends to this same endpoint: { email, phone, sms_consent, source }.
  signupEndpoint: '',

  // DISCOUNT POPUP
  // Preview it any time, without sending anything, by adding ?popup=wheel or ?popup=scratch
  // to the site address. When enabled, it opens for visitors after delaySeconds on the site.
  // Until signupEndpoint is set, emails and phone numbers are NOT saved anywhere.
  popup: {
    enabled: true,
    style: 'scratch',     // 'wheel' or 'scratch'
    delaySeconds: 10,     // seconds on the site before it opens
    hideForDays: 3,       // after someone closes it, wait this long before opening it again

    // Scratch card: what everyone reveals before entering email + phone. Create this code in Shopify too.
    scratchPrize: { label: '10% OFF', code: 'MICHE10' },

    // Wheel prizes. Every code here must also be created in Shopify: Discounts → Create discount → Amount off order / Free shipping.
    // weight = how often that prize comes up, relative to the others (they don't need to add to 100).
    prizes: [
      { label: '10% OFF',   code: 'MICHE10',  weight: 30 },
      { label: 'FREE SHIP', code: 'FREESHIP', weight: 10 },
      { label: '15% OFF',   code: 'MICHE15',  weight: 15 },
      { label: '10% OFF',   code: 'MICHE10',  weight: 30 },
      { label: '20% OFF',   code: 'MICHE20',  weight: 5 },
      { label: 'FREE SHIP', code: 'FREESHIP', weight: 10 }
    ],

    // Links shown in the text-message consent line.
    privacyUrl: '[PRIVACY POLICY URL]',
    termsUrl: '[TERMS URL]'
  }
};
