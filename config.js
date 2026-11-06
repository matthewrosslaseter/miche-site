/*
  MICHE SITE SETTINGS
  Edit this file to connect the site to the Shopify store and the email list.
  Nothing else needs code changes.
*/
window.MICHE_CONFIG = {
  // Prices shown everywhere on the site.
  prices: {
    set: '[SET PRICE]',
    hoodie: '[HOODIE PRICE]',
    pants: '[PANTS PRICE]'
  },

  // Shopify store address, without https:// — e.g. 'miche.myshopify.com'
  shopDomain: '',

  // Shopify variant IDs for each piece and size.
  // Find one in Shopify admin: Products → open the product → click the size variant.
  // The variant ID is the long number at the end of the page address (…/variants/1234567890).
  // When a size has an ID, "Buy now" sends the customer straight to Shopify checkout.
  variants: {
    set:    { S: '', M: '', L: '', XL: '', XXL: '' },
    hoodie: { S: '', M: '', L: '', XL: '', XXL: '' },
    pants:  { S: '', M: '', L: '', XL: '', XXL: '' }
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
  signupEndpoint: ''
};
