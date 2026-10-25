# GatorByte

## Run locally

From `frontend/my-react-app`:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The original landing-page layout now runs
inside the React app and uses the same green and off-white styling as the
record form and deal page.

- `/` is the home page: one searchable **All deals** carousel above the leaderboard.
- `/submit` contains only the record input form. **Submit a record** opens it.
- Clicking a deal opens `/deals/<document-id>` in a separate tab with its
  product details and comments.

The carousel shows all approved Firestore deals. The carousel advances
every five seconds when its contents overflow, wraps to the start, and supports
manual scrolling and previous/next controls. Rotation pauses during interaction
and honors reduced-motion settings. Home-page components live in `src/home/`;
the submission form lives in `src/pages/RecordPage.jsx`.

## PBI #12: Deal discussion shell

The deal tab is an independent page (`deal.html`) with its own entry, styles,
and modules in `src/features/deal-discussions/`. Its server code lives in
`server/features/deal-discussions/`. The main app calls only the feature's
`integration.js` interface. See the [feature maintenance guide](src/features/deal-discussions/README.md)
for boundaries, shared contracts, and merge guidance. After building, run
`npm run check:isolation` to verify that the built entries do not share styles
and that the deal page does not depend on the main app's components or CSS.

Visit `/preview/deal` for a sample product page, or open a real deal from the
home-page carousel or **Top deals** leaderboard.

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
**You**. Switch **Preview role** to **Admin** to try deleting other comments and
pinning/unpinning. Deleting a comment leaves its replies intact. Sample comments
are labeled, and each deal's preview changes are saved in this browser's local
storage. These controls are demonstrations, not real access control.

This version adds no sign-in or shared comment database. Existing deals are read
from Firestore; comment actions never write to Firestore. Optional saved deal
fields `title`, `description`, `imageUrl`, `price`, and `currency` populate the
product layout. Real accounts, shared comments, and enforced admin permissions
are future work.

## Product thumbnails

Submitting a deal link looks up its title, thumbnail, description, and available
price through the same-origin `/api/deal-preview?url=...` endpoint. Submission
saves available metadata with the deal, and older link-only deals look it up
when opened. Images appear on product cards and the final product page, with
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
`/submit` to `index.html`. The included development, preview, and production
servers already handle these routes. Static hosting also needs a backend for
product metadata.

Issue draft (the GitHub connector did not have permission to create the issue):
**PBI #12: Deal detail page and comment UI prototype**. Acceptance criteria are a
new-tab deal page, side-by-side product/comment layout, local comment/reply/vote
interactions, member/admin preview controls, and no sign-in requirement.

## Original template notes

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.
