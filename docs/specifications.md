# Careto

Careto is an application that autofill the grocery list based on the user's preferences and previous shopping habits.

## Features

- The application is multilingual and supports English and Italian.
- Users can create an account and sign in to the application.
- Users can sign in with any OIDC provider (for example Google).
- The application is organized shopping list.
- Users can create shopping lists and invite other users to join via email. A shopping list member can invite any user by email (whether or not that user has registered yet). The invitation is keyed by the email address and is visible to the invitee as a pending invitation card in their shopping list. The invitee's display name and id are NOT shared with the inviter or the list until the invitee accepts. The invitee can accept or decline. On accept the invitee becomes a member and their display name appears in the list. The inviter can cancel an unaccepted invitation. The pending-invitations section of the shopping list is hidden entirely when the user has no pending invitations.
- A list can have multiple users, and each user can belong to multiple lists.
- A list has a name and an image that can be updated by its members.
- Each shopping list has the list, dishes, week plan, and list settings sections.
- The app opens to the last shopping list the user was viewing, or to the lists overview if the user has no lists.
- The app must work offline and sync when the connection is restored.

### List

- The shopping list is a collection of items that the user wants to buy.
- Each item has a name and an icon.
- Each item is part of a store section.
- Items are sorted by store section.
- Each user of the list can add, remove or mark items as bought.
- The list has all the items that the user wants to buy, and the user can check off items as they are bought.
- The bought items are moved to the bottom of the list and can be hidden or shown.
- An item can be marked as bough or removed for the list, they are different actions.
- The items can be added by the user, by the dishes, or by the recurrent logic.
- The item keep the information on how it has been added to the list.
- Items keep information of the last time the user bought them.
- The application ships a default catalog of common items, grouped by store section and translated into every supported language. Any list can use any default item.
- A user can also add a custom item, typed by name. A custom item belongs only to the list it was created in and is filed under an "Own items" store section.
- Adding an item starts from a search that matches, in the user's language, the default catalog and the custom items of that list; when nothing matches exactly, the typed text can be added as a new custom item.
- An item appears at most once in a list: adding an item that is already in the list (bought or not) puts it back among the items to buy.
- Within a store section, items are sorted alphabetically by their name in the user's language. Each list can have its own order of store sections; a list that never reordered them uses the default order.
- Bought items are shown in a collapsible "Last used" section, most recently bought first; tapping one puts it back among the items to buy.
- Swiping an item to the left removes it from the list.
- Each item to buy has a menu to remove it from the list, change its icon, or move it to another store section. The chosen icon and section belong to that item in that list: they show wherever the item appears in that list, including the search and the ingredients of its dishes, and they are kept when the item is removed from the list and added again.

### Dishes

- The dishes section is a collection of dishes.
- Each user of the list can add, edit and delete dishes.
- Each dish has a name, an image (optional), and a list of ingredients.
- A dish can be added to the list, and the ingredients of the dish will be added to the list.
- A dish can be put in pause until a specific date, that dish will not be proposed to the list until that date.
- Dishes keep information of the last time the user added them to the list.
- A dish needs a name and at least one ingredient. Ingredients are chosen from the same search as list items: default catalog items or the list's custom items.
- The dishes screen always shows an "In the list" and a "Suggested" section, each with a short text when it holds no dish; a "Paused" section appears only when a dish is paused.
- A dish is in the list while at least one of its ingredients is still to buy because the dish was added. When all of them are bought or removed, the dish goes back to the suggested dishes on its own.
- Adding an item to the list by hand never puts a dish in the list.
- Taking a dish off the list removes the ingredients it added that are still to buy and that no other dish needs; items added by hand stay.
- Putting a bought ingredient back to buy right after buying it (a mistaken tap) puts its dish back in the list; putting it back later from "Last used" counts as adding it by hand.
- Suggested dishes are those neither in the list nor paused, the least recently added first.
- Deleting a dish keeps on the list the items it added.

### Week plan

- The week plan section is a collection of days.
- Each day has two slots: lunch and dinner dishes.
- A slot can be empty or can have a dish assigned to it.
- The day before the shopping day, a week plan is proposed to the user, and the user can accept or modify it.
- When the user accepts the week plan, the ingredients of the dishes assigned to the slots are added to the list.
- Dishes are proposed based on rotation and the last time they were added to the list.
- A list has one week plan, shared by all its members. Slots belong to a day of the week (Monday to Sunday), not to a date.
- The user picks the dish of a slot from the list's dishes, and can search them by name. A slot's dish can be changed or removed.
- Adding the week plan to the list adds the ingredients of every planned dish, as adding each dish would. The plan stays as it is, so the menu can still be read during the week.
- Starting a new plan empties every slot, for all members; it never changes the list. Starting a new plan can be undone.
- Deleting a dish empties the slots it was planned in.

### List Settings

- The day on which the shopping is made can be set.
- Name and image of the list can be updated.
- The user can define for each day of the week if there should be one or two slots.
- The user can sort the store sections in the list by dragging them into the order they walk through the shop, and can reset them to the default order. The "Own items" section always comes last.

### Learning and Planning

- Learning estimates when each recurring product runs out and which dishes the user likes.
- Planning proposes the week's menu and turns menu plus due products into the shopping list.
- Each product can have two independent demands: a base consumption, with a learned frequency, and the consumption of planned dishes, known from the menu. On the list they become a single item; the reason behind each purchase decides what the system learns.
  - Base consumption. What gets used regardless of the menu: yogurt for breakfast, fruit, bread. Only recurring products have it.
  - Dish consumption. The quantity written in the dish's ingredient. It is deterministic: if the dish is on the menu, it is needed.
