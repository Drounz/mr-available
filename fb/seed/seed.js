// One-time loader: writes products.json into Firestore.
// Usage:
//   1) Firebase console > Project settings > Service accounts > Generate new private key
//   2) Save that file next to this one as  serviceAccountKey.json  (do NOT commit it)
//   3) npm install
//   4) node seed.js
const admin = require("firebase-admin");
const products = require("./products.json");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

(async () => {
  let batch = db.batch(), n = 0;
  for (const p of products) {
    const { id, ...data } = p;
    batch.set(db.collection("products").doc(id), data);
    if (++n % 400 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  console.log(`Seeded ${products.length} products into Firestore.`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
