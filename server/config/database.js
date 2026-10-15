const { MongoClient, ServerApiVersion } = require("mongodb");
const { normalizeEmail } = require("../utils/helpers");

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error("MONGODB_URI is missing");
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

let db = null;
let dbConnectionPromise = null;

async function connectDB() {
  if (db) {
    return db;
  }

  if (dbConnectionPromise) {
    return dbConnectionPromise;
  }

  dbConnectionPromise = client
    .connect()
    .then(() => {
      db = client.db("trip-swift-db");
      console.log("MongoDB connected successfully to trip-swift-db");
      return db;
    })
    .catch((error) => {
      dbConnectionPromise = null;
      console.error("MongoDB connection failed:", error);
      throw error;
    });

  return dbConnectionPromise;
}

async function getCollections() {
  const database = await connectDB();

  return {
    ticketsCollection: database.collection("tickets"),
    usersCollection: database.collection("user"),
    bookingsCollection: database.collection("bookings"),
    paymentsCollection: database.collection("payments"),
    contactMessagesCollection: database.collection("contactMessages"),
  };
}

async function getFraudVendorEmails(usersCollection) {
  const fraudVendors = await usersCollection
    .find(
      {
        role: "vendor",
        isFraud: true,
      },
      {
        projection: {
          email: 1,
        },
      },
    )
    .toArray();

  return fraudVendors.map((user) => normalizeEmail(user.email)).filter(Boolean);
}

module.exports = {
  client,
  connectDB,
  getCollections,
  getFraudVendorEmails,
};
