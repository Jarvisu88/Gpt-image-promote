# GPT-Image-2 Showcase

Static Cloudflare Workers site with:

- `/` redirecting directly to `/gallery/index.html`
- `/gallery/index.html` for the main gallery page

## Structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- data.js
|-- tools/
|   `-- image-generator.html
|-- wrangler.jsonc
`-- gallery/
    |-- index.html
    |-- styles.css
    |-- app.js
    |-- data.js
    `-- vendor/
```

## Deploy With Cloudflare

1. Create a GitHub repository from this directory.
2. Push the code to GitHub.
3. In Cloudflare, open `Workers & Pages`.
4. Choose `Create application`.
5. Choose `Import an existing Git repository`.
6. Select this repository and deploy.

Cloudflare will serve:

- `/` -> redirect to gallery page
- `/gallery/index.html` -> gallery page

## Local Notes

- The root `index.html` immediately redirects to `./gallery/index.html`.
- `wrangler.jsonc` is configured for static asset deployment only.
- If you want a different production project name, update `name` in `wrangler.jsonc`.

## Suggested Git Commands

```bash
git init
git add .
git commit -m "Initial Cloudflare static site"
git branch -M main
git remote add origin <your-github-repo-url>
git push -u origin main
```
