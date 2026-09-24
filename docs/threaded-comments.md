# Threaded comment loading

The post page has an optional branch loading mode in profile settings. It is off by default and stored in this browser's `localStorage` (`threadedComments`). The setting takes effect when a post page is opened; it does not affect feeds or other pages.

In branch mode, `/post/get` returns a lightweight index for the whole post, with IDs, parent IDs, and the initial unread snapshot. The browser loads at most 25 comment bodies per request via `/post/get-comments`. It progressively loads every top-level comment while replies stay collapsed. Each branch has a `+`/`−` control, and long lists of replies can be browsed in pages. A permalink opens the ancestor path and the page containing its target, with that path fetched first. `?new` filters the index to new comments and their ancestors. Loaded comment bodies stay in memory when a branch is collapsed and reopened.

Opening a post calls the existing `/post/read` endpoint and marks the whole post read, including collapsed comments. The index preserves the initial unread snapshot for `?new` and highlighting during that page visit.

The branch controls use the existing `CommentComponent` and its `.answers` container. Tree-line styling in `CommentComponent.module.scss` therefore applies to expanded branches in both modes; collapsed branches have no answer subtree to draw a line for.

Deployment order: deploy the backend, then deploy the frontend. Classic mode and existing API requests keep their previous behavior. No database migration is required.

The repository's `Deployment (Universal)` workflow can deploy to `stage` with its normal flags. This change needs no volume deletion, database restore, manual SQL, Redis flush, or search reindex. It has not been deployed as part of this implementation.

The frontend's `config-overrides.js` locates the webpack `oneOf` rule by its shape because the installed `react-scripts` places it at a different array position for the production build. This keeps the font loader working in both development and production builds.
