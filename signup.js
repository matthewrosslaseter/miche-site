/*
  Sends sign-ups to Klaviyo (email list + text messages).
  Uses Klaviyo's public "client subscriptions" API, which is made for websites:
  only the public key and list ID go in config.js, never a private key.
*/
(function () {
  'use strict';

  var C = window.MICHE_CONFIG || {};
  var K = C.klaviyo || {};
  var REVISION = '2026-07-15';

  function ready() {
    return !!(K.publicKey && K.listId);
  }

  function send(attributes, source) {
    var body = {
      data: {
        type: 'subscription',
        attributes: {
          custom_source: source,
          profile: { data: { type: 'profile', attributes: attributes } }
        },
        relationships: { list: { data: { type: 'list', id: K.listId } } }
      }
    };
    var base = String(K.apiBase || 'https://a.klaviyo.com').replace(/\/+$/, '');
    return fetch(base + '/client/subscriptions?company_id=' + encodeURIComponent(K.publicKey), {
      method: 'POST',
      headers: {
        'accept': 'application/vnd.api+json',
        'content-type': 'application/vnd.api+json',
        'revision': REVISION
      },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error('Klaviyo returned ' + res.status);
        err.status = res.status;
        throw err;
      }
      return res;
    });
  }

  /*
    opts: { email, phone (+1XXXXXXXXXX), sms (true when the visitor checked the texting box), source }
    Email always subscribes. The phone number subscribes to texts only when sms is true.
    If Klaviyo turns down the text part (for example, texting isn't set up in the account yet),
    the email sign-up is sent again on its own, with the phone number saved on the profile.
  */
  function subscribe(opts) {
    var source = opts.source || 'Website';
    var attrs = {
      email: opts.email,
      subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } },
      properties: { 'Signup page': window.location.pathname }
    };
    if (opts.phone && opts.sms) {
      attrs.phone_number = opts.phone;
      attrs.subscriptions.sms = { marketing: { consent: 'SUBSCRIBED' } };
    }
    return send(attrs, source).catch(function (err) {
      if (!(opts.phone && opts.sms) || !err.status || err.status >= 500) throw err;
      var emailOnly = {
        email: opts.email,
        subscriptions: { email: { marketing: { consent: 'SUBSCRIBED' } } },
        properties: {
          'Signup page': window.location.pathname,
          'Phone from popup': opts.phone,
          'Texting box checked at': new Date().toISOString()
        }
      };
      return send(emailOnly, source + ' (email only)');
    });
  }

  window.MicheSignup = { ready: ready, subscribe: subscribe };
})();
