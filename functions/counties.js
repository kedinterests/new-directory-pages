// /functions/counties.js
import { loadSitesRegistryFromKV } from './_lib.js';

/** Index page listing all county directories (path-based: directory.mineralrightsforum.com/) */
export const onRequestGet = async ({ request, env }) => {
  let sitesMap;

  try {
    sitesMap = await loadSitesRegistryFromKV(env);
  } catch (err) {
    return html(500, `<!doctype html><h1>Config error</h1><pre>${escapeHtml(String(err))}</pre>`);
  }

  const baseUrl = new URL(request.url).origin;

  // sitesMap is { [slug]: config } from KV
  const countyDirectories = Object.entries(sitesMap)
    .filter(([slug, config]) => {
      if (!slug || !config) return false;
      const divType = (config.division_type || '').toLowerCase();
      return divType === 'county' || divType === 'parish' || divType === 'area';
    })
    .map(([slug, config]) => ({
      slug,
      name: config.display_label || config.division_name || slug,
      state: config.state || '',
      url: `${baseUrl}/${slug}`,
      config
    }))
    .sort((a, b) => {
      const nameA = a.name.toLowerCase();
      const nameB = b.name.toLowerCase();
      return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
    });

  // Group counties by state
  const countiesByState = {};
  countyDirectories.forEach(county => {
    const state = (county.state && county.state.trim()) ? county.state : '_';
    if (!countiesByState[state]) countiesByState[state] = [];
    countiesByState[state].push(county);
  });

  // State name mapping (abbreviation -> full name)
  const stateNames = {
    'AL': 'Alabama',
    'AK': 'Alaska',
    'AZ': 'Arizona',
    'AR': 'Arkansas',
    'CA': 'California',
    'CO': 'Colorado',
    'CT': 'Connecticut',
    'DE': 'Delaware',
    'FL': 'Florida',
    'GA': 'Georgia',
    'HI': 'Hawaii',
    'ID': 'Idaho',
    'IL': 'Illinois',
    'IN': 'Indiana',
    'IA': 'Iowa',
    'KS': 'Kansas',
    'KY': 'Kentucky',
    'LA': 'Louisiana',
    'ME': 'Maine',
    'MD': 'Maryland',
    'MA': 'Massachusetts',
    'MI': 'Michigan',
    'MN': 'Minnesota',
    'MS': 'Mississippi',
    'MO': 'Missouri',
    'MT': 'Montana',
    'NE': 'Nebraska',
    'NV': 'Nevada',
    'NH': 'New Hampshire',
    'NJ': 'New Jersey',
    'NM': 'New Mexico',
    'NY': 'New York',
    'NC': 'North Carolina',
    'ND': 'North Dakota',
    'OH': 'Ohio',
    'OK': 'Oklahoma',
    'OR': 'Oregon',
    'PA': 'Pennsylvania',
    'RI': 'Rhode Island',
    'SC': 'South Carolina',
    'SD': 'South Dakota',
    'TN': 'Tennessee',
    'TX': 'Texas',
    'UT': 'Utah',
    'VT': 'Vermont',
    'VA': 'Virginia',
    'WA': 'Washington',
    'WV': 'West Virginia',
    'WI': 'Wisconsin',
    'WY': 'Wyoming',
    '_': 'Areas'
  };

  // Reverse mapping (full name -> abbreviation) for fallback lookup
  const stateNameToAbbr = {
    'Alabama': 'AL',
    'Alaska': 'AK',
    'Arizona': 'AZ',
    'Arkansas': 'AR',
    'California': 'CA',
    'Colorado': 'CO',
    'Connecticut': 'CT',
    'Delaware': 'DE',
    'Florida': 'FL',
    'Georgia': 'GA',
    'Hawaii': 'HI',
    'Idaho': 'ID',
    'Illinois': 'IL',
    'Indiana': 'IN',
    'Iowa': 'IA',
    'Kansas': 'KS',
    'Kentucky': 'KY',
    'Louisiana': 'LA',
    'Maine': 'ME',
    'Maryland': 'MD',
    'Massachusetts': 'MA',
    'Michigan': 'MI',
    'Minnesota': 'MN',
    'Mississippi': 'MS',
    'Missouri': 'MO',
    'Montana': 'MT',
    'Nebraska': 'NE',
    'Nevada': 'NV',
    'New Hampshire': 'NH',
    'New Jersey': 'NJ',
    'New Mexico': 'NM',
    'New York': 'NY',
    'North Carolina': 'NC',
    'North Dakota': 'ND',
    'Ohio': 'OH',
    'Oklahoma': 'OK',
    'Oregon': 'OR',
    'Pennsylvania': 'PA',
    'Rhode Island': 'RI',
    'South Carolina': 'SC',
    'South Dakota': 'SD',
    'Tennessee': 'TN',
    'Texas': 'TX',
    'Utah': 'UT',
    'Vermont': 'VT',
    'Virginia': 'VA',
    'Washington': 'WA',
    'West Virginia': 'WV',
    'Wisconsin': 'WI',
    'Wyoming': 'WY'
  };

  // State flag image URLs (using Wikimedia Commons with direct PNG links)
  const stateFlags = {
    'AL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Flag_of_Alabama.svg/320px-Flag_of_Alabama.svg.png',
    'AK': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Flag_of_Alaska.svg/320px-Flag_of_Alaska.svg.png',
    'AZ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Flag_of_Arizona.svg/320px-Flag_of_Arizona.svg.png',
    'AR': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Flag_of_Arkansas.svg/320px-Flag_of_Arkansas.svg.png',
    'CA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Flag_of_California.svg/320px-Flag_of_California.svg.png',
    'CO': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Flag_of_Colorado.svg/320px-Flag_of_Colorado.svg.png',
    'CT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Flag_of_Connecticut.svg/320px-Flag_of_Connecticut.svg.png',
    'DE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c6/Flag_of_Delaware.svg/320px-Flag_of_Delaware.svg.png',
    'FL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Florida.svg/320px-Flag_of_Florida.svg.png',
    'GA': 'https://upload.wikimedia.org/wikipedia/commons/b/b7/Georgia_state_flag.png',
    'HI': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ef/Flag_of_Hawaii.svg/320px-Flag_of_Hawaii.svg.png',
    'ID': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Flag_of_Idaho.svg/320px-Flag_of_Idaho.svg.png',
    'IL': 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Flag_of_Illinois.svg/320px-Flag_of_Illinois.svg.png',
    'IN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ac/Flag_of_Indiana.svg/320px-Flag_of_Indiana.svg.png',
    'IA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Flag_of_Iowa.svg/320px-Flag_of_Iowa.svg.png',
    'KS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/da/Flag_of_Kansas.svg/320px-Flag_of_Kansas.svg.png',
    'KY': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8d/Flag_of_Kentucky.svg/320px-Flag_of_Kentucky.svg.png',
    'LA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Flag_of_Louisiana.svg/320px-Flag_of_Louisiana.svg.png',
    'ME': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Flag_of_Maine.svg/320px-Flag_of_Maine.svg.png',
    'MD': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Flag_of_Maryland.svg/320px-Flag_of_Maryland.svg.png',
    'MA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f2/Flag_of_Massachusetts.svg/320px-Flag_of_Massachusetts.svg.png',
    'MI': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/Flag_of_Michigan.svg/320px-Flag_of_Michigan.svg.png',
    'MN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Minnesota.svg/320px-Flag_of_Minnesota.svg.png',
    'MS': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Flag_of_Mississippi.svg/320px-Flag_of_Mississippi.svg.png',
    'MO': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Flag_of_Missouri.svg/320px-Flag_of_Missouri.svg.png',
    'MT': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Montana_state_flag.png',
    'NE': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/Flag_of_Nebraska.svg/320px-Flag_of_Nebraska.svg.png',
    'NV': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Flag_of_Nevada.svg/320px-Flag_of_Nevada.svg.png',
    'NH': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Flag_of_New_Hampshire.svg/320px-Flag_of_New_Hampshire.svg.png',
    'NJ': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/Flag_of_New_Jersey.svg/320px-Flag_of_New_Jersey.svg.png',
    'NM': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c3/Flag_of_New_Mexico.svg/320px-Flag_of_New_Mexico.svg.png',
    'NY': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_New_York.svg/320px-Flag_of_New_York.svg.png',
    'NC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Flag_of_North_Carolina.svg/320px-Flag_of_North_Carolina.svg.png',
    'ND': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/ee/Flag_of_North_Dakota.svg/320px-Flag_of_North_Dakota.svg.png',
    'OH': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Flag_of_Ohio.svg/320px-Flag_of_Ohio.svg.png',
    'OK': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Flag_of_Oklahoma.svg/320px-Flag_of_Oklahoma.svg.png',
    'OR': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b9/Flag_of_Oregon.svg/320px-Flag_of_Oregon.svg.png',
    'PA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Pennsylvania.svg/320px-Flag_of_Pennsylvania.svg.png',
    'RI': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Flag_of_Rhode_Island.svg/320px-Flag_of_Rhode_Island.svg.png',
    'SC': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/Flag_of_South_Carolina.svg/320px-Flag_of_South_Carolina.svg.png',
    'SD': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Flag_of_South_Dakota.svg/320px-Flag_of_South_Dakota.svg.png',
    'TN': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9e/Flag_of_Tennessee.svg/320px-Flag_of_Tennessee.svg.png',
    'TX': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f7/Flag_of_Texas.svg/320px-Flag_of_Texas.svg.png',
    'UT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Flag_of_Utah.svg/320px-Flag_of_Utah.svg.png',
    'VT': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/Flag_of_Vermont.svg/320px-Flag_of_Vermont.svg.png',
    'VA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Flag_of_Virginia.svg/320px-Flag_of_Virginia.svg.png',
    'WA': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Flag_of_Washington.svg/320px-Flag_of_Washington.svg.png',
    'WV': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Flag_of_West_Virginia.svg/320px-Flag_of_West_Virginia.svg.png',
    'WI': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Flag_of_Wisconsin.svg/320px-Flag_of_Wisconsin.svg.png',
    'WY': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bc/Flag_of_Wyoming.svg/320px-Flag_of_Wyoming.svg.png'
  };

  // Build HTML grouped by state
  const pageUrl = new URL(request.url).origin;
  const sortedStates = Object.keys(countiesByState).sort((a, b) => {
    if (a === '_') return 1;
    if (b === '_') return -1;
    return a.localeCompare(b);
  });
  const stateSections = sortedStates
    .map((stateAbbr, index) => {
      const stateName = stateNames[stateAbbr] || stateAbbr;
      const counties = countiesByState[stateAbbr];
      const stateId = `state-${stateAbbr.toLowerCase()}`;
      
      const countyList = counties.map(county => {
        const description = 'Click to see mineral rights professionals.';
        
        return `
          <li class="county-list-item">
            <a href="${escapeAttr(county.url)}" class="county-list-link">
              <h3 class="county-list-name">${escapeHtml(county.name)}</h3>
              ${description ? `<span class="county-list-desc">${escapeHtml(description)}</span>` : ''}
            </a>
          </li>
        `;
      }).join('');

      // Get flag URL - try multiple lookup methods
      // First try direct abbreviation lookup (should be 'TX', 'OK', etc.)
      let flagUrl = stateFlags[stateAbbr];
      
      // If not found, try uppercase version
      if (!flagUrl && stateAbbr) {
        flagUrl = stateFlags[stateAbbr.toUpperCase()];
      }
      
      // If still not found, try looking up by state name (fallback)
      if (!flagUrl && stateName) {
        const abbrFromName = stateNameToAbbr[stateName];
        if (abbrFromName) {
          flagUrl = stateFlags[abbrFromName];
        }
      }
      
      const finalFlagUrl = flagUrl;
      
      const flagImgHtml = finalFlagUrl 
        ? `<img src="${escapeAttr(finalFlagUrl)}" alt="${escapeHtml(stateName)} flag" class="state-flag" width="32" height="24" loading="lazy" />`
        : '';
      
      // Use "parishes" for Louisiana, "areas" for no-state, "counties" otherwise
      const divisionPlural = stateAbbr === 'LA' ? 'parishes' : stateAbbr === '_' ? 'areas' : 'counties';
      const countText = `(${counties.length} ${divisionPlural})`;
      
      // Start with all states collapsed (will expand first on desktop via JS)
      const collapsedClass = ' collapsed';

      return `
        <div class="state-section${collapsedClass}">
          <button class="state-header" data-state="${stateAbbr}" aria-expanded="false" aria-controls="${stateId}">
            ${flagImgHtml || '<span class="state-flag-placeholder"></span>'}
            <h2 class="state-name">${escapeHtml(stateName)}</h2>
            <span class="state-count">${countText}</span>
            <svg class="state-chevron" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>
          <div class="state-content" id="${stateId}">
            <ul class="county-list">
              ${countyList}
            </ul>
          </div>
        </div>
      `;
    }).join('');

  return html(200, /* html */`<!doctype html>
<html lang="en">
  <head>
    <link rel="icon" type="image/png" sizes="48x48" href="https://pub-06eb4d473d5a4ae3b3274a9a1919e3d7.r2.dev/mrf-favicon-48x48.png">
    <meta charset="utf-8">
    <link rel="canonical" href="${pageUrl}">
    <title>County Index of Mineral Service Professionals | Mineral Rights Forum</title>
    <meta property="og:title" content="County Index of Mineral Service Professionals | Mineral Rights Forum">
    <meta property="og:description" content="Browse all USA county-specific directories of mineral rights professionals—landmen, attorneys, title help, and more. Find trusted local services fast.">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${pageUrl}">
    <meta property="og:image" content="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg">
    <meta property="og:site_name" content="Mineral Rights Forum">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="description" content="Browse all USA county-specific directories of mineral rights professionals—landmen, attorneys, title help, and more. Find trusted local services fast.">
    <meta name="robots" content="index, follow">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="preconnect" href="https://static.mineralrightsforum.com" crossorigin>
    <!-- Primary CSS - local file (always available, served from public/) -->
    <link rel="stylesheet" href="/styles.css?v=202604211745" media="all">
    <!-- Secondary CSS - external CDN (optional enhancement, non-blocking) -->
    <link rel="stylesheet" href="https://static.mineralrightsforum.com/styles.css" media="all" crossorigin="anonymous">
    <!-- Google Tag Manager -->
    <script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','GTM-M6JQPF');</script>
    <!-- End Google Tag Manager -->
    <!-- Google Analytics 4 -->
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-ZS0JTM2XTR"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-ZS0JTM2XTR');
    </script>
    <script>
      // CSS loading resilience - detect and handle CSS loading failures
      (function() {
        function checkCSSLoaded() {
          // Check all stylesheet links
          var links = document.querySelectorAll('link[rel="stylesheet"]');
          var failedLinks = [];
          
          links.forEach(function(link) {
            // Check if stylesheet actually loaded (works in modern browsers)
            try {
              if (link.sheet === null && link.styleSheet === undefined) {
                // Stylesheet failed to load
                failedLinks.push(link);
              }
            } catch(e) {
              // Cross-origin or other error - assume it might have loaded
            }
          });
          
          // If external CDN failed but local CSS also failed, reload local CSS
          if (failedLinks.length > 0) {
            var localLink = document.querySelector('link[href^="/styles.css"]');
            var externalLink = document.querySelector('link[href*="static.mineralrightsforum.com"]');
            
            // If external failed, remove it to avoid conflicts
            if (externalLink && failedLinks.indexOf(externalLink) !== -1) {
              externalLink.remove();
            }
            
            // If local CSS also failed, try to reload it
            if (localLink && failedLinks.indexOf(localLink) !== -1) {
              var newLink = document.createElement('link');
              newLink.rel = 'stylesheet';
              newLink.href = '/styles.css?v=' + Date.now();
              newLink.media = 'all';
              document.head.appendChild(newLink);
            }
          }
        }
        
        // Check after page load
        if (document.readyState === 'complete') {
          setTimeout(checkCSSLoaded, 1000);
        } else {
          window.addEventListener('load', function() {
            setTimeout(checkCSSLoaded, 1000);
          });
        }
        
        // Also check after a longer delay to catch slow-loading CSS
        setTimeout(checkCSSLoaded, 3000);
      })();
    </script>
    <style>
      :root{
        --sticky-offset: 64px;
        --mrf-primary: #111827;
        --mrf-primary-700: #0f172a;
        --mrf-text-on-primary: #ffffff;
        --mrf-outline: #e5e7eb;
        --mrf-border: #e5e7eb;
        --mrf-subtle: #6b7280;
        --mrf-accent: #f59e0b;
        --mrf-accent-600: #d97706;
      }
      html{ scroll-behavior:smooth; }
      html, body {
        width: 100%;
        overflow-x: hidden;
        max-width: 100vw;
      }
      body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;color:#111;line-height:1.5}
      .site-wrapper, .page, .content, .container, main, footer, header {
        max-width: 100%;
        overflow-x: hidden;
      }
      * { box-sizing: border-box; }
      img, video, iframe, embed, object { max-width: 100%; height: auto; }
      .container{max-width:1280px;margin:0 auto;padding:1rem}
      .shadow-soft{box-shadow:0 1px 2px rgba(0,0,0,.05),0 1px 3px rgba(0,0,0,.1)}
      
      /* Header Back Button */
      .header-back-btn{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: #ffffff;
        background: #23456D;
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;
      }
      .header-back-btn:hover{
        background: #1a3454;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2);
      }
      .header-back-btn:active{
        transform: translateY(0);
        box-shadow: none;
      }
      .header-back-btn svg{
        flex-shrink: 0;
      }
      
      /* Sticky title/filters row (almost black) */
      .dir-sticky{
        position: -webkit-sticky; /* iOS Safari fallback */
        position: sticky;
        top: 0;
        z-index: 30;
        background: var(--mrf-primary);          /* #111827 – "almost black" */
        color: #f9fafb;
        border-bottom: 1px solid #020617;
        margin-bottom: 0px;
        transform: translateZ(0); /* Force hardware acceleration for iOS */
        will-change: transform; /* Optimize for iOS */
      }

      /* Tighten vertical padding in sticky bar */
      .dir-sticky .container{
        padding-top: 0.35rem;
        padding-bottom: 0.35rem;
      }

      /* Make text/labels/inputs readable on dark bg */
      .dir-sticky h1,
      .dir-sticky p,
      .dir-sticky label{
        color: #f9fafb;
      }

      .dir-sticky .srch,
      .dir-sticky select{
        background-color: #ffffff;
        color: #111827;
        border-color: #4b5563;
      }

      .dir-sticky .srch::placeholder{
        color: #9ca3af;
      }
      
      .srch{width:100%;max-width:28rem}
      
      .expand-collapse-buttons {
        display: flex;
        gap: 0.5rem;
      }
      
      .btn-expand-collapse {
        padding: 0.625rem 1.25rem;
        background: #23456D;
        color: #ffffff;
        border: none;
        border-radius: 0.5rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-size: 0.9375rem;
        white-space: nowrap;
      }
      
      .btn-expand-collapse:hover {
        background: #1a3454;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(35, 69, 109, 0.2);
      }
      
      .btn-expand-collapse:active {
        transform: translateY(0);
        box-shadow: none;
      }
      
      /* Index Description */
      .index-description {
        text-align: center;
        line-height: 1.4;
        margin: 0.25rem auto 2rem;
        max-width: 800px;
        color: #000000;
        font-size: 1.25rem;
        font-weight: 600;
      }
      
      /* Mobile Expand Message */
      .mobile-expand-message {
        display: none;
        text-align: center;
        color: var(--mrf-subtle);
        font-size: 0.875rem;
        margin: 0.25rem auto 1rem;
        font-style: italic;
      }
      
      /* State Sections */
      .states-container {
        max-width: 1200px;
        margin: 0 auto 3rem;
        column-count: 2;
        column-gap: 2rem;
      }
      
      .state-section.hidden {
        display: none;
      }
      
      .county-list-item.hidden {
        display: none;
      }
      
      /* Modal Styles */
      .hidden {
        display: none !important;
      }
      
      .close-icon-btn {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.25rem;
        color: #6b7280;
        transition: color 0.2s ease;
      }
      
      .close-icon-btn:hover {
        color: #111827;
      }
      
      .state-section {
        break-inside: avoid;
        page-break-inside: avoid;
        background: white;
        border: 1px solid var(--mrf-border);
        border-radius: 0.75rem;
        margin-bottom: 1rem;
        overflow: hidden;
        box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.1);
      }
      
      .state-header {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        background: #f3f4f6;
        color:rgb(26, 32, 45);
        border: .75px solid #111827;
        cursor: pointer;
        font-size: 1.125rem;
        font-weight: 600;
        text-align: left;
        transition: background 0.2s ease, color 0.2s ease;
        gap: 0.75rem;
        border-radius: 0.75rem;
      }
      
      .state-header[aria-expanded="true"] {
        background: #000000;
        color: #ffffff;
        border-color: #000000;
      }
      
      .state-header[aria-expanded="false"]:hover {
        background: #e5e7eb;
      }
      
      .state-header[aria-expanded="true"]:hover {
        background: #111827;
      }
      
      .state-header .state-chevron {
        transform: rotate(0deg);
      }
      
      .state-header[aria-expanded="false"] .state-chevron {
        transform: rotate(-90deg);
      }
      
      .state-flag {
        width: 32px;
        height: 24px;
        object-fit: cover;
        border-radius: 2px;
        flex-shrink: 0;
        border: 1px solid rgba(255, 255, 255, 0.2);
      }
      
      .state-flag-placeholder {
        width: 32px;
        height: 24px;
        background: rgba(0, 0, 0, 0.1);
        display: inline-block;
        border-radius: 2px;
        flex-shrink: 0;
        border: 1px solid rgba(0, 0, 0, 0.2);
      }
      
      .state-header[aria-expanded="true"] .state-flag-placeholder {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      .state-name {
        flex: 1;
        margin: 0;
        font-size: inherit;
        font-weight: inherit;
      }
      
      .state-name::first-letter {
        font-size: 1.25em;
        vertical-align: baseline;
        margin-right: 0em;
      }
      
      /* Tips Card Styles */
      .tips-card{
        border: 1px solid var(--mrf-border);
        border-radius: 0.5rem;
        background: #fff;
        box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 1px 3px rgba(0,0,0,.1);
        margin: 1.5rem auto;
        max-width: 1280px;
        overflow: hidden;
        transition: box-shadow .18s ease;
      }
      .tips-card:hover{
        box-shadow: 0 1px 3px rgba(0,0,0,.08), 0 10px 30px rgba(15,23,42,.12);
      }
      .tips-card-header{
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1.25rem 1.5rem;
        cursor: pointer;
        user-select: none;
        background: #f8fafc;
        border-bottom: 1px solid var(--mrf-border);
        transition: background .18s ease;
      }
      .tips-card-header:hover{
        background: #f1f5f9;
      }
      .tips-card-header h2{
        margin: 0;
        font-size: 1.125rem;
        font-weight: 700;
        color: var(--mrf-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
      .tips-card-chevron{
        width: 20px;
        height: 20px;
        transition: transform 0.3s ease;
        color: var(--mrf-subtle);
      }
      .tips-card.expanded .tips-card-chevron{
        transform: rotate(180deg);
      }
      .tips-card-content{
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
        padding: 0 1.5rem;
      }
      .tips-card.expanded .tips-card-content{
        max-height: 1000px;
        padding: 1.5rem;
      }
      .tips-card-content ul{
        margin: 0;
        padding-left: 1.5rem;
        list-style-type: disc;
      }
      .tips-card-content li{
        margin-bottom: 0.75rem;
        line-height: 1.6;
        color: #374151;
      }
      .tips-card-content li:last-child{
        margin-bottom: 0;
      }
      .tips-card-content strong{
        color: var(--mrf-primary);
        font-weight: 600;
      }
      
      /* CTA Blocks Container */
      .cta-blocks-container{
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
        margin: 3rem auto 2rem;
        max-width: 1200px;
      }
      
      /* CTA Block Styles */
      .cta-block{
        padding: 2.5rem 2rem;
        background: #FFFEF5;
        border-radius: 1rem;
        text-align: center;
        box-shadow: 0 4px 6px rgba(35, 69, 109, 0.08), 0 2px 4px rgba(35, 69, 109, 0.06);
        border: 1px solid rgba(35, 69, 109, 0.1);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      .cta-block:hover{
        transform: translateY(-2px);
        box-shadow: 0 8px 12px rgba(35, 69, 109, 0.12), 0 4px 6px rgba(35, 69, 109, 0.08);
      }
      .cta-text{
        font-size: 1.25rem;
        font-weight: 500;
        color: #23456D;
        margin: 0 0 1.75rem 0;
        line-height: 1.6;
        flex-grow: 1;
      }
      .cta-text a{
        font-weight: 700;
        text-decoration: none;
        color: #23456D;
      }
      .cta-text a:hover{
        font-weight: 700;
        text-decoration: underline;
      }
      .cta-button{
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0.625rem 1.25rem;
        font-size: 0.9375rem;
        font-weight: 500;
        color: #ffffff;
        background: var(--mrf-primary);
        border: none;
        border-radius: 0.5rem;
        cursor: pointer;
        transition: all 0.2s ease;
        letter-spacing: 0.01em;
        margin-top: auto;
      }
      .cta-button:hover{
        background: var(--mrf-primary-700);
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,.1);
      }
      .cta-button:active{
        transform: translateY(0);
      }
      
      .state-count {
        margin-left: 0.5rem;
        font-weight: 400;
        opacity: 0.9;
      }
      
      .state-chevron {
        margin-left: 1rem;
        transition: transform 0.3s ease;
        flex-shrink: 0;
      }
      
      .state-content {
        max-height: 2000px;
        overflow: hidden;
        transition: max-height 0.3s ease, padding 0.3s ease;
        padding: 1rem 1.5rem;
      }
      
      .state-section.collapsed .state-content {
        max-height: 0;
        padding: 0 1.5rem;
      }
      
      .county-list {
        list-style: none;
        margin: 0;
        padding: 0;
      }
      
      .county-list-item {
        margin-bottom: 0.75rem;
      }
      
      .county-list-item:last-child {
        margin-bottom: 0;
      }
      
      .county-list-link {
        display: block;
        padding: 0.75rem 0.875rem;
        background: #f9fafb;
        border: 1px solid var(--mrf-border);
        border-radius: 0.5rem;
        text-decoration: none;
        color: var(--mrf-primary);
        transition: all 0.2s ease;
      }
      
      .county-list-link:hover {
        background: #f3f4f6;
        border-color: #6b7280;
        transform: translateX(4px);
        box-shadow: 0 2px 4px rgba(0,0,0,.05);
      }
      
      .county-list-name {
        display: block;
        font-weight: 600;
        font-size: 1rem;
        margin: 0 0 0.25rem 0;
      }
      
      .county-list-desc {
        display: block;
        font-size: 0.875rem;
        color: var(--mrf-subtle);
        line-height: 1.4;
      }
      
      /* Buttons */
      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: 0.625rem 1.25rem;
        border-radius: 0.5rem;
        border: 1px solid var(--mrf-outline);
        font-weight: 500;
        text-decoration: none;
        transition: all 0.2s ease;
        cursor: pointer;
      }
      
      .btn-primary {
        background: var(--mrf-primary);
        color: var(--mrf-text-on-primary);
        border-color: var(--mrf-primary);
      }
      
      .btn-primary:hover {
        background: var(--mrf-primary-700);
        border-color: var(--mrf-primary-700);
        transform: translateY(-1px);
        box-shadow: 0 4px 6px rgba(0,0,0,.1);
      }
      
      /* Footer */
      footer {
        background: var(--mrf-primary);
        color: #f9fafb;
        padding: 2.5rem 0;
        margin-top: 3rem;
        width: 100%;
      }
      
      .footer-content {
        display: flex;
        flex-wrap: wrap;
        gap: 2rem;
        justify-content: space-between;
        align-items: flex-start;
      }
      
      .footer-left {
        flex: 0 0 auto;
        text-align: left;
      }
      
      .footer-left h3 {
        font-size: 1.125rem;
        font-weight: 700;
        color: #f9fafb;
        margin: 0 0 0.5rem 0;
      }
      
      .footer-left p {
        font-size: 0.875rem;
        color: #d1d5db;
        margin: 0;
        line-height: 1.5;
      }
      
      .footer-right {
        flex: 0 0 auto;
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
        align-items: flex-end;
        text-align: right;
      }
      
      .footer-menu {
        display: flex;
        flex-wrap: wrap;
        gap: 1.5rem;
        list-style: none;
        margin: 0;
        padding: 0;
        justify-content: flex-end;
      }
      
      .footer-menu a {
        color: #e5e7eb;
        text-decoration: none;
        font-size: 0.9375rem;
        transition: color 0.2s ease;
      }
      
      .footer-menu a:hover {
        color: #ffffff;
      }
      
      .footer-social {
        display: flex;
        gap: 1rem;
        align-items: center;
      }
      
      .footer-social a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        border-radius: 0.375rem;
        background: rgba(255, 255, 255, 0.1);
        color: #e5e7eb;
        transition: all 0.2s ease;
      }
      
      .footer-social a:hover {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
      }
      
      .footer-social svg {
        width: 20px;
        height: 20px;
      }
      
      @media (max-width: 767px) {
        /* Larger title text on mobile */
        .dir-sticky h1{
          font-size: 1.5rem;
          line-height: 1.2;
          text-align: center;
        }

        /* More vertical padding on mobile */
        .dir-sticky .container{
          padding-top: 1.5rem;
          padding-bottom: 1.5rem;
        }

        /* Hide inline filters in the sticky bar on mobile */
        .dir-sticky .filters-row{
          display: none;
        }

        /* Reduce space under black sticky bar */
        .dir-sticky{
          margin-bottom: 0px !important;
        }
        
       /* .index-description {
          margin: 1.5rem auto 1.5rem;
          padding: 0 1rem;
          font-size: 0.9375rem;
        }*/
        
        .mobile-expand-message {
          display: block;
        }
        
        .tips-card{
          margin: 1rem;
          border-radius: 0.5rem;
        }
        .tips-card-header{
          padding: 1rem 1.25rem;
        }
        .tips-card-header h2{
          font-size: 1rem;
        }
        .tips-card.expanded .tips-card-content{
          padding: 1rem 1.25rem;
        }
        .tips-card-content ul{
          padding-left: 1.25rem;
        }
        
        .cta-blocks-container{
          margin: 2rem 1rem 1.5rem;
          gap: 1.5rem;
        }
        .cta-block{
          padding: 2rem 1.5rem;
        }
        .cta-text{
          font-size: 1.125rem;
        }
        
        .states-container {
          margin: 0 auto 2rem;
          column-count: 1;
        }
        
        .state-header {
          padding: 0.875rem 1rem;
          font-size: 1rem;
        }
        
        .state-content {
          padding: 0.75rem 1.25rem;
        }
        
        .state-section.collapsed .state-content {
          padding: 0 1.25rem;
        }
        
        .county-list-link {
          padding: 0.75rem;
        }
        
        footer {
          padding: 2rem 0;
        }
        
        .footer-content {
          flex-direction: column;
          gap: 1.5rem;
          align-items: center;
          text-align: center;
        }
        
        .footer-left {
          text-align: center;
        }
        
        .footer-right {
          align-items: center;
          text-align: center;
        }
        
        .footer-menu {
          justify-content: center;
        }
      }
    </style>
  </head>
  <body class="bg-white">

    <!-- Google Tag Manager (noscript) -->
    <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-M6JQPF"
    height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
    <!-- End Google Tag Manager (noscript) -->

    <!-- ===== MRF HEADER ===== -->
    <header class="z-10 bg-white shadow-xl">
      <div class="bg-white max-w-7xl mx-auto px-4 sm:px-6 py-3 border-b border-gray-200">
        <div class="flex items-center justify-center md:justify-between">
          <a href="https://www.mineralrightsforum.com" class="block w-fit">
            <img src="https://www.mineralrightsforum.com/uploads/db5755/original/3X/7/7/7710a47c9cd8492b1935dd3b8d80584938456dd4.jpeg"
                 alt="Mineral Rights Forum Logo"
                 class="h-12 w-auto rounded-lg"
                 onerror="this.onerror=null;this.src='https://placehold.co/150x40/d1d5db/4b5563?text=MRF+Logo'">
          </a>
          <button class="header-back-btn" style="display: none;" id="returnBtn" data-return-url="https://www.mineralrightsforum.com">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            <span>Return to Forum</span>
          </button>
        </div>
      </div>
    </header>

    <!-- ===== DIRECTORY STICKY BAR (TITLE + FILTERS) ===== -->
    <div class="dir-sticky">
      <div class="container py-1">
        <div class="flex flex-col gap-2 md:flex-row items-center md:items-center md:justify-between">
          <div>
            <h1 class="text-xl font-bold whitespace-pre-line">County Index of Mineral Rights Professionals</h1>
          </div>
          <div class="flex gap-2 items-center filters-row">
            <input id="countySearch" class="srch border rounded-lg px-3 py-2" type="search" placeholder="Search counties..." aria-label="Search counties">
            <div class="expand-collapse-buttons">
              <button id="expandAll" class="btn-expand-collapse">Expand All</button>
              <button id="collapseAll" class="btn-expand-collapse">Collapse All</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== CONTENT ===== -->
    <main class="container">
      <p class="index-description">Find trusted mineral rights professionals listed by state & county - includes attorneys, landmen, CPA's, and mineral managers. Expand to see counties.</p>
      <p class="mobile-expand-message">Click to Expand</p>
      <div class="states-container">
        ${stateSections}
      </div>
      
      <!-- ===== Tips for Choosing a Pro ===== -->
      <div class="tips-card" id="tipsCard">
        <div class="tips-card-header" id="tipsCardHeader">
          <h2>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink: 0;">
              <g fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13.737 21.848a10.002 10.002 0 0 0 6.697-15.221a10 10 0 1 0-6.698 15.221z"/>
                <path stroke-linecap="square" d="M12 12v6m0-11V6"/>
              </g>
            </svg>
            <span>Tips for Choosing a Pro</span>
          </h2>
          <svg class="tips-card-chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </div>
        <div class="tips-card-content">
          <ul>
            <li><strong>Review credentials & licenses:</strong> Ensure a vendor is properly licensed and/or certified in their field (attorney bar member, certified specialties, landman certifications, etc.)</li>
            <li><strong>Ask about area experience:</strong> Inquire specifically about experience in the state(s) where your minerals are located. State law is primarily what rules in oil and gas.</li>
            <li><strong>Request references:</strong> Ask for references from previous clients. Think twice if there is any hesitation on their part.</li>
            <li><strong>Understand fee structures:</strong> Get clear information upfront about fee structure (hourly, flat fee, etc.), and what services are included.</li>
            <li><strong>Gather your paperwork:</strong> Don't forget info you may have from relatives also. If at all possible, scan and/or share electronically. Relatives can share costs also.</li>
            <li><strong>Consider specialization:</strong> Look for pros who specialize in your specific needs (royalty disputes, lease negotiations, title work, etc.). One size does not fit all.</li>
          </ul>
        </div>
      </div>
      
      <!-- Business Owners CTA Section -->
      <div class="cta-blocks-container">
        <div class="cta-block">
          <p class="cta-text">
            Business Owners - would you like to appear on one of our directory pages? We offer paid <a href="https://directory.mineralrightsforum.com">County-specific Directories</a> and a general <a href="https://mineral-services-directory.mineralrightsforum.com">Nationwide Directory</a>. Limitations apply.
          </p>
          <button id="applyForListingBtn" class="cta-button">
            Apply for Listing
          </button>
        </div>
      </div>
    </main>

    <script>
      document.addEventListener('DOMContentLoaded', () => {
        // Expand first state on desktop only
        const isDesktop = window.matchMedia('(min-width: 768px)').matches;
        if (isDesktop) {
          const firstStateSection = document.querySelector('.state-section');
          const firstStateHeader = firstStateSection?.querySelector('.state-header');
          if (firstStateSection && firstStateHeader) {
            firstStateSection.classList.remove('collapsed');
            firstStateHeader.setAttribute('aria-expanded', 'true');
          }
        }
        
        // Show/hide return button based on screen size
        const returnBtn = document.getElementById('returnBtn');
        function toggleReturnButton() {
          if (returnBtn) {
            if (window.matchMedia('(min-width: 768px)').matches) {
              returnBtn.style.display = 'inline-flex';
            } else {
              returnBtn.style.display = 'none';
            }
          }
        }
        toggleReturnButton();
        window.addEventListener('resize', toggleReturnButton);
        
        // Handle return button click
        if (returnBtn) {
          const returnUrl = returnBtn.getAttribute('data-return-url') || 'https://www.mineralrightsforum.com';
          returnBtn.addEventListener('click', () => {
            window.location.href = returnUrl;
          });
        }
        
        const stateHeaders = document.querySelectorAll('.state-header');
        const countySearch = document.getElementById('countySearch');
        const expandAllBtn = document.getElementById('expandAll');
        const collapseAllBtn = document.getElementById('collapseAll');
        
        // Handle state section expand/collapse
        stateHeaders.forEach(header => {
          header.addEventListener('click', () => {
            const stateSection = header.closest('.state-section');
            const isExpanded = header.getAttribute('aria-expanded') === 'true';
            
            // Toggle collapsed class
            if (isExpanded) {
              stateSection.classList.add('collapsed');
              header.setAttribute('aria-expanded', 'false');
            } else {
              stateSection.classList.remove('collapsed');
              header.setAttribute('aria-expanded', 'true');
            }
          });
        });
        
        // Expand all functionality
        expandAllBtn.addEventListener('click', () => {
          stateHeaders.forEach(header => {
            const stateSection = header.closest('.state-section');
            stateSection.classList.remove('collapsed');
            header.setAttribute('aria-expanded', 'true');
          });
        });
        
        // Collapse all functionality
        collapseAllBtn.addEventListener('click', () => {
          stateHeaders.forEach(header => {
            const stateSection = header.closest('.state-section');
            stateSection.classList.add('collapsed');
            header.setAttribute('aria-expanded', 'false');
          });
        });
        
        // Search functionality
        function filterCounties(searchTerm) {
          const term = searchTerm.toLowerCase().trim();
          const countyItems = document.querySelectorAll('.county-list-item');
          const stateSections = document.querySelectorAll('.state-section');
          
          let hasVisibleCounties = false;
          
          // Filter county items
          countyItems.forEach(item => {
            const countyName = item.querySelector('.county-list-name')?.textContent.toLowerCase() || '';
            const countyDesc = item.querySelector('.county-list-desc')?.textContent.toLowerCase() || '';
            
            const matches = !term || countyName.includes(term) || countyDesc.includes(term);
            item.classList.toggle('hidden', !matches);
            
            if (matches) {
              hasVisibleCounties = true;
            }
          });
          
          // Show/hide state sections based on visible counties
          stateSections.forEach(section => {
            const visibleCounties = section.querySelectorAll('.county-list-item:not(.hidden)');
            section.classList.toggle('hidden', visibleCounties.length === 0);
          });
          
          // Auto-expand sections with matching counties
          if (term) {
            stateSections.forEach(section => {
              const visibleCounties = section.querySelectorAll('.county-list-item:not(.hidden)');
              if (visibleCounties.length > 0) {
                const header = section.querySelector('.state-header');
                section.classList.remove('collapsed');
                if (header) {
                  header.setAttribute('aria-expanded', 'true');
                }
              }
            });
          }
        }
        
        // Debounce function for search
        function debounce(func, wait) {
          let timeout;
          return function executedFunction(...args) {
            const later = () => {
              clearTimeout(timeout);
              func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
          };
        }
        
        // Add search event listener with debounce
        countySearch.addEventListener('input', debounce((e) => {
          filterCounties(e.target.value);
        }, 200));
        
        // --- Tips Card Toggle ---
        const tipsCard = document.getElementById('tipsCard');
        const tipsCardHeader = document.getElementById('tipsCardHeader');
        if (tipsCardHeader && tipsCard) {
          tipsCardHeader.addEventListener('click', () => {
            tipsCard.classList.toggle('expanded');
            localStorage.setItem('tipsCardExpanded', tipsCard.classList.contains('expanded'));
          });
          const savedState = localStorage.getItem('tipsCardExpanded');
          if (savedState === 'true') {
            tipsCard.classList.add('expanded');
          }
        }
        
        // Apply for Listing modal
        const applyModal = document.getElementById('applyModal');
        const applyBtn = document.getElementById('applyForListingBtn');
        applyModal?.addEventListener('click', (e)=>{
          const closeBtn = e.target.closest('[data-close-apply]');
          if(closeBtn) applyModal.classList.add('hidden');
        });
        applyBtn?.addEventListener('click', ()=>{ applyModal?.classList.remove('hidden'); });
        window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') applyModal?.classList.add('hidden'); });
      });
    </script>

    <footer>
      <div class="container">
        <div class="footer-content">
          <div class="footer-left">
            <span>The Mineral Rights Forum</span>
            <p>&copy; ${new Date().getFullYear()} All Rights Reserved</p>
          </div>
          <div class="footer-right">
            <ul class="footer-menu">
              <li><a href="https://www.mineralrightsforum.com">Home</a></li>
              <li><a href="https://www.mineralrightsforum.com/about">About</a></li>
              <li><a href="https://www.mineralrightsforum.com/privacy">Privacy</a></li>
              <li><a href="https://www.mineralrightsforum.com/tos">TOS</a></li>
              <li><a href="https://www.mineralrightsforum.com/t/advertise-with-us-to-reach-mineral-owners/24986">Advertise</a></li>
            </ul>
            <div class="footer-social">
              <a href="https://www.facebook.com/mrforum" aria-label="Facebook" target="_blank">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1h3z"></path>
                </svg>
              </a>
              <a href="https://x.com/mineralforum" aria-label="X (Twitter)" target="_blank">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584l-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>
              </a>
              <a href="https://www.linkedin.com/company/the-mineral-rights-forum" aria-label="LinkedIn" target="_blank">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>

  <!-- Apply for Listing Modal -->
  <div id="applyModal" class="hidden fixed inset-0 z-50">
    <div class="absolute inset-0 bg-black/40" data-close-apply="1"></div>
    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl p-6 w-[min(95vw,48rem)] max-h-[90vh] overflow-y-auto shadow-soft">
      <div class="flex justify-between items-center mb-4">
        <h3 class="text-lg font-semibold">Apply for Listing</h3>
        <button class="close-icon-btn" data-close-apply="1" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <iframe aria-label='MRF Advertiser Questionnaire' frameborder="0" style="height:500px;width:99%;border:none;" src='https://forms.zohopublic.com/kedinterestsllc/form/MRFAdvertiserQuestionnaire/formperma/fqHZoswuV-fPl--7JzxywtBbJ6WhWoQx5PkXRVrqBoI'></iframe>
    </div>
  </div>

  </body>
</html>
`);

  // -------- helpers --------
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
};

function html(status, body) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' }
  });
}

