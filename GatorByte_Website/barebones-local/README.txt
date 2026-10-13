GATORBYTE LOCAL PROTOTYPE

How to run:
1. Open this folder in VS Code (File > Open Folder).
2. Double-click index.html in Windows File Explorer, or right-click index.html in VS Code and open it in a browser.
3. No installation, npm, or web hosting is required.

What this prototype includes:
- GatorByte branding and project vision
- Deal feed placeholder ready for database/API data
- Save/wishlist prototype interaction (local only)
- Community upvote prototype interaction (local only)
- Deal submission modal (local demo only; resets on refresh)
- Contributor leaderboard placeholder and gamification explanation
- "How it works" section describing community submissions and product matching
- Light/dark theme
- Responsive desktop/mobile layout

Files:
- index.html       Page shell
- app.js           React UI and local demo interactions
- styles.css       Styling and responsive layout
- react.min.js     Local React library
- react-dom.min.js Local React DOM library

Important:
This is still a frontend-only prototype. The real GatorByte project would later connect the React frontend to a Python backend, central MySQL database, authentication, moderation tools, and a Gemini/API integration.


TEAM IMPLEMENTATION GUIDE
-------------------------
Open app.js and search for "TEAM TODO". Comments mark the intended locations for:
- Database/API deal loading
- Deal submission
- User authentication
- Wishlist persistence
- Upvote persistence
- Leaderboard/gamification
- Gemini/LLM integration
- Admin moderation
- Search/filtering
- Live site statistics

Suggested data flow:
React frontend -> HTTP/JSON -> Python Flask/FastAPI backend -> MySQL database
                                      |
                                      -> Gemini API

Important: Gemini/API keys and database credentials should stay in the backend
(or environment variables), never inside app.js or other browser-visible code.

Possible starter API routes:
GET    /api/deals
POST   /api/deals
GET    /api/leaderboard
POST   /api/wishlist/:dealId
DELETE /api/wishlist/:dealId
POST   /api/deals/:dealId/vote
POST   /api/register
POST   /api/login
PATCH  /api/deals/:dealId/approve
PATCH  /api/deals/:dealId/deny
