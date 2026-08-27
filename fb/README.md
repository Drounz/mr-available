# MR AVAILABLE — Firebase setup

Your site now reads products from Firebase Firestore. Firestore is free to start, does not pause on quiet weeks, and scales later by switching the same project to pay-as-you-go, no rebuild. You manage products in the Firebase console, which is your admin.

Files (drop these into the repo):
- `index.html` — the site, already wired for Firebase.
- `fb/firestore.rules` — security rules.
- `fb/seed/products.json` — your 50 products.
- `fb/seed/seed.js`, `fb/seed/package.json` — one-time loader.

## 1. Turn on Firestore
1. In your Firebase project, open **Build > Firestore Database > Create database**.
2. Choose **Production mode**. Pick a location close to Nigeria (for example, `eur3` or a Europe region).

## 2. Set the security rules
1. In Firestore, open the **Rules** tab.
2. Replace what is there with the contents of `fb/firestore.rules` and **Publish**.
   This lets the public read published products only, and blocks all writes from the browser.

## 3. Load your 50 products
1. Firebase console: **Project settings > Service accounts > Generate new private key**. A JSON file downloads.
2. Save it as `fb/seed/serviceAccountKey.json`. Do not commit this file (a `.gitignore` already excludes it).
3. In a terminal inside `fb/seed`: run `npm install`, then `node seed.js`.
4. You should see "Seeded 50 products". Check **Firestore Database > Data** to see them. This screen is now where you add, edit, price, and hide products.

## 4. Connect the site
1. Firebase console: **Project settings > General**. Under "Your apps", add a **Web app** if you have not (the `</>` icon). Register it, no hosting needed.
2. Copy the `firebaseConfig` values it shows.
3. In `index.html`, paste them into `CONFIG.firebase` (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).

These config values are safe in a public repo. Security is enforced by the Firestore rules, not by hiding the config.

## 5. Deploy
Commit and let Vercel redeploy. The site flips from sample data to your live products.

## Everyday use (your admin)
- **Add a product**: Firestore > Data > add a document in `products`. Use the product code as the document id. Fields: `name`, `category`, `brand`, `selling_price` (number), optionally `model` and `image_url`, and `published` = true.
- **Hide a product**: set `published` to false. It leaves the site, stays in the database.
- **Change a price**: edit `selling_price`.
- **Add a photo**: paste a direct image link into `image_url`.

## Notes
- Cost prices are intentionally NOT stored in Firestore, because Firestore rules protect whole documents, not single fields. Keep your cost and margin records in your central sheet.
- When traffic grows, switch the project to the Blaze (pay-as-you-go) plan. Same project, no migration.
