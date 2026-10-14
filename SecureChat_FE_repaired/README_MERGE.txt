# SecureChat FE merge

This package merges the reference UI (File mới.zip) into the main FE package (FE.zip), retaining the main FE's additional pages and modules.

## Apply
1. Back up your current `Frontend` folder.
2. Extract this ZIP; its contents are the contents of `Frontend`.
3. Copy/replace these files in the main project's `Frontend` folder. Do not copy this ZIP into the repo as a nested folder.
4. Start the backend from `Secure_chat\Backend` with `npm start`.
5. Open `http://127.0.0.1:3000/` (NOT Live Server port 5501). Backend serves the Frontend folder and this avoids CORS between ports.
6. Hard refresh with Ctrl+F5.

## Notes
- The reference design is used as `index.html`; profile pane starts hidden and is toggled with the three-dot control.
- Auth endpoint paths were aligned with the route paths shown in the project's `auth.routes.js`.
- Chat APIs differ between the reference prototype and the main backend. This package redirects conversation list/history/create/send calls to the main project's `/api/messages` routes where the provided code indicates those routes exist. Features not exposed by the current backend (SSE notifications, call signaling, reports) may need backend support.
- Test login, registration/OTP, friend list, chat history, sending, and encryption after applying. Keep your backup until these pass.


Repair note: CSS, JS, and avatar asset paths are relative, so the design also loads when previewed from a nested Live Server URL. The API client targets port 3000 when the page is not served from that port. If using Live Server, Backend/server.js must allow origin http://127.0.0.1:5501 and http://localhost:5501. Prefer http://127.0.0.1:3000/ after copying these files into the actual Frontend folder.