- Each recurring product has an interval in days, corrected only by the user's signals: manual additions and "have it". Purchases made on the system's proposal do not measure how long a product lasts.
- The list keeps the history of its items: every add, purchase, undo of a mistaken purchase and removal, with the reason the item was to buy (added by hand, for a dish, or by the system), the member who acted, and when.
- A product's stock lasts from a purchase not made for a dish until the first time a member adds it again by hand; putting it back from "Last used" counts as adding it by hand. That time counts only once that add is bought.
- Adding by hand a product the automatic planner already put on the list does not measure its stock: it is still a purchase made on the system's proposal.
- Removing an item that is still to buy means the product is not finished yet. It cancels the hand add being measured and holds the product back: the system does not add it again until its next purchase.
- A product becomes recurring once its stock has been measured at least twice. Its interval is the median of the last eight measures, in whole days, at least one.
- As soon as a recurring product is due (its interval has passed since its last purchase, and it is neither to buy nor held back), the system adds it to the list on its own, even when no member opens the app. The list shows such items as added by the automatic planner.

## Architecture

- It is a web application that can be installed as a PWA on mobile and desktop.
- It is primarily designed for mobile devices, but it also works well on desktop devices.
- It is composed of a frontend, a backend, and a database.
- The frontend and the backend communicate through a REST API.
- It supports local authentication and authentication via OAuth2.
- It is cloud native and can be deployed to a Kubernetes cluster through a Helm chart.

### Frontend

- The frontend is built with Vue.js 3 and TypeScript.
- Vue components are written using the Composition API and the `script setup` syntax.
- Styling is primarily implemented with Tailwind CSS, and any component-specific styles are scoped to avoid conflicts.
- It uses Pinia for state management and Vue Router for routing.
- It uses Axios for HTTP communication with the backend.
- It is designed to be responsive and to work well on both mobile and desktop devices.
- It is designed to be accessible and to follow WCAG guidelines.
- It is designed to be performant and uses lazy loading and code splitting to reduce the initial load time.
- It uses PWA features to allow users to install the application on their devices and use it offline.
- It uses a custom service worker (built with Workbox's `injectManifest` strategy) that owns asset precaching, the `/api/` navigation denylist, and the push and notification-click handlers used to deliver OS-level notifications.
- When a new application version is detected, the client automatically clears all cached assets and service workers and reloads once, keeping the user signed in.
- The Account screen displays the version of the deployed application.
- It uses Vite as the build tool to provide a fast development experience and an optimized production build.
- It uses ESLint and Prettier to maintain a consistent code style and catch potential issues early in the development process.
- It uses Vitest and Vue Test Utils for unit testing, and Playwright for end-to-end testing to ensure the quality of the code and the functionality of the application.
- It has a dedicated Dockerfile to build the frontend as a microservice that can be deployed in a Kubernetes cluster.

### Backend

- The backend is built with Node.js and TypeScript.
- It exposes a REST API that the frontend can consume to perform CRUD operations on the data.
- It handles user authentication and authorization.
- It implements the Authorization Code + PKCE flow for OAuth2 authentication and also supports local authentication using email and password.
- It uses Express.js as the web framework and TypeORM as the ORM to interact with the database.
- It is designed to be scalable and to handle a large number of requests.
- It has a dedicated Dockerfile to build the backend as a microservice that can be deployed in a Kubernetes cluster.
- The business logic is separated from the API routes and the database access layer, following clean architecture principles.
- It uses ESLint and Prettier to maintain a consistent code style and catch potential issues early in the development process.
- It uses Vitest for unit testing and Supertest for integration testing to ensure the quality of the code and the functionality of the API.
- It protects the API with a global per-IP rate limiter based on `express-rate-limit`, allowing 500 requests per IP per 5-minute window by default, configurable via the `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_LIMIT` environment variables and Helm values, with the health endpoint exempt.
- It delivers OS-level push notifications for ledger and invitation events using the Web Push protocol with VAPID, via the `web-push` package; the feature degrades to a no-op when VAPID keys are not configured.

### Database

- The database is PostgreSQL.
- In production, the database is provisioned separately and is not part of the application deployment.
- In development, a PostgreSQL instance can be run locally inside the Minikube cluster.

### Deployment

- The application can be deployed to a Kubernetes cluster using a Helm chart.
- The Helm chart defines the deployment of the frontend and the backend as separate microservices and includes the required resources, such as ConfigMaps and Secrets for database connectivity.
- The database is not deployed by the Helm chart and must be provisioned separately. The chart assumes that the database is already available and that connection details are provided through `values.yaml`.

### Development

- To run the application in development mode, Minikube can be used to create a local Kubernetes cluster and the Helm chart can be used to deploy the application to that cluster.
- Telepresence can be used to run the frontend and the backend locally while they still communicate with the other services running in the cluster, enabling a seamless development experience.
- Helper scripts are provided to simplify the development workflow, such as installing dependencies, building the frontend and backend, and deploying the application to the cluster.

### CI

- The application uses GitHub Actions for continuous integration.
- The CI pipeline runs on every push to the `main` branch and on every pull request.
- The CI pipeline includes the following steps:
  - **Linting**: run ESLint to check for code style issues and potential bugs in the codebase.
  - **Testing**: run Vitest and Supertest for backend unit and integration tests, and Vitest and Playwright for frontend unit and end-to-end tests.
  - **Building**: build the frontend and the backend using their respective Dockerfiles to ensure that the application can be built successfully and that the Docker images are created without issues.
