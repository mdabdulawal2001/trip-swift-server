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

const collectionValidators = {
  tickets: {
    $jsonSchema: {
      bsonType: "object",
      required: ["title", "operator", "from", "to", "type", "price", "quantity", "departure", "date", "departureDateTime", "image", "description", "vendorEmail", "status", "advertised", "createdAt", "updatedAt"],
      properties: {
        title: { bsonType: "string", minLength: 1 },
        operator: { bsonType: "string", minLength: 1 },
        from: { bsonType: "string", minLength: 1 },
        to: { bsonType: "string", minLength: 1 },
        type: { bsonType: "string", minLength: 1 },
        price: { bsonType: ["double", "int", "long", "decimal"], minimum: 0.01 },
        quantity: { bsonType: ["int", "long"], minimum: 0 },
        departure: { bsonType: "string", minLength: 1 },
        date: { bsonType: "string", minLength: 1 },
        departureDateTime: { bsonType: ["date", "string"] },
        image: { bsonType: "string", minLength: 1 },
        images: { bsonType: "array", items: { bsonType: "string" } },
        perks: { bsonType: "array", items: { bsonType: "string" } },
        description: { bsonType: "string", minLength: 1 },
        vendorEmail: { bsonType: "string", minLength: 1 },
        status: { enum: ["pending", "approved", "rejected"] },
        advertised: { bsonType: "bool" },
        advertisedAt: { bsonType: ["date", "null"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
  bookings: {
    $jsonSchema: {
      bsonType: "object",
      required: ["ticketId", "userName", "userEmail", "vendorEmail", "ticketTitle", "price", "quantity", "totalPrice", "status", "paymentStatus", "createdAt", "updatedAt"],
      properties: {
        ticketId: { bsonType: "objectId" },
        userName: { bsonType: "string", minLength: 1 },
        userEmail: { bsonType: "string", minLength: 1 },
        vendorEmail: { bsonType: "string", minLength: 1 },
        ticketTitle: { bsonType: "string", minLength: 1 },
        price: { bsonType: ["double", "int", "long", "decimal"], minimum: 0.01 },
        quantity: { bsonType: ["int", "long"], minimum: 1 },
        totalPrice: { bsonType: ["double", "int", "long", "decimal"], minimum: 0.01 },
        status: { enum: ["pending", "accepted", "rejected"] },
        paymentStatus: { enum: ["unpaid", "paid", "not_required"] },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
  payments: {
    $jsonSchema: {
      bsonType: "object",
      required: ["transactionId", "bookingId", "ticketId", "userEmail", "vendorEmail", "amount", "quantity", "status", "createdAt"],
      properties: {
        transactionId: { bsonType: "string", minLength: 1 },
        bookingId: { bsonType: "objectId" },
        ticketId: { bsonType: "objectId" },
        userEmail: { bsonType: "string", minLength: 1 },
        vendorEmail: { bsonType: "string", minLength: 1 },
        amount: { bsonType: ["double", "int", "long", "decimal"], minimum: 0.01 },
        quantity: { bsonType: ["int", "long"], minimum: 1 },
        status: { enum: ["paid"] },
        createdAt: { bsonType: "date" },
      },
    },
  },
  contactMessages: {
    $jsonSchema: {
      bsonType: "object",
      required: ["name", "email", "subject", "message", "createdAt"],
      properties: {
        name: { bsonType: "string", minLength: 2, maxLength: 80 },
        email: { bsonType: "string", minLength: 3, maxLength: 254 },
        subject: { bsonType: "string", minLength: 5, maxLength: 120 },
        message: { bsonType: "string", minLength: 20, maxLength: 2000 },
        createdAt: { bsonType: "date" },
      },
    },
  },
};

async function ensureCollectionValidators(database) {
  const existing = new Set(
    (await database.listCollections({}, { nameOnly: true }).toArray()).map(({ name }) => name),
  );

  for (const [name, validator] of Object.entries(collectionValidators)) {
    try {
      if (existing.has(name)) {
        await database.command({
          collMod: name,
          validator,
          validationLevel: "moderate",
          validationAction: "error",
        });
      } else {
        await database.createCollection(name, {
          validator,
          validationLevel: "moderate",
          validationAction: "error",
        });
      }
    } catch (error) {
      if (error?.code === 13 || error?.codeName === "Unauthorized") {
        console.warn(`MongoDB user cannot configure the ${name} collection validator; API validation remains enabled.`);
        continue;
      }
      throw error;
    }
  }
}

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
      return ensureCollectionValidators(db).then(() => {
        console.log("MongoDB connected successfully to trip-swift-db");
        return db;
      });
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
