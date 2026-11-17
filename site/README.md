# r2-mailbox docs site

A small Astro site that renders the Markdown in [`../docs`](../docs) with the same styling as [hdprajwal.dev](https://hdprajwal.dev). The site has no copy of the docs: edit the files in `docs/` and both GitHub and the site show the change.

```bash
cd site
npm install
npm run dev       # http://localhost:4321
npm run build     # static files in site/dist
```

The landing page is `src/pages/index.astro`; the docs render under `/docs/`, with `docs/README.md` as the overview. Links between docs pages stay as relative `.md` paths, so they work on GitHub. At build time, `src/lib/rehype-doc-links.mjs` turns them into site URLs, and turns links that leave `docs/` into links to the GitHub repo. The sidebar groups and the previous and next order are in `src/lib/nav.ts`; add new pages there.

To deploy on Cloudflare Pages, set the root directory to `site`, the build command to `npm run build`, and the output directory to `dist`. The site is live at https://r2-mailbox.hdprajwal.dev.

## Diagrams

The architecture diagrams follow the [stack-diagram](https://github.com/caru-ini/stack-diagram) style, drawn with the site's own colours and fonts. Each diagram is a spec in `src/lib/diagrams/specs.mjs`: nodes, groups, and edges on a fixed grid. The geometry rules are at the top of that file and of `render.mjs`.

A docs page embeds a diagram with a `<picture data-diagram="id">` block of PNGs, so GitHub shows an image. The site replaces that block with the live diagram, which follows the theme toggle. After you add or change a spec, render the PNGs for GitHub:

```bash
npm run diagrams    # writes docs/images/<id>.png and <id>-dark.png
```

The script uses headless Chrome. Set `CHROME` to the browser's path if it isn't found.
