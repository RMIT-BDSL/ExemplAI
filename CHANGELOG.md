## [0.6.1] - 2026-06-29

### ⚙️ Miscellaneous Tasks

- Disable redundant production build and deploy in workflow
## [0.6.0] - 2026-06-29

### 🚀 Features

- Cloudflare deploy on pull request and on push to main (#18)
## [0.5.0] - 2026-06-28

### 🚀 Features

- Initialize new solidstart project
- Admin dashboard with authentication and dashboard mock
- Initial invitation code creation
- Redesigned dashboard for ux and ui
- Course status
- Navigation bar for user
- Added button to ask ai when test got error.

### 🐛 Bug Fixes

- Web not working
- *(admin)* Stuck on loading screen after authentication
- *(ui)* Invisible button label when student currently doing the application

### 🚜 Refactor

- Moved authentication logic to web instead of admin

### ⚙️ Miscellaneous Tasks

- Convex's generated schema
## [0.4.0] - 2026-06-28

### 🚀 Features

- *(ai)* Add stub route for chat
- Ai chat now returns mock message
- *(ai)* Returns langgraph mock message from chatting
- *(ai)* Chat with OpenAI when asking programming question
- Add handling exception to chat route

### ⚙️ Miscellaneous Tasks

- Initial schema for ai message
- *(server)* Update configuration instruction
- Add timeout
- Instruction cleanup
- Cleanup code
## [0.3.0] - 2026-06-27

### 🚀 Features

- Add tracking to generated folder
## [0.2.1] - 2026-06-27

### ⚙️ Miscellaneous Tasks

- Ignore node_modules and dist at any depth
## [0.2.0] - 2026-06-23

### 🚀 Features

- Configure telemetry for data collection
- *(server)* Initial sentry implementation for observability
- *(server)* Count student code execution number
- Add rapidapi support for judge0
- *(server)* Improve Judge0 code execution service with FastAPI and rate limiting

### ⚙️ Miscellaneous Tasks

- Stop logging client side
- Add validation for empty configuration
## [0.1.6] - 2026-06-21

### 🚀 Features

- Initial posthog observability

### 🐛 Bug Fixes

- Authentication not working after registration
## [0.1.5] - 2026-06-21

### 🐛 Bug Fixes

- Issues that relevant to websites stability and security. (#5)
## [0.1.4] - 2026-06-21

### ⚙️ Miscellaneous Tasks

- Update the changelog release pipeline
## [0.1.3] - 2026-06-21

### ⚙️ Miscellaneous Tasks

- Duplicate changelog update
- *(release)* Update CHANGELOG.md for 0.1.3 [skip ci]
## [0.1.2] - 2026-06-21

### ⚙️ Miscellaneous Tasks

- Include only the latest change in release and update changelog .md each commit.
- *(release)* Bump version to 0.1.2 [skip ci]
## [0.1.1] - 2026-06-21

### ⚙️ Miscellaneous Tasks

- Add .env to gitignore
## [0.1.0] - 2026-06-21

### 🚀 Features

- Initial website design
- Python code execution, and backend for website.
- Improved design for the IDE with terminal.
- Implement student problem view layout
- *(web)* Update default configuration example
- Removed autosaved pill
- *(web)* Changed problem location to left and collapse chat ui by default.
- A new homepage with user info and question list throughout the weeks.
- Integrate Convex for backend data management and add loading states to course list
- Implement authentication UI components and route structure
- *(auth)* Magic link with better-auth
- Invitation code system for the application

### 🐛 Bug Fixes

- Css styles
- Authentication button not working
- *(ci)* Not running.
- Tailwind styling
- Problem id not present.

### 🚜 Refactor

- Splitting editor into smaller components
- Moved coding page to course endpoint

### 🧪 Testing

- *(web)* Add api check for code execution testing

### ⚙️ Miscellaneous Tasks

- Replace custom markdown parser to react-markdown.
- Using git-cliff for version bumping
- Additional variable for better auth configuration
- Update environment variable configuration instruction
- Fix broken workflow
- Disable version preview to prevent spammy
- Update checkouts action
- Update broken ci
