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

  // Shopify variant IDs for each piece and size.
  // Find one in Shopify admin: Products → open the product → click the size variant.
  // The variant ID is the long number at the end of the page address (…/variants/1234567890).
  // When a size has an ID, "Buy now" sends the customer straight to Shopify checkout.
  variants: {
    set:    { XS: '', S: '', M: '', L: '' },
    hoodie: { XS: '', S: '', M: '', L: '' },
    pants:  { XS: '', S: '', M: '', L: '' }
  },

  // Shoot photos pulled from the Dropbox folder. Pick them at /photos on the site,
  // then put each photo's name here (e.g. hero: 'IMG_3207'). Empty = striped placeholder.
  shoot: {
    hero: '', set: '', zipup: '', pants: '', macro: '',
    front: '', back: '', detail: '', onbody: '',
    wild1: '', wild2: '', wild3: ''
  },

  // Product page photos. Put the image files in the /images folder, then fill in each src,
  // e.g. src: '/images/set-front.jpg'. Empty src shows the striped placeholder.
  photos: [
    { label: 'Front',   note: 'Full set, front, clean background',      src: '', alt: 'The Volt Set, front' },
    { label: 'Back',    note: 'Full set, back, clean background',       src: '', alt: 'The Volt Set, back' },
    { label: 'Detail',  note: 'Rhinestone script up close, good light', src: '', alt: 'Rhinestone Miche script up close' },
    { label: 'On body', note: 'Fit check, full length',                 src: '', alt: 'The Volt Set worn, full length' }
  ],

  // Email signup: paste the form endpoint from an email tool (for example a Formspree form URL).
  // Leave empty until it's connected — the form will say signups aren't open yet.
  // The discount popup sends to this same endpoint: { email, phone, sms_consent, source }.
  signupEndpoint: '',

  // DISCOUNT POPUP
  // Preview it any time, without sending anything, by adding ?popup=wheel or ?popup=scratch
  // to the site address. Visitors only see it when enabled is true AND signupEndpoint is set.
  popup: {
    enabled: false,
    style: 'wheel',       // 'wheel' or 'scratch'
    delaySeconds: 6,      // how long after the page loads before it opens
    hideForDays: 3,       // after someone closes it, wait this long before opening it again

    // Every code here must also be created in Shopify: Discounts → Create discount → Amount off order / Free shipping.
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
