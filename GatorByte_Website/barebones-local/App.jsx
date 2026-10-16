import React from 'react';
import './styles.css';

const h = React.createElement;

/*
  ================================================================
  GATORBYTE TEAM IMPLEMENTATION MAP
  ================================================================
  This file is currently a FRONTEND-ONLY prototype. The sections
  marked TEAM TODO show where the real backend/database features
  should be connected as the project is developed.

  Planned architecture:
    React frontend (this file)
           | HTTP / JSON
           v
    Python backend (Flask/FastAPI)
           | SQL
           v
    MySQL database

  Main places teammates will likely work:
    1. DEAL DATABASE      -> load deals near the useEffect section below
    2. DEAL SUBMISSION    -> submitDeal()
    3. WISHLIST           -> toggleSaved()
    4. UPVOTES            -> toggleVote()
    5. LEADERBOARD        -> contributors / leaderboard section
    6. AUTHENTICATION     -> add current-user state near the other useState calls
    7. GEMINI / LLM       -> call it from the PYTHON BACKEND, not directly here
    8. ADMIN MODERATION   -> add approval/report controls to the backend + UI

  Suggested backend routes are included in comments below. They are
  examples only; keep the frontend and backend route names consistent.
  ================================================================
*/

// TEAM TODO [DATABASE]: Replace this empty array with data loaded from
// GET /api/deals after the Python backend and MySQL database are ready.
const starterDeals = [];

// TEAM TODO [LEADERBOARD]: Replace with data from GET /api/leaderboard.
// The backend should calculate rankings from real contribution data.
const contributors = [];

function money(value) {
  return '$' + Number(value).toFixed(2);
}

