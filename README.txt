
CHEMISTRY WITH SHANE — READY-TO-UPLOAD BUNDLE
=============================================

Structure:
  /index.html           -> Home (landing page, branded)
  /titration/index.html -> Titration Tool (paste your existing app into the marked area)
  /hub/index.html       -> Classroom Hub (fully working, branded)
  /404.html             -> Helpful not-found page

Deploy (GitHub Web UI):
1) Open your repo on GitHub -> Add file -> Upload files.
2) Drag the contents of this bundle into the repo root and Commit.
3) Settings -> Pages: Source = Deploy from a branch; Branch = main; Folder = /(root).
4) Visit:
   - Home:         https://<user>.github.io/<repo>/
   - Titration:    https://<user>.github.io/<repo>/titration/
   - Classroom Hub:https://<user>.github.io/<repo>/hub/

Move your titration app:
- Open /titration/index.html and paste your tool where marked.
- If it references extra .css/.js files, upload them into /titration/ and keep paths consistent.

Notes:
- All files are standalone (no build step). Colours and header match across pages.
- Hard refresh (Ctrl/Cmd+Shift+R) if updates don't appear immediately.
