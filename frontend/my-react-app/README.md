# GatorByte

## Run locally

From `frontend/my-react-app`:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The React app uses its original green,
off-white, and white palette with a compact, vertically scrolling deals list.

- `/` (also `/deals`) is the searchable **All deals** list.
- `/leaderboard` is the separate **Top users / Top deals** leaderboard.
- `/wishlist` shows only the signed-in user's saved deals, using the same searchable
  list as the deals page, with a **Remove** button beside each item.
- `/submit` is **Add a Deal**, with only deal inputs and no collection selector.
- Clicking a deal opens `/deals/<document-id>` in the current tab with its
  product details and comments.

The list shows all approved Firestore deals in rows with their thumbnail, title,
store, submission date, submitter name, available price, and upvote count. Submitter
names come from the matching Firestore user profile (`username`, `name`, or `displayName`);
unassigned or missing profiles show **Unknown user**. It uses normal document
scrolling and sorts by newest, most upvoted, or price. Missing prices sort last.
Search also includes metadata after it loads. There are no ads, sponsored rows,
feedback widgets, invented activity counters, or unsupported filter controls.

Home-page components live in `src/home/`; the submission form lives in
`src/pages/RecordPage.jsx`. The previous `DealCarousel` files remain in the
repository but are not imported by the home page. Product preview lookups remain
cached, lazy, cancellable, and limited to three concurrent requests.

## Accounts and submission permissions

The header provides Google and email/password login. New accounts receive
`userState: 0`. Signing in again preserves existing roles and profile dates.
To assign a role in Firebase Console, set the numeric field `userState` on
`users/<Firebase Auth UID>` to `0` for Member, `1` for Admin, or `2` for Owner.
The legacy `userStatus` field is used only when `userState` is absent. Invalid
roles default to Member.

| Role | Add a Deal inputs |
| --- | --- |
| User (`0`) | Deal link |
| Admin (`1`) | Deal link and approval status |
| Owner (`2`) | Deal link, approval status, submission/approval dates, submitter ID, upvotes |

Regular submissions automatically use the current account ID, current submission
time, zero upvotes, and pending approval. Pending deals do not appear in the public
approved-deals list. Approved admin submissions receive the current approval time.
Owner overrides are optional. Product metadata is retrieved from the link.

Signed-in admins and owners can permanently delete listings from Deals or a
deal detail page after confirmation. Firestore verifies the account's role.

Each deal row has an **Add to wishlist** button. Saved items show **Saved**, and
repeated saves reuse the same Firestore document instead of making duplicates.
Wishlist has no submission form: all roles see their own saved deals and can remove
them without deleting the original deal. The deal ID, title, link, account ID, and
save time are recorded automatically. Live deal data supplies the current price,
thumbnail, upvotes, and submitter name. Older saved links remain readable and
removable. Personal wishlist access uses the Firebase Auth UID.

`firestore.rules` enforces these permissions, prevents users from promoting their
own role, and restricts wishlist reads to the owning account (or a site owner).
These repository rules must be published to the intended Firebase project before
they enforce access on the live database. The UI alone is not database enforcement.
From this directory, with Firebase CLI installed and authenticated, publish only
the rules using the explicit project ID:

```sh
firebase deploy --only firestore:rules --project <your-project-id>
```

No live rules or database records are changed by local development or the tests.

To test the rules locally, install Java 21 or newer, then run these PowerShell
commands from `frontend/my-react-app`. Test tools are installed in a temporary
directory; the emulator uses the demo project and does not require Firebase login.

```powershell
$rulesTools = Join-Path $env:TEMP 'gatorbyte-rules-tools'
npm install --prefix $rulesTools --package-lock=false --no-audit --no-fund firebase-tools @firebase/rules-unit-testing firebase
$env:RULES_TEST_DEPENDENCIES = $rulesTools
& (Join-Path $rulesTools 'node_modules/.bin/firebase.cmd') emulators:exec --only firestore --project demo-gatorbyte --config firebase.json 'node scripts/test-firestore-rules.mjs'
Remove-Item Env:RULES_TEST_DEPENDENCIES
```

## PBI #12: Deal discussion shell

The deal detail page (`deal.html`) has its own entry, styles,
and modules in `src/features/deal-discussions/`. Its server code lives in
`server/features/deal-discussions/`. The main app calls only the feature's
`integration.js` interface. See the [feature maintenance guide](src/features/deal-discussions/README.md)
for boundaries, shared contracts, and merge guidance. After building, run
`npm run check:isolation` to verify that the built entries do not share styles
and that the deal page does not depend on the main app's components or CSS.

Visit `/preview/deal` for a sample product page, or open a real deal from the
home-page list or **Top deals** leaderboard.

After a Git pull or stash restore that changes Vite configuration or server
modules, stop the old dev server with Ctrl+C and restart `npm run dev`.
Use the port printed by that terminal. Starting another server while the old
one is running can leave an outdated server on 5173 and a second one on 5174.

The shell includes a desktop product panel on the left and a scrollable comment
panel on the right, with a composer at the bottom. On mobile the panels stack.
Replies are collapsed by default and can be expanded. Comments support exclusive
upvotes/downvotes, delete confirmation, and pins. Clicking a selected vote clears
it; switching directions changes the score by two. Existing saved likes migrate
to votes without removing comments. New comments appear as
**You**. Signed-in admins and owners can pin and moderate comments in their browser.
Deleting a comment leaves its replies intact. Discussions start empty and each
deal's comments are saved in this browser's local storage.

The main app supports Google and email/password authentication through
`src/login/`. The deal comments remain a local preview with no shared comment
database or enforced account/admin permissions. Existing deals are read from
Firestore; comment actions never write to Firestore. Optional saved deal
fields `title`, `description`, `imageUrl`, `price`, and `currency` populate the
product layout. Shared comments and enforced comment permissions are future work.

## Product thumbnails

Submitting a deal link looks up its title, thumbnail, description, and available
price through the same-origin `/api/deal-preview?url=...` endpoint. Submission
saves available metadata with the deal, and older link-only deals look it up
when opened. Images appear in product rows and the final product page, with
no image field or thumbnail preview in the submission form. Images are retrieved
automatically from the submitted link; users do not upload photos or enter
image URLs. For Amazon product links, the server can also retrieve a thumbnail
from Amazon's public image CDN using the product ASIN when the product page
doesn't provide an image. It validates the returned image and rejects missing
or tiny placeholder images. Thumbnail lookup is still best effort: retailers
may block requests or omit product metadata, and some products have no public
thumbnail. A failed lookup never prevents saving the link.

The endpoint runs with both `npm run dev` and `npm run preview`. For production,
run `npm run build` then `npm start` to serve `dist` and the metadata API together
(set `PORT` as needed). Static hosting alone cannot run the API; it needs the
included Node server or an equivalent server endpoint. The server only requests
public HTTP(S) addresses and validates redirects, response sizes, and timeouts.
Run `npm run test:server` for the metadata endpoint tests.

Custom hosting must route `/deals/<id>` and `/preview/deal` to `deal.html`, and
`/deals`, `/submit`, `/leaderboard`, and `/wishlist` to `index.html`.
The included development, preview, and production
servers already handle these routes. Static hosting also needs a backend for
product metadata.

Issue draft (the GitHub connector did not have permission to create the issue):
**PBI #12: Deal detail page and comment UI prototype**. Acceptance criteria are a
deal detail page, side-by-side product/comment layout, local comment/reply/vote
interactions, with posting available to guests and moderation controls for admins and owners.

## Original template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
