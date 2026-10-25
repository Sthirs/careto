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

### Dishes

- The dishes section is a collection of dishes.
- Each user of the list can add, edit and delete dishes.
- Each dish has a name, an image (optional), and a list of ingredients.
- A dish can be added to the list, and the ingredients of the dish will be added to the list.
- A dish can be put in pause until a specific date, that dish will not be proposed to the list until that date.
- Dishes keep information of the last time the user added them to the list.

### Week plan

- The week plan section is a collection of days.
- Each day has two slots: lunch and dinner dishes.
- A slot can be empty or can have a dish assigned to it.
- The day before the shopping day, a week plan is proposed to the user, and the user can accept or modify it.
- When the user accepts the week plan, the ingredients of the dishes assigned to the slots are added to the list.
- Dishes are proposed based on rotation and the last time they were added to the list.

### List Settings

- The day on which the shopping is made can be set.
- Name and image of the list can be updated.
- The user can define for each day of the week if there should be one or two slots.
- The user can sort the store sections in the list.

### Learning and Planning

- Learning estimates when each recurring product runs out and which dishes the user likes.
- Planning proposes the week's menu and turns menu plus due products into the shopping list.
- Each product can have two independent demands: a base consumption, with a learned frequency, and the consumption of planned dishes, known from the menu. On the list they become a single item; the reason behind each purchase decides what the system learns.
  - Base consumption. What gets used regardless of the menu: yogurt for breakfast, fruit, bread. Only recurring products have it.
  - Dish consumption. The quantity written in the dish's ingredient. It is deterministic: if the dish is on the menu, it is needed.
- Each recurring product has an interval in days, corrected only by the user's signals: manual additions and "have it". Purchases made on the system's proposal do not measure how long a product lasts.

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
