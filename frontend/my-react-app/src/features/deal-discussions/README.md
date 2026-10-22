# Deal discussions

This feature owns the separate product/comment tab. Keep its implementation in
this directory and `server/features/deal-discussions/` when reviewing or merging
changes.

## Boundaries

- `deal.html` loads `main.jsx` into `#deal-root`. The feature owns its page reset,
  styles, product layout, comments, replies, voting, and local preview storage.
  It must not import the main app's `App.jsx`, `App.css`, or `index.css`.
- `integration.js` is the main app's public interface: `dealPath`,
  `DEAL_PREVIEW_PATH`, `loadDealPreview`, and `enrichDealRecord`. Keep it free of
  UI and stylesheet imports. The main app uses it for navigation, product-card
  metadata, and submission enrichment.
- `data/deals.js` connects to the shared `src/firebase.js` configuration. Generic
  URL validation lives in `src/shared/urls.js`.
- `server/features/deal-discussions/` owns product metadata, the Amazon thumbnail
  fallback, route handling, and backend tests. Other server code uses its
  `index.js` interface.

The deliberate shared contracts are the Firestore `deals` schema, Firebase
configuration, shared URL validation, package dependencies, `vite.config.js`,
`server/index.js`, and the main app's integration calls. Changes to these require
checking both pages.

Keep `/deals/<id>`, `/preview/deal`, and `/api/deal-preview` compatible. Preserve
the comment storage key `gatorbyte:comment-preview:v1:<dealId>` or provide a
migration; comments currently stay in the browser and do not require sign-in.

## Verification

Run from `frontend/my-react-app`:

```sh
npm run build
npm run lint
npm run test:server
npm run check:isolation
```

Check that the built deal entry loads its own styles without the main page's
styles. Verify direct deal URLs, an existing Amazon deal thumbnail, and comment
replies/votes after changing a shared contract.

## Git workflow

Work is on `feature/deal-discussions`. Separate files and entry points reduce
overlap with unrelated changes; they do not make files immune to `git pull`.
A pull that changes this feature or a shared contract can still affect it.
Review those paths deliberately and preserve the module boundary during merges.
Do not use `.gitignore` or `skip-worktree` to hide tracked feature code.

The repository's `.github/workflows/deal-discussions.yml` runs these checks for
pull requests affecting this app once the workflow is pushed. Repository owners
can require its status check in branch protection; this change does not alter
repository settings or prevent someone from deliberately changing the feature.