function App() {
  const [dark, setDark] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [deals, setDeals] = React.useState(starterDeals);
  const [saved, setSaved] = React.useState([]);
  const [voted, setVoted] = React.useState([]);
  const [formOpen, setFormOpen] = React.useState(false);
  const [notice, setNotice] = React.useState('');

  // TEAM TODO [AUTHENTICATION]: Add state for the logged-in user here.
  // Example fields: user_id, username, role ('member' or 'admin'), points.
  // Do not store plain-text passwords in frontend state. The backend should
  // handle password hashing and return a secure session/token after login.

  React.useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [dark]);

  React.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2600);
    return () => clearTimeout(timer);
  }, [notice]);

  // TEAM TODO [DATABASE/API - LOAD DEALS]:
  //
  // Also consider loading the leaderboard here or in a separate useEffect:
  //   GET /api/leaderboard

  // Current search is client-side because the prototype has very little data.
  // TEAM TODO [SEARCH]: For a larger database, move filtering to the backend,
  // for example GET /api/deals?search=headphones&category=Electronics.
  const filteredDeals = deals.filter((deal) => {
    const haystack = `${deal.title} ${deal.store} ${deal.category}`.toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  // TEAM TODO [WISHLIST + DATABASE]:
  // This currently saves deal IDs only in browser memory. Replace this with
  // authenticated API calls so saved items persist after refresh/login.
  // Suggested routes:
  //   POST   /api/wishlist/:dealId
  //   DELETE /api/wishlist/:dealId
  // The backend should associate the saved deal with the logged-in user.
  function toggleSaved(id) {
    setSaved((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  // TEAM TODO [VOTING + GAMIFICATION]:
  // This currently changes only local UI state. Replace with a backend call,
  // e.g. POST /api/deals/:dealId/vote. The backend should prevent duplicate
  // votes and can award contribution points when appropriate.
  function toggleVote(id) {
    setVoted((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }

  // TEAM TODO [DEAL SUBMISSION + DATABASE]:
  // This is the main place to connect the submit form to the Python backend.
  // Instead of only calling setDeals(), POST the form data to /api/deals.
  // The backend should validate the user, validate the URL/price, optionally
  // send product text/URL to Gemini for keyword/product matching, then INSERT
  // the approved/pending submission into MySQL and return the created record.
  //
  // TEAM TODO [ADMIN MODERATION]: New submissions can start with status='pending'.
  // An admin page can later call PATCH /api/deals/:id/approve or /deny.
  function submitDeal(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const title = String(data.get('title') || '').trim();
    const store = String(data.get('store') || '').trim();
    const price = Number(data.get('price'));
    const original = Number(data.get('original')) || price;
    const category = String(data.get('category') || 'Other');

    if (!title || !store || !price || price <= 0) {
      setNotice('Please enter a product, store, and valid deal price.');
      return;
    }

    // PROTOTYPE ONLY: This immediately inserts the deal into local memory.
    // TEAM TODO: Remove/replace this block after POST /api/deals is working.
    setDeals((current) => [{
      id: Date.now(),
      title,
      store,
      price,
      original: Math.max(original, price),
      category,
      votes: 0,
      submittedBy: 'You',
      badge: 'Just submitted'
    }, ...current]);

    event.currentTarget.reset();
    setFormOpen(false);
    setNotice('Deal added to the prototype. Database integration is still in progress.');
  }

  return h(React.Fragment, null,
    h('a', { className: 'skip', href: '#main' }, 'Skip to content'),

    h('header', { className: 'site-header' },
      h('div', { className: 'wrap header-inner' },
        h('a', { className: 'brand', href: '#top', 'aria-label': 'GatorByte home' },
          h('span', { className: 'mark', 'aria-hidden': true }, 'G'),
          h('span', null, 'GatorByte')
        ),
        h('nav', { 'aria-label': 'Main navigation' },
          h('a', { href: '#deals' }, 'Deals'),
          h('a', { href: '#leaderboard' }, 'Leaderboard'),
          h('a', { href: '#about' }, 'How it works'),
          h('button', { className: 'nav-cta', onClick: () => setFormOpen(true) }, '+ Submit deal'),
          h('button', {
            className: 'theme',
            onClick: () => setDark(!dark),
            'aria-label': dark ? 'Switch to light theme' : 'Switch to dark theme',
            'aria-pressed': dark
          }, dark ? '☀' : '☾')
        )
      )
    ),

    h('main', { id: 'main' },
      // =============================================================
      // HERO / PROJECT OVERVIEW
      // TEAM TODO [LIVE STATS]: The three statistics below can eventually
      // come from an endpoint such as GET /api/stats.
      // =============================================================
      h('section', { className: 'hero', id: 'top' },
        h('div', { className: 'wrap hero-grid' },
          h('div', { className: 'hero-copy' },
            h('p', { className: 'eyebrow' }, h('span', { className: 'dot' }), 'COMMUNITY-POWERED SHOPPING'),
            h('h1', null, 'Spend less time searching.', h('br'), h('span', { className: 'accent-title' }, 'Find better deals.')),
            h('p', { className: 'intro' },
              'GatorByte brings shopper-submitted deals into one place, then uses smart product matching to help you compare the items you actually care about.'
            ),
            h('div', { className: 'hero-actions' },
              h('a', { className: 'button primary', href: '#deals' }, 'Browse deals', h('span', { 'aria-hidden': true }, '→')),
              h('button', { className: 'button secondary', onClick: () => setFormOpen(true) }, 'Submit a deal')
            ),
            h('p', { className: 'footnote' }, 'Free to browse · Community ranked · Built around specific products')
          ),
          h('div', { className: 'hero-card', 'aria-label': 'GatorByte overview' },
            h('div', { className: 'mini-card' },
              h('span', { className: 'mini-label' }, 'COMMUNITY SIGNAL'),
              h('strong', null, 'Useful deals rise to the top'),
              h('p', null, 'Votes and contributor activity help shoppers quickly spot listings worth checking.')
            ),
            h('div', { className: 'stats-row' },
              h('div', null, h('strong', null, '—'), h('span', null, 'deals · in progress')),
              h('div', null, h('strong', null, '—'), h('span', null, 'contributors · in progress')),
              h('div', null, h('strong', null, '—'), h('span', null, 'database · in progress'))
            )
          )
        )
      ),

      // =============================================================
      // DEAL FEED
      // TEAM TODO [DATABASE]: Deal cards are rendered from the `deals` state.
      // Once GET /api/deals is implemented, this section will display MySQL data
      // without needing hard-coded products in this file.
      // =============================================================
      h('section', { className: 'section', id: 'deals' },
        h('div', { className: 'wrap' },
          h('div', { className: 'section-heading' },
            h('div', null,
              h('p', { className: 'eyebrow' }, '01 / DISCOVER'),
              h('h2', null, 'Deals worth checking')
            ),
            h('p', null, 'Search the community feed by product, store, or category.')
          ),
          h('div', { className: 'toolbar' },
            h('label', { className: 'search' },
              h('span', { className: 'sr-only' }, 'Search deals'),
              h('span', { 'aria-hidden': true }, '⌕'),
              h('input', {
                value: query,
                onChange: (event) => setQuery(event.target.value),
                placeholder: 'Search products, stores, or categories…'
              })
            ),
            h('button', { className: 'saved-count', onClick: () => setQuery('') }, `Saved ${saved.length}`)
          ),
          h('div', { className: 'deal-grid' },
            ...(filteredDeals.length ? filteredDeals.map((deal) => {
              const isSaved = saved.includes(deal.id);
              const isVoted = voted.includes(deal.id);
              const discount = Math.max(0, Math.round((1 - deal.price / deal.original) * 100));
              // TEAM TODO [DEAL DETAILS]: Add a real product image, outbound deal
              // URL, expiration/status, comments, and report button when those
              // database fields/backend routes are available.
              return h('article', { className: 'deal-card', key: deal.id },
                h('div', { className: 'deal-topline' },
                  h('span', { className: 'pill' }, deal.badge),
                  h('button', {
                    className: `save ${isSaved ? 'active' : ''}`,
                    onClick: () => toggleSaved(deal.id),
                    'aria-label': isSaved ? `Remove ${deal.title} from saved deals` : `Save ${deal.title}`
                  }, isSaved ? '♥' : '♡')
                ),
                h('div', { className: 'product-visual', 'aria-hidden': true }, deal.category.slice(0, 1)),
                h('p', { className: 'category' }, deal.category),
                h('h3', null, deal.title),
                h('p', { className: 'store' }, deal.store),
                h('div', { className: 'price-row' },
                  h('strong', null, money(deal.price)),
                  h('span', { className: 'original' }, money(deal.original)),
                  discount > 0 ? h('span', { className: 'discount' }, `${discount}% off`) : null
                ),
                h('div', { className: 'deal-footer' },
                  h('button', {
                    className: `vote ${isVoted ? 'active' : ''}`,
                    onClick: () => toggleVote(deal.id)
                  }, '▲ ', deal.votes + (isVoted ? 1 : 0)),
                  h('span', null, `by ${deal.submittedBy}`)
                )
              );
            }) : [h('div', { className: 'empty', key: 'empty' },
              h('strong', null, deals.length ? 'No matching deals yet.' : 'Deal data — in progress'),
              h('p', null, deals.length ? 'Try a different search.' : 'The live deal feed will appear here once the backend and database are connected.')
            )])
          )
        )
      ),

      // =============================================================
      // LEADERBOARD / GAMIFICATION
      // TEAM TODO [LEADERBOARD]: Load ranked users from the backend instead of
      // the empty `contributors` array. Ranking should be calculated from real
      // contribution points stored in the database.
      // =============================================================
      h('section', { className: 'section soft', id: 'leaderboard' },
        h('div', { className: 'wrap leaderboard-grid' },
          h('div', null,
            h('p', { className: 'eyebrow' }, '02 / CONTRIBUTE'),
            h('h2', null, 'Helpful shoppers get recognized.'),
            h('p', { className: 'section-copy' },
              'GatorByte uses contribution points and a leaderboard to reward people who consistently share useful deals. The goal is simple: make participation valuable without turning the site into a game.'
            ),
            h('div', { className: 'feature-list' },
              h('div', null, h('span', null, '01'), h('p', null, h('strong', null, 'Submit'), ' a useful deal for the community.')),
              h('div', null, h('span', null, '02'), h('p', null, h('strong', null, 'Earn points'), ' when contributions are useful and trusted.')),
              h('div', null, h('span', null, '03'), h('p', null, h('strong', null, 'Climb the leaderboard'), ' and earn recognition or future rewards.'))
            )
          ),
          h('div', { className: 'leaderboard-card' },
            h('div', { className: 'leaderboard-head' },
              h('strong', null, 'Top contributors'),
              h('span', null, 'Data in progress')
            ),
            ...(contributors.length ? contributors.map((person, index) => h('div', { className: 'leader-row', key: person.name },
              h('span', { className: 'rank' }, index + 1),
              h('div', { className: 'avatar', 'aria-hidden': true }, person.name.charAt(0)),
              h('div', { className: 'leader-name' }, h('strong', null, person.name), h('span', null, `${person.deals} contributions`)),
              h('strong', { className: 'points' }, `${person.points.toLocaleString()} pts`)
            )) : [h('div', { className: 'leader-placeholder', key: 'leader-placeholder' },
              h('strong', null, 'Leaderboard data — in progress'),
              h('p', null, 'Contributor rankings will populate once user accounts and the database are connected.')
            )])
          )
        )
      ),

      // =============================================================
      // HOW IT WORKS / STATIC PROJECT EXPLANATION
      // This section is informational. It does not need database integration.
      // =============================================================
      h('section', { className: 'section', id: 'about' },
        h('div', { className: 'wrap' },
          h('div', { className: 'section-heading' },
            h('div', null,
              h('p', { className: 'eyebrow' }, '03 / HOW IT WORKS'),
              h('h2', null, 'Built around the product you want')
            ),
            h('p', null, 'A simple flow designed to save shoppers time.')
          ),
          h('div', { className: 'how-grid' },
            ...[
              ['1', 'Share a deal', 'Members submit a product link, price, and store so other shoppers can benefit.'],
              ['2', 'Match the product', 'Product details and keywords can be analyzed to help group comparable listings together.'],
              ['3', 'Compare quickly', 'Shoppers search a focused community feed instead of checking every store manually.'],
              ['4', 'Build trust', 'Votes, moderation, and contributor history help surface useful information.']
            ].map(([number, title, text]) => h('div', { className: 'how-card', key: number },
              h('span', null, number),
              h('h3', null, title),
              h('p', null, text)
            ))
          )
        )
      )
    ),

    // =============================================================
    // DEAL SUBMISSION MODAL
    // TEAM TODO [FORM]: Add the actual deal URL field here because GatorByte's
    // planned workflow starts from a user-submitted product/deal link. Other
    // future fields could include expiration date, description, or image URL.
    // The submitDeal() function above is where the form should be sent to API.
    // =============================================================
    formOpen ? h('div', { className: 'modal-backdrop', onMouseDown: (event) => {
      if (event.target === event.currentTarget) setFormOpen(false);
    } },
      h('div', { className: 'modal', role: 'dialog', 'aria-modal': true, 'aria-labelledby': 'submit-title' },
        h('button', { className: 'modal-close', onClick: () => setFormOpen(false), 'aria-label': 'Close' }, '×'),
        h('p', { className: 'eyebrow' }, 'COMMUNITY SUBMISSION'),
        h('h2', { id: 'submit-title' }, 'Submit a deal'),
        h('p', { className: 'modal-copy' }, 'Prototype submission only. Database storage is in progress, so submitted data resets when the page refreshes.'),
        h('form', { className: 'deal-form', onSubmit: submitDeal },
          h('label', null, 'Product name', h('input', { name: 'title', placeholder: 'e.g. Portable Bluetooth Speaker', required: true })),
          h('label', null, 'Store', h('input', { name: 'store', placeholder: 'e.g. Example Store', required: true })),
          h('div', { className: 'form-row' },
            h('label', null, 'Deal price', h('input', { name: 'price', type: 'number', step: '0.01', min: '0.01', placeholder: '39.99', required: true })),
            h('label', null, 'Original price', h('input', { name: 'original', type: 'number', step: '0.01', min: '0.01', placeholder: '59.99' }))
          ),
          h('label', null, 'Category',
            h('select', { name: 'category', defaultValue: 'Electronics' },
              h('option', null, 'Electronics'),
              h('option', null, 'Home & Lifestyle'),
              h('option', null, 'Apparel'),
              h('option', null, 'School & Office'),
              h('option', null, 'Other')
            )
          ),
          h('button', { className: 'button primary form-submit', type: 'submit' }, 'Submit deal')
        )
      )
    ) : null,

    notice ? h('div', { className: 'toast', role: 'status' }, notice) : null,

    // FOOTER: Static navigation; no backend work is required here.
    h('footer', { className: 'footer' },
      h('div', { className: 'wrap footer-inner' },
        h('div', null,
          h('a', { className: 'brand', href: '#top' }, h('span', { className: 'mark', 'aria-hidden': true }, 'G'), h('span', null, 'GatorByte')),
          h('p', null, 'Community-powered shopping, built to save time and money.')
        ),
        h('div', { className: 'footer-links' },
          h('a', { href: '#deals' }, 'Deals'),
          h('a', { href: '#leaderboard' }, 'Leaderboard'),
          h('a', { href: '#about' }, 'How it works')
        ),
        h('span', { className: 'copyright' }, `Prototype · ${new Date().getFullYear()}`)
      )
    )
  );
}

export default App;
