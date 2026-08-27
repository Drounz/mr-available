// Seeds Firestore `products` collection from products.json using the
// Firebase Admin SDK. Run with: npm run seed
//
// Auth: set GOOGLE_APPLICATION_CREDENTIALS to the path of a service
// account key JSON downloaded from Firebase console > Project settings >
// Service accounts > Generate new private key.
const admin = require("firebase-admin");
const products = require("./products.json");

admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

const db = admin.firestore();

async function seed() {
  const batch = db.batch();
  for (const { id, ...data } of products) {
    batch.set(db.collection("products").doc(id), data);
  }
  await batch.commit();
  console.log(`Seeded ${products.length} products.`);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
