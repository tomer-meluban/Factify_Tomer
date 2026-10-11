# Tomer Factify

Interactive presentation and prototype for the Factify design exercise "From mess to truth". It is a static site with no build step and no server code.

```
index.html          page and markup
js/app.js           prototype logic
js/runtime.js       small renderer that drives the markup
js/morphdom.min.js  DOM-patching library (MIT)
assets/             images and logos
```

## Publish with GitHub Pages
1. Create a new repository on GitHub, for example `tomer-factify`.
2. Push the contents of this folder to the repository root:
   ```
   cd tomer-factify
   git init
   git add .
   git commit -m "Tomer Factify prototype"
   git branch -M main
   git remote add origin https://github.com/<your-username>/tomer-factify.git
   git push -u origin main
   ```
   Or drag the files into the repository page on github.com ("Add file" > "Upload files").
3. Repository **Settings > Pages > Build and deployment**: Source "Deploy from a branch", branch `main`, folder `/ (root)`, Save.
4. After a minute or two the site is live at `https://<your-username>.github.io/tomer-factify/`.

Netlify and Vercel also work: drag the folder onto https://app.netlify.com/drop.

## Preview locally
Double-clicking `index.html` mostly works, but the browser blocks one logo shimmer effect from `file://`. Run a local server instead:
```
python3 -m http.server 8000
```
and open http://localhost:8000.

## Using it
- Opens on slide 1. ← and → move between slides; "Go to Prototype" (slide 1) or "Enter" (last slide) opens the prototype through the loader.
- In the prototype, ← returns to the last slide; "Replay Prototype" restarts it and "Presentation Start" goes back to slide 1.
- The 1920×1080 stage scales to fit any window. Fonts load from Google Fonts.
