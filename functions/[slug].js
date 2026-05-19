// /functions/[slug].js — path-based county directory pages
// e.g. /reeves-county-texas → loads directory:{slug}:data, config, ads from KV
import { loadDirectoryConfigFromKV, KV_KEYS } from './_lib.js';

/** SSR "/{slug}" — builds the full HTML page from KV with config, companies, and ads */
export const onRequestGet = async ({ request, env, params }) => {
  const slug = params?.slug;
  if (!slug || typeof slug !== 'string') {
    return html(404, '<!doctype html><h1>Not Found</h1><p>Directory not found.</p>');
  }

  const keys = KV_KEYS(slug);
  let config;
  try {
    config = await loadDirectoryConfigFromKV(env, slug);
  } catch (err) {
    return html(404, `<!doctype html><h1>Not Found</h1><p>No config for this directory.</p><pre>${escapeHtml(String(err))}</pre>`);
  }

  const [rawData, rawAds] = await Promise.all([
    env.DIRECTORIES_KV.get(keys.data),
    env.DIRECTORIES_KV.get(keys.ads),
  ]);

  if (!rawData) {
    return html(503, `<!doctype html><h1>No data yet</h1><p>Try refreshing the site data.</p>`);
  }

  const companies = JSON.parse(rawData);
  const ads = rawAds ? JSON.parse(rawAds) : [];

  // Filter out hidden companies (same logic as index.js)
  const visibleCompanies = companies.filter(row => {
    let plan = '';
    if (row.plan !== undefined && row.plan !== null) plan = String(row.plan).toLowerCase().trim();
    if (!plan && row.Plan !== undefined && row.Plan !== null) plan = String(row.Plan).toLowerCase().trim();
    const isHidden = plan === 'hidden' || plan === 'hide' || plan === 'h' ||
      row.hidden === true || row.hidden === 'true' || row.hidden === 'yes' ||
      row.hidden === 1 || row.hidden === 'hidden' || row.hidden === 'hide';
    return !isHidden;
  });

  const { groups, categoryOrder } = groupCompanies(visibleCompanies);

  // Resolve category order — prefer categoryOrder array from KV (set via Categories sheet),
  // fall back to category_order string from sites.json config
  let categoryNames;
  const existing = new Set(Object.keys(groups));
  if (Array.isArray(config.categoryOrder) && config.categoryOrder.length > 0) {
    categoryNames = config.categoryOrder.filter(c => existing.has(c));
    const remainder = Object.keys(groups).filter(c => !categoryNames.includes(c)).sort((a, b) => alpha(a, b));
    categoryNames = categoryNames.concat(remainder);
  } else {
    const categoryOrderConfig = (config.category_order || 'alpha').trim().toLowerCase();
    if (categoryOrderConfig === 'alpha') {
      categoryNames = Object.keys(groups).sort((a, b) => alpha(a, b));
    } else if (categoryOrderConfig && categoryOrderConfig !== '') {
      const customOrder = categoryOrderConfig.split(',').map(c => c.trim()).filter(Boolean);
      categoryNames = customOrder.filter(c => existing.has(c));
      const remainder = Object.keys(groups).filter(c => !categoryNames.includes(c)).sort((a, b) => alpha(a, b));
      categoryNames = categoryNames.concat(remainder);
    } else {
      categoryNames = categoryOrder.length > 0 ? categoryOrder : Object.keys(groups);
    }
  }

  const { display_label, seo, page_title, return_url, directory_intro } = config;

  // Base URL from request origin (e.g. https://directory.mineralrightsforum.com)
  const origin = new URL(request.url).origin;
  const pageUrl = `${origin}/${slug}`;

  // Extract advertiser names for GTM tracking
  const advertiserNames = visibleCompanies.map(row => row.name).filter(n => n && n.trim()).map(n => n.trim());
  const advertiserWebsiteUrls = visibleCompanies.map(row => row.website_url).filter(u => u && u.trim()).map(u => u.trim());
  const getUtmAdv = (url) => {
    if (!url || !url.trim()) return '';
    const match = String(url).trim().match(/[?&]utm_adv=([^&]*)/);
    if (match) {
      try { return decodeURIComponent(match[1]); } catch (e) { return match[1]; }
    }
    try { return new URL(url).searchParams.get('utm_adv') || ''; } catch (e) { return ''; }
  };
  const advertiserUtmAdvValues = visibleCompanies
    .map(row => { const u = getUtmAdv(row.website_url || ''); return u && u.trim() ? u.trim() : ''; })
    .filter(u => u);

  // Schema.org type by category
  function getSchemaTypeForCategory(category) {
    if (!category) return null;
    const catLower = String(category).toLowerCase().trim();
    if (catLower.includes('accounting')) return { '@type': 'AccountingService' };
    if (catLower.includes('legal') || catLower.includes('attorney') || catLower.includes('lawyer') || catLower.includes('law')) return { '@type': 'LegalService' };
    if (catLower.includes('software')) return { '@type': 'Organization', knowsAbout: 'Software solutions' };
    if (catLower.includes('mineral') && catLower.includes('buyer')) return { '@type': 'ProfessionalService', knowsAbout: ['Mineral acquisition', 'Oil and gas royalties', 'Mineral buying'] };
    if (catLower.includes('mineral') && (catLower.includes('manager') || catLower.includes('management'))) return { '@type': 'ProfessionalService', knowsAbout: ['Mineral rights', 'Royalty management', 'Mineral management'] };
    if (catLower.includes('land') || catLower.includes('title')) return { '@type': 'ProfessionalService', knowsAbout: ['Title research', 'Land records', 'Land and title services'] };
    return null;
  }

  const itemListElements = visibleCompanies
    .map((row, idx) => {
      const name = row.name || '';
      if (!name) return null;
      const categorySchema = getSchemaTypeForCategory(row.category);
      const business = {
        '@type': categorySchema?.['@type'] || 'Organization',
        '@id': `#company-${idx}`,
        additionalType: 'https://schema.org/Company',
        name
      };
      if (categorySchema?.knowsAbout) business.knowsAbout = categorySchema.knowsAbout;
      if (row.website_url) business.url = row.website_url;
      if (row.description_short) business.description = row.description_short;
      if (row.logo_url) business.image = row.logo_url;
      if (row.contact_phone) business.telephone = row.contact_phone;
      if (row.contact_email) business.email = row.contact_email;
      if (display_label) business.areaServed = display_label;
      return { '@type': 'ListItem', position: idx + 1, item: business };
    })
    .filter(Boolean);

  const schemaObject = {
    '@context': 'https://schema.org',
    '@type': ['WebPage', 'CollectionPage'],
    name: seo?.title || 'Directory',
    url: pageUrl,
    description: seo?.description || '',
    mainEntity: { '@type': 'ItemList', itemListElement: itemListElements }
  };
  const schemaJson = JSON.stringify(schemaObject).replace(/</g, '\\u003c');

  const navItems = categoryNames.map(c => `<a href="#cat-${idSlug(c)}" class="px-3 py-1 rounded-lg hover:bg-gray-100">${escapeHtml(c)}</a>`).join('');

  // For each category: filter ads by category, sort by priority desc, prepend ad card if one matches
  function getAdForCategory(cat) {
    const catLower = (cat || '').toLowerCase().trim();
    const matching = ads.filter(ad => (String(ad.category || '').toLowerCase().trim()) === catLower);
    matching.sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0));
    return matching[0] || null;
  }

  function renderAdCard(ad) {
    const unitPath = ad && String(ad.ad_unit || '').trim();
    if (unitPath) {
      const divId = `gpt-${idSlug(ad.category || 'ad')}`;
      return `<div id="${escapeAttr(divId)}" class="card card--ad card--gam"><script>googletag.cmd.push(function(){googletag.defineSlot('${escapeAttr(unitPath)}',[300,250],'${escapeAttr(divId)}').addService(googletag.pubads());googletag.pubads().enableSingleRequest();googletag.enableServices();googletag.display('${escapeAttr(divId)}');});<\/script></div>`;
    }
    if (!ad || !ad.link || !ad.image_url) return '';
    return `<a href="${escapeAttr(ad.link)}" target="_blank" rel="noopener" class="card card--ad"><img src="${escapeAttr(ad.image_url)}" alt="Sponsored" loading="lazy" /></a>`;
  }

  const emptyCTA = /* html */`
    <section class="empty-cta" aria-labelledby="empty-cta-heading">
      <div class="empty-cta__pitch">
        <p class="empty-cta__label">Directory Listing</p>
        <h2 id="empty-cta-heading" class="empty-cta__headline">Be listed in ${escapeHtml(display_label)}.</h2>
        <hr class="empty-cta__rule" />
        <p class="empty-cta__copy">No mineral rights professionals currently appear on this page. Submit your details and you'll be the first name mineral owners see when they search ${escapeHtml(display_label)}.</p>
      </div>
      <div class="empty-cta__form" aria-label="Advertiser application form">
        <div id="zf_div_RChJcXXgYTZYdZp3lQq3ZB_oH8emU71Sbxki1qpu1Yc"></div>
        <script type="text/javascript">
        (function() {
            try{
                var f = document.createElement("iframe");
                var ifrmSrc = 'https://forms.zohopublic.com/kedinterestsllc/form/MRFCountyDirectoryPageListingInquiry/formperma/RChJcXXgYTZYdZp3lQq3ZB_oH8emU71Sbxki1qpu1Yc?zf_rszfm=1';
                try{
                    if ( typeof ZFAdvLead != "undefined" && typeof zfutm_zfAdvLead != "undefined" ) {
                        for( var prmIdx = 0 ; prmIdx < ZFAdvLead.utmPNameArr.length ; prmIdx ++ ) {
                            var utmPm = ZFAdvLead.utmPNameArr[ prmIdx ];
                            utmPm = ( ZFAdvLead.isSameDomian && ( ZFAdvLead.utmcustPNameArr.indexOf(utmPm) == -1 ) ) ? "zf_" + utmPm : utmPm;
                            var utmVal = zfutm_zfAdvLead.zfautm_gC_enc( ZFAdvLead.utmPNameArr[ prmIdx ] );
                            if ( typeof utmVal !== "undefined" ) {
                              if ( utmVal != "" ) {
                                if(ifrmSrc.indexOf('?') > 0){
                                     ifrmSrc = ifrmSrc+'&'+utmPm+'='+utmVal;
                                }else{
                                    ifrmSrc = ifrmSrc+'?'+utmPm+'='+utmVal;
                                }
                              }
                            }
                        }
                    }
                    if ( typeof ZFLead !== "undefined" && typeof zfutm_zfLead !== "undefined" ) {
                        for( var prmIdx = 0 ; prmIdx < ZFLead.utmPNameArr.length ; prmIdx ++ ) {
                            var utmPm = ZFLead.utmPNameArr[ prmIdx ];
                            var utmVal = zfutm_zfLead.zfutm_gC_enc( ZFLead.utmPNameArr[ prmIdx ] );
                            if ( typeof utmVal !== "undefined" ) {
                              if ( utmVal != "" ){
                                if(ifrmSrc.indexOf('?') > 0){
                                  ifrmSrc = ifrmSrc+'&'+utmPm+'='+utmVal;
                                }else{
                                  ifrmSrc = ifrmSrc+'?'+utmPm+'='+utmVal;
                                }
                              }
                            }
                          }
                    }
                }catch(e){}
                f.src = ifrmSrc;
                f.style.border="none";
                f.style.height="1751px";
                f.style.width="90%";
                f.style.transition="all 0.5s ease";
                f.setAttribute("aria-label", 'MRF \\- County Directory Page Listing Inquiry');
                var d = document.getElementById("zf_div_RChJcXXgYTZYdZp3lQq3ZB_oH8emU71Sbxki1qpu1Yc");
                d.appendChild(f);
                window.addEventListener('message', function (){
                    var evntData = event.data;
                    if( evntData && evntData.constructor == String ){
                        var zf_ifrm_data = evntData.split("|");
                        if ( zf_ifrm_data.length == 2 || zf_ifrm_data.length == 3 ) {
                            var zf_perma = zf_ifrm_data[0];
                            var zf_ifrm_ht_nw = ( parseInt(zf_ifrm_data[1], 10) + 15 ) + "px";
                            var iframe = document.getElementById("zf_div_RChJcXXgYTZYdZp3lQq3ZB_oH8emU71Sbxki1qpu1Yc").getElementsByTagName("iframe")[0];
                            if ( (iframe.src).indexOf('formperma') > 0 && (iframe.src).indexOf(zf_perma) > 0 ) {
                                var prevIframeHeight = iframe.style.height;
                                var zf_tout = false;
                                if( zf_ifrm_data.length == 3 ) {
                                    iframe.scrollIntoView();
                                    zf_tout = true;
                                }
                                if ( prevIframeHeight != zf_ifrm_ht_nw ) {
                                    if( zf_tout ) {
                                        setTimeout(function(){
                                            iframe.style.height = zf_ifrm_ht_nw;
                                        },500);
                                    } else {
                                        iframe.style.height = zf_ifrm_ht_nw;
                                    }
                                }
                            }
                        }
                    }
                }, false);
            }catch(e){}
        })();
        </script>
      </div>
    </section>
  `;

  const sections = categoryNames.map(cat => {
    const { premium, free } = groups[cat];
    const all = premium.concat(free);
    const companyCards = all.map(row => renderCard(row)).join('');
    const ad = getAdForCategory(cat);
    const adCard = renderAdCard(ad);
    const cards = adCard + companyCards;
    return `
      <section id="cat-${idSlug(cat)}" class="scroll-mt-0">
        <h2 class="sticky top-0 z-20 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 px-2 py-2 text-xl font-semibold border-b"
            data-category="${escapeHtml(cat)}">${escapeHtml(cat)}</h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 py-4" data-category-grid="${escapeHtml(cat)}">
          ${cards}
        </div>
      </section>
    `;
  }).join('');

  return html(200, /* html */`<!doctype html>
<html lang="en">
  <head>
  <link rel="icon" type="image/png" sizes="48x48" href="https://www.mineralrightsforum.com/uploads/db5755/optimized/2X/5/53c419e5d847ede71cf80a938cf0156350637c44_2_32x32.png">
  <meta charset="utf-8">
  <link rel="canonical" href="${escapeAttr(pageUrl)}">
  <title>${escapeHtml(seo?.title || 'Directory')}</title>
  <meta property="og:title" content="${escapeHtml(seo?.title || 'Directory')}">
  <meta property="og:description" content="${escapeHtml(seo?.description || '')}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeAttr(pageUrl)}">
  <meta property="og:image" content="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg">
  <meta property="og:site_name" content="Mineral Rights Forum">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="description" content="${escapeHtml(seo?.description || '')}">
  <meta name="robots" content="${visibleCompanies.length === 0 ? 'noindex, nofollow' : 'index, follow'}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://static.mineralrightsforum.com" crossorigin>
  <link rel="stylesheet" href="/styles.css?v=202604212140" media="all">
  <link rel="stylesheet" href="https://static.mineralrightsforum.com/styles.css" media="all" crossorigin="anonymous">
  <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
  new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
  j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
  'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
  })(window,document,'script','dataLayer','GTM-M6JQPF');</script>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-JH90NMTGP0"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-JH90NMTGP0');
  </script>
  <script async src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"></script>
  <script>window.googletag = window.googletag || {cmd: []};</script>
  <script>
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      'event': 'directory_page_view',
      'directory_advertiser_names': ${JSON.stringify(advertiserNames)},
      'directory_advertiser_names_string': ${JSON.stringify(advertiserNames.join(', '))},
      'directory_advertiser_count': ${advertiserNames.length},
      'directory_advertiser_website_urls': ${JSON.stringify(advertiserWebsiteUrls.join(', '))}
    });
    const pagePath = window.location.pathname || '/';
    const advertiserUtmAdvValues = ${JSON.stringify(advertiserUtmAdvValues)} || [];
    if (Array.isArray(advertiserUtmAdvValues)) {
      advertiserUtmAdvValues.forEach((utmAdv) => {
        if (utmAdv && typeof utmAdv === 'string' && utmAdv.trim()) {
          window.dataLayer.push({
            'event': 'directory_advertiser_present',
            'directory_advertiser_name': utmAdv.trim(),
            'directory_page_path': pagePath,
            'directory_advertiser_count': ${advertiserNames.length}
          });
        }
      });
    }
  </script>
  <script type="application/ld+json">${schemaJson}</script>
  <style>
    :root{ --sticky-offset: 300px; --sticky-bar-height: 64px; --mrf-primary: #111827; --mrf-primary-700: #0f172a; --mrf-text-on-primary: #ffffff; --mrf-outline: #e5e7eb; --mrf-border: #e5e7eb; --mrf-subtle: #6b7280; --mrf-accent: #f59e0b; --mrf-accent-600: #d97706; }
    html{ scroll-behavior:smooth; }
    html, body { width: 100%; overflow-x: hidden; max-width: 100vw; }
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111;line-height:1.5}
    .site-wrapper, .page, .content, footer, header { max-width: 100%; overflow-x: hidden; }
    main, .container { max-width: 100%; }
    * { box-sizing: border-box; }
    img, video, iframe, embed, object { max-width: 100%; height: auto; }
    .container{max-width:1280px;margin:0 auto;padding:1rem}
    .shadow-soft{box-shadow:0 1px 2px rgba(0,0,0,.05),0 1px 3px rgba(0,0,0,.1)}
    .hidden{display:none !important}
    .header-back-btn{ display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.625rem 1.25rem; font-size: 0.9375rem; font-weight: 500; color: #ffffff; background: #23456D; border: none; border-radius: 0.5rem; cursor: pointer; transition: all 0.2s ease; white-space: nowrap; }
    .header-back-btn:hover{ background: #1a3454; transform: translateY(-1px); box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2); }
    .card--ad { display: block; border: 1px solid var(--mrf-border); border-radius: 0.5rem; overflow: hidden; }
    .card--ad img { width: 100%; height: auto; display: block; }
    .card--gam { min-width: 300px; min-height: 250px; display: flex; align-items: center; justify-content: center; background: #f9fafb; }
    @media (max-width: 767px){
      .directory-hero { padding: 28px 16px 24px; }
      :root{ --sticky-bar-height: 45px; }
      section h2.sticky{ top: 60px !important; }
    }
    /* ── Tips card (static module) ─────────────────────────────────── */
    .tips-card{ background:#fff; border:1px solid var(--mrf-border); border-radius:var(--card-radius); box-shadow:var(--shadow-soft); max-width:1200px; margin:2.5rem auto 0; padding:2rem 2.5rem; cursor:default; }
    .tips-card-header{ display:none !important; }
    .tips-card-content{ display:block !important; padding:0 !important; border:none !important; }
    .tips-card-content ul{ display:none !important; }
    .tips-card__meta{ margin-bottom:1.5rem; }
    .tips-card__eyebrow{ color:var(--accent-gold); text-transform:uppercase; letter-spacing:.22em; font-size:.72rem; font-weight:600; display:block; margin-bottom:.5rem; }
    .tips-card__title{ display:flex; align-items:center; gap:.625rem; font-size:1.125rem; font-weight:700; color:var(--mrf-ink); margin:0; padding:0; border:none; }
    .tips-card__grid{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(auto-fill,minmax(270px,1fr)); gap:.875rem; }
    .tips-card__item{ display:flex; flex-direction:column; gap:.3rem; padding:1.1rem 1.25rem; background:#fafbfc; border:1px solid var(--mrf-border); border-radius:10px; }
    .tips-card__num{ font-size:.65rem; font-weight:700; letter-spacing:.1em; color:var(--accent-gold); }
    .tips-card__item strong{ color:var(--mrf-ink); font-weight:700; font-size:.875rem; line-height:1.3; }
    .tips-card__item span{ color:var(--mrf-subtle); line-height:1.5; font-size:.875rem; }
    /* ── CTA blocks ─────────────────────────────────────────────────── */
    .cta-blocks-container{ display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; margin:2rem auto 2rem; max-width:1200px; }
    .cta-block-card{ background:linear-gradient(145deg,#0a192f 0%,#0e2040 100%); border:1px solid rgba(197,160,89,.2); border-radius:var(--card-radius); padding:2.25rem 2rem; color:#f8f9fa; display:flex; flex-direction:column; gap:.875rem; }
    .cta-block-card__icon{ width:48px; height:48px; background:rgba(197,160,89,.1); border:1px solid rgba(197,160,89,.25); border-radius:12px; display:flex; align-items:center; justify-content:center; color:var(--accent-gold); flex-shrink:0; }
    .cta-block-card__eyebrow{ color:var(--accent-gold); text-transform:uppercase; letter-spacing:.22em; font-size:.72rem; font-weight:600; }
    .cta-block-card__heading{ font-family:'Playfair Display',serif; font-size:1.375rem; font-weight:700; color:#fff; line-height:1.2; margin:0; }
    .cta-block-card__body{ font-size:.9375rem; color:rgba(248,249,250,.72); line-height:1.6; margin:0; flex:1; }
    .cta-block-card__body a{ color:var(--accent-gold); text-decoration:underline; text-underline-offset:2px; }
    .cta-block-card__btn{ display:inline-flex; align-items:center; gap:.5rem; padding:.75rem 1.5rem; background:var(--accent-gold); color:#0a192f; font-weight:700; font-size:.9375rem; border:none; border-radius:.65rem; text-decoration:none; cursor:pointer; transition:background .18s ease,transform .18s ease; width:fit-content; margin-top:.5rem; font-family:inherit; }
    .cta-block-card__btn:hover{ background:#d4aa33; transform:translateY(-1px); }
    @media (max-width:767px){ .cta-blocks-container{ grid-template-columns:1fr; } .tips-card{ padding:1.5rem 1.25rem; } .tips-card__grid{ grid-template-columns:1fr; } }
  </style>
</head>
<body class="bg-white">

  <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M6JQPF" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>

  <header class="z-10 bg-white shadow-xl">
    <div class="bg-white max-w-7xl mx-auto px-4 sm:px-6 py-3 border-b border-gray-200">
      <div class="flex items-center justify-center md:justify-between">
        <a href="https://www.mineralrightsforum.com" class="block w-fit">
          <img src="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg" alt="Mineral Rights Forum Logo" class="h-12 w-auto rounded-lg" onerror="this.onerror=null;this.src='https://placehold.co/150x40/d1d5db/4b5563?text=MRF+Logo'">
        </a>
        <a href="${escapeAttr(return_url || 'https://www.mineralrightsforum.com')}" class="header-back-btn" style="display: none;" id="returnBtn">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          <span>Back to Forum</span>
        </a>
      </div>
    </div>
  </header>

  <section class="directory-hero">
    <div class="container">
      <span class="accent-label">Mineral Rights Forum Directory</span>
      <h1>${escapeHtml(display_label)}</h1>
      <p class="subtitle">${escapeHtml(directory_intro || 'Search the most trusted network of mineral attorneys, buyers, and management specialists.')}</p>

      ${visibleCompanies.length === 0 ? '' : `<div class="hero-footer">
        <label class="featured-toggle">
          <div class="switch">
            <input id="onlyPremium" type="checkbox">
            <span class="slider"></span>
          </div>
          <span>Show Featured Professionals Only</span>
        </label>
        <div class="stats-mini">
          <strong>${visibleCompanies.length}</strong> Active Listings
        </div>
      </div>`}
    </div>
  </section>

  <main class="container">
    ${visibleCompanies.length === 0 ? emptyCTA : sections}

    ${visibleCompanies.length === 0 ? '' : `<div class="tips-card">
      <div class="tips-card__meta">
        <span class="tips-card__eyebrow">Due Diligence</span>
        <h2 class="tips-card__title">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;color:var(--accent-gold)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Tips for Choosing a Professional
        </h2>
      </div>
      <ul class="tips-card__grid">
        <li class="tips-card__item"><span class="tips-card__num">01</span><strong>Review credentials &amp; licenses</strong><span>Ensure a vendor is properly licensed and/or certified in their field.</span></li>
        <li class="tips-card__item"><span class="tips-card__num">02</span><strong>Ask about area experience</strong><span>Inquire specifically about experience in the state(s) where your minerals are located.</span></li>
        <li class="tips-card__item"><span class="tips-card__num">03</span><strong>Request references</strong><span>Ask for references from previous clients.</span></li>
        <li class="tips-card__item"><span class="tips-card__num">04</span><strong>Understand fee structures</strong><span>Get clear information upfront about fee structure.</span></li>
        <li class="tips-card__item"><span class="tips-card__num">05</span><strong>Gather your paperwork</strong><span>Don't forget info you may have from relatives also.</span></li>
        <li class="tips-card__item"><span class="tips-card__num">06</span><strong>Consider specialization</strong><span>Look for pros who specialize in your specific needs.</span></li>
      </ul>
    </div>

    <div class="cta-blocks-container">
      <div class="cta-block-card">
        <div class="cta-block-card__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
        </div>
        <span class="cta-block-card__eyebrow">Find Local Experts</span>
        <h3 class="cta-block-card__heading">Looking for Localized Expertise?</h3>
        <p class="cta-block-card__body">Browse our county-specific directories to find mineral attorneys, buyers, and management professionals in your area.</p>
        <a href="${escapeAttr(origin + '/')}" class="cta-block-card__btn">Browse County Directories</a>
      </div>
      <div class="cta-block-card">
        <div class="cta-block-card__icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        </div>
        <span class="cta-block-card__eyebrow">Get Listed</span>
        <h3 class="cta-block-card__heading">Reach Mineral Owners in Your Area</h3>
        <p class="cta-block-card__body">We offer paid <a href="${escapeAttr(origin + '/')}">county-specific</a> and <a href="${escapeAttr(origin + '/mineral-services-directory')}">nationwide</a> directory listings for qualified mineral professionals. Limitations apply.</p>
        <button id="applyForListingBtn" class="cta-block-card__btn">Apply for Listing</button>
      </div>
    </div>`}
  </main>

  <footer style="background:var(--mrf-primary);color:#f9fafb;padding:2.5rem 0;margin-top:3rem;">
    <div class="container">
      <div style="display:flex;flex-wrap:wrap;gap:2rem;justify-content:space-between;align-items:flex-start;">
        <div><h3 style="font-size:1.125rem;font-weight:700;color:#f9fafb;margin:0 0 0.5rem 0;">The Mineral Rights Forum</h3><p style="font-size:0.875rem;color:#d1d5db;margin:0;">&copy; ${new Date().getFullYear()} All Rights Reserved</p></div>
        <div style="display:flex;flex-wrap:wrap;gap:1.5rem;list-style:none;margin:0;padding:0;"><li><a href="https://www.mineralrightsforum.com" style="color:#e5e7eb;text-decoration:none;">Home</a></li><li><a href="https://www.mineralrightsforum.com/about" style="color:#e5e7eb;text-decoration:none;">About</a></li><li><a href="https://www.mineralrightsforum.com/privacy" style="color:#e5e7eb;text-decoration:none;">Privacy</a></li><li><a href="https://www.mineralrightsforum.com/tos" style="color:#e5e7eb;text-decoration:none;">TOS</a></li><li><a href="https://www.mineralrightsforum.com/t/advertise-with-us-to-reach-mineral-owners/24986" style="color:#e5e7eb;text-decoration:none;">Advertise</a></li></div>
      </div>
    </div>
  </footer>

  <div id="applyModal" class="hidden fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" data-close-apply="1"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-[min(95vw,48rem)] max-h-[90vh] overflow-y-auto shadow-soft">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Apply for Listing</h3>
        <button class="close-icon-btn" data-close-apply="1" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
      <iframe aria-label="MRF Advertiser Questionnaire" frameborder="0" style="height:500px;width:99%;border:none;" src="https://forms.zohopublic.com/kedinterestsllc/form/MRFAdvertiserQuestionnaire/formperma/fqHZoswuV-fPl--7JzxywtBbJ6WhWoQx5PkXRVrqBoI"></iframe>
    </div>
  </div>

  <script>
  document.addEventListener('DOMContentLoaded', () => {
    const q = document.getElementById('q');
    const onlyPremium = document.getElementById('onlyPremium');
    const returnBtn = document.getElementById('returnBtn');
    function toggleReturnButton() {
      if (returnBtn) returnBtn.style.display = window.matchMedia('(min-width: 768px)').matches ? 'inline-flex' : 'none';
    }
    toggleReturnButton();
    window.addEventListener('resize', toggleReturnButton);
    function debounce(fn, ms){ let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; }
    function normalize(s){ return (s||'').toLowerCase(); }
    function applyFilter(){
      const term = normalize(q?.value || '');
      const premiumOnly = !!onlyPremium?.checked;
      document.querySelectorAll('article[data-card]').forEach(el=>{
        const name = (el.getAttribute('data-name')||'');
        const desc = (el.getAttribute('data-desc')||'');
        const category = (el.getAttribute('data-category')||'').toLowerCase();
        const plan = (el.getAttribute('data-plan')||'').toLowerCase();
        const textOk = !term || name.includes(term) || desc.includes(term) || category.includes(term);
        const premOk = !premiumOnly || plan === 'premium';
        el.classList.toggle('hidden', !(textOk && premOk));
      });
      document.querySelectorAll('section[id^="cat-"]').forEach(sec=>{
        const grid = sec.querySelector('[data-category-grid]');
        const hasVisible = !!grid && Array.from(grid.querySelectorAll('article')).some(a => !a.classList.contains('hidden'));
        sec.classList.toggle('hidden', !hasVisible);
      });
    }
    window.applyFilter = applyFilter;
    q?.addEventListener('input', debounce(applyFilter, 120));
    onlyPremium?.addEventListener('change', applyFilter);
    applyFilter();
    const stickyNav = document.getElementById('stickyNav');
    if (stickyNav) stickyNav.addEventListener('click', (e)=>{
      const a = e.target.closest('a[href^="#cat-"]');
      if(!a) return;
      e.preventDefault();
      document.getElementById(a.getAttribute('href').slice(1))?.scrollIntoView({ behavior:'smooth', block:'start' });
    });
    window.addEventListener('scroll', () => {
      const nav = document.getElementById('stickyNav');
      if (nav) {
        if (window.pageYOffset > 300) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
      }
    });
    const applyModal = document.getElementById('applyModal');
    const applyBtn = document.getElementById('applyForListingBtn');
    applyModal?.addEventListener('click', (e)=>{ if(e.target.closest('[data-close-apply]')) applyModal.classList.add('hidden'); });
    applyBtn?.addEventListener('click', ()=>{ applyModal?.classList.remove('hidden'); });
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') applyModal?.classList.add('hidden'); });
  });
  </script>
  <dialog id="claimModal" style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1), 0 10px 40px rgba(0,0,0,0.2); max-width: 90%; width: 100%; max-height: 95vh; padding: 0;">
    <div style="display: flex; flex-direction: column; height: 100%; max-height: 95vh;">
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border-bottom: 1px solid #e6e7ea;">
        <h2 style="margin: 0; font-size: 1.25rem;">Claim Your Listing</h2>
        <button onclick="document.getElementById('claimModal').close()" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #6b7280;">×</button>
      </div>
      <div style="overflow-y: auto; flex: 1; padding: 1rem;">
        <iframe aria-label='Claim Your Listing' frameborder="0" style="height:600px;width:100%;border:none;" src='https://forms.zohopublic.com/kedinterestsllc/form/ClaimYourListing/formperma/G7tHYAIjid3cMjwP_19QjteyCECBIQYmu-mBBaYUl1s'></iframe>
      </div>
    </div>
  </dialog>
  <style>
    dialog#claimModal::backdrop {
      background-color: rgba(0, 0, 0, 0.5);
    }
  </style>
</body>
</html>
`);

  // -------- helpers --------
  function renderCard(row) {
    const isPremium = (row.plan || '').toLowerCase() === 'premium';
    const name = row.name || '';
    const desc = row.description_short || '';
    const cat = row.category || '';
    const tagline = row.tagline || cat;
    const logo = row.logo_url || '';
    const website = row.website_url || '';
    const email = row.contact_email || '';
    const { tel, display } = normPhone(row.contact_phone || '');
    const claimedVal = String(row['claimed?'] || '').toLowerCase().trim();
    const isClaimed = claimedVal !== 'false' && claimedVal !== '';
    const nameLower = name.toLowerCase();
    const isPlaceholder = (nameLower.includes('your') && nameLower.includes('company') && nameLower.includes('featured')) || nameLower.includes('company featured here');
    const base = 'card flex flex-col gap-3';
    const logoImg = (isPremium && logo)
      ? `<img src="${escapeAttr(logo)}" alt="" class="w-12 h-12 rounded object-contain bg-white border" loading="lazy" width="48" height="48">`
      : `<div class="w-12 h-12 rounded bg-black text-white flex items-center justify-center text-sm font-semibold">${firstInitial(name)}</div>`;
    const visitBtn = website ? `<a href="${escapeAttr(website)}" target="_blank" rel="noopener" class="btn btn-outline btn_website w-full justify-center" aria-label="Visit website for ${escapeAttr(name)}">Visit website</a>` : '';
    const hasEmail = !!(isPremium && email);
    const hasCall = !!(isPremium && tel);
    const emailBtn = hasEmail ? `<a href="mailto:${escapeAttr(email)}" class="btn btn-outline btn_email w-full justify-center ${!hasCall ? 'col-span-2' : ''}" data-company="${escapeAttr(name)}" data-category="${escapeAttr(cat)}" aria-label="Email ${escapeAttr(name)}">Email us</a>` : '';
    const callBtn = hasCall ? `<a class="btn btn-primary btn_call w-full justify-center ${!hasEmail ? 'col-span-2' : ''}" href="tel:${escapeAttr(tel)}" data-callnow="1" data-company="${escapeAttr(name)}" data-category="${escapeAttr(cat)}" data-tel="${escapeAttr(tel)}" data-display="${escapeAttr(display)}" aria-label="Call ${escapeAttr(name)} now"><span>Call now</span></a>` : '';
    const claimBtn = !isClaimed ? `<button class="btn btn-outline w-full justify-center claim-btn-glow" onclick="sessionStorage.setItem('claimSourcePage', window.location.href); document.getElementById('claimModal').showModal()" style="flex-direction: column; gap: 0.25rem; background: inherit; border: inherit; color: inherit; font-family: inherit; cursor: pointer;"><div style="font-weight: bold; font-size: 1.1em;">Is this your business?</div><div style="font-style: italic; font-weight: 400;">Claim it free and start getting found</div></button>` : '';
    const ctas = !isClaimed
      ? `<div class="mt-auto">${claimBtn}</div>`
      : isPremium
      ? `<div class="mt-auto flex flex-col gap-2"><div class="grid grid-cols-2 gap-2">${emailBtn}${callBtn}</div><div>${visitBtn || ''}</div></div>`
      : `<div class="mt-auto">${visitBtn || ''}</div>`;
    return `
      <article class="${base} ${isPremium ? 'card--premium' : ''} ${isPlaceholder ? 'card--placeholder' : ''}" data-card="1"
               data-name="${escapeAttr(name.toLowerCase())}"
               data-desc="${escapeAttr(desc.toLowerCase())}"
               data-category="${escapeAttr(cat.toLowerCase())}"
               data-plan="${isPremium ? 'premium' : 'free'}">
        ${isPremium ? '<div class="ribbon">FEATURED</div>' : ''}
        <div class="flex items-center gap-3">
          ${logoImg}
          <div class="min-w-0">
            <div class="flex items-center gap-2"><h3 class="font-semibold text-base leading-tight">${escapeHtml(name)}</h3></div>
            <p class="category truncate">${escapeHtml(tagline)}</p>
          </div>
        </div>
        <p class="desc">${escapeHtml(desc)}</p>
        ${isPlaceholder ? `<div class="mt-auto"><a href="#applyModal" class="btn btn-primary w-full justify-center placeholder-cta-btn">Apply for Listing</a></div>` : ctas}
      </article>
    `;
  }

  function groupCompanies(rows) {
    const byCat = {};
    const categoryOrder = [];
    for (const row of rows) {
      let plan = '';
      if (row.plan !== undefined && row.plan !== null) plan = String(row.plan).toLowerCase().trim();
      if (!plan && row.Plan !== undefined && row.Plan !== null) plan = String(row.Plan).toLowerCase().trim();
      const isHidden = plan === 'hidden' || plan === 'hide' || plan === 'h' || row.hidden === true || row.hidden === 'true' || row.hidden === 'yes' || row.hidden === 1 || row.hidden === 'hidden' || row.hidden === 'hide';
      if (isHidden) continue;
      const cat = (row.category || '').trim() || 'Other';
      if (!byCat[cat]) { byCat[cat] = { premium: [], free: [] }; categoryOrder.push(cat); }
      const bucket = plan === 'premium' ? 'premium' : 'free';
      byCat[cat][bucket].push(row);
    }
    for (const c of Object.keys(byCat)) {
      byCat[c].premium.sort((a, b) => alpha(a.name, b.name));
      byCat[c].free.sort((a, b) => alpha(a.name, b.name));
    }
    return { groups: byCat, categoryOrder };
  }

  function alpha(a, b) { a = (a || '').toLowerCase(); b = (b || '').toLowerCase(); return a < b ? -1 : a > b ? 1 : 0; }
  function idSlug(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
  function firstInitial(s) { const m = String(s || '').match(/[A-Za-z0-9]/); return m ? m[0].toUpperCase() : '?'; }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
  function escapeAttr(s) { return escapeHtml(s).replace(/"/g, '&quot;'); }
  function normPhone(raw) {
    const digits = String(raw || '').replace(/\D/g, '');
    let d = digits;
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    if (d.length !== 10) return { tel: null, display: raw || '' };
    return { tel: '+1' + d, display: '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) };
  }
};

function html(status, body) {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}
