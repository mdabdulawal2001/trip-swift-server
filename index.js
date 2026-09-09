const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8000;

// ENVIRONMENT VARIABLES
const uri = process.env.MONGODB_URI;
const BETTER_AUTH_URL = process.env.NEXT_PUBLIC_BETTER_AUTH_URL;

// BASIC VALIDATION
if (!uri) {
  console.error("❌ MONGODB_URI is missing in .env file");
}

if (!BETTER_AUTH_URL) {
  console.warn("⚠️ BETTER_AUTH_URL is missing in .env file");
}

// MIDDLEWARE
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json());

// MONGODB CONNECTION
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

// Cached database connection for Serverless Deployment (Vercel)
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
      console.log("✅ MongoDB connected successfully to trip-swift-db");
      return db;
    })
    .catch((error) => {
      dbConnectionPromise = null;
      console.error("❌ MongoDB connection failed:", error);
      throw error;
    });

  return dbConnectionPromise;
}

// DATABASE COLLECTIONS FOR TICKET BOOKING SYSTEM
async function getCollections() {
  const database = await connectDB();

  return {
    ticketsCollection: database.collection("tickets"),
    // usersCollection: database.collection("users"),
    // bookingsCollection: database.collection("bookings"),
    // paymentsCollection: database.collection("payments"),
  };
}

// ROOT ROUTE
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Trip Swift Server is running smoothly!",
    status: "Active",
  });
});

/* ====================================================================
   =================== 🚀 WRITE YOUR API ROUTES HERE ===================
   ==================================================================== */

// Example Route: Get All Tickets
app.get("/tickets", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const {
      from = "",
      to = "",
      type = "",
      sort = "default",
      page = "1",
      limit = "6",
    } = req.query;

    const currentPage = Math.max(Number(page) || 1, 1);
    const itemsPerPage = Math.min(
      Math.max(Number(limit) || 6, 1),
      20
    );

    // -----------------------------
    // FILTER
    // -----------------------------

    const query = {
      approved: true,
    };

    if (from.trim()) {
      query.from = {
        $regex: from.trim(),
        $options: "i",
      };
    }

    if (to.trim()) {
      query.to = {
        $regex: to.trim(),
        $options: "i",
      };
    }

    if (type.trim()) {
      query.type = type.trim();
    }

    // -----------------------------
    // SORT
    // -----------------------------

    let sortOption = {};

    if (sort === "low") {
      sortOption = { price: 1 };
    }

    if (sort === "high") {
      sortOption = { price: -1 };
    }

    // -----------------------------
    // TOTAL COUNT
    // -----------------------------

    const totalItems = await ticketsCollection.countDocuments(query);

    const totalPages = Math.max(
      Math.ceil(totalItems / itemsPerPage),
      1
    );

    const safePage = Math.min(
      currentPage,
      totalPages
    );

    const skip = (safePage - 1) * itemsPerPage;

    // -----------------------------
    // GET TICKETS
    // -----------------------------

    const tickets = await ticketsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    // -----------------------------
    // RESPONSE
    // -----------------------------

    res.status(200).json({
      success: true,
      tickets,
      pagination: {
        totalItems,
        totalPages,
        currentPage: safePage,
        itemsPerPage,
      },
      filters: {
        from,
        to,
        type,
        sort,
      },
    });
  } catch (error) {
    console.error("GET /tickets error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch tickets",
    });
  }
});

/* ====================================================================
   ==================================================================== */

// 404 ROUTE
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// ERROR HANDLER
app.use((error, req, res, next) => {
  console.error("Unhandled Server Error:", error);

  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error.message,
  });
});

// LISTEN ON PORT (For Local Development)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`🚀 Server is running locally on http://localhost:${PORT}`);
  });
}

// VERCEL EXPORT
module.exports = app;