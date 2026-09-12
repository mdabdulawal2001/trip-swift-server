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
    usersCollection: database.collection("users"),
    bookingsCollection: database.collection("bookings"),
    paymentsCollection: database.collection("payments"),
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

    const query = {
      status: "approved"
    };

    // Search by departure city
    if (from.trim()) {
      query.from = {
        $regex: from.trim(),
        $options: "i",
      };
    }

    // Search by destination city
    if (to.trim()) {
      query.to = {
        $regex: to.trim(),
        $options: "i",
      };
    }

    // Transport type filter
    if (type.trim()) {
      query.type = type.trim();
    }

    // Sorting
    let sortOption = {};

    if (sort === "low") {
      sortOption = { price: 1 };
    } else if (sort === "high") {
      sortOption = { price: -1 };
    }

    // Total matching tickets
    const totalItems = await ticketsCollection.countDocuments(query);

    const totalPages = Math.max(
      Math.ceil(totalItems / itemsPerPage),
      1
    );

    // Prevent invalid page
    const safePage = Math.min(
      currentPage,
      totalPages
    );

    const skip = (safePage - 1) * itemsPerPage;

    const tickets = await ticketsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(itemsPerPage)
      .toArray();

    res.status(200).json({
      success: true,
      tickets,
      pagination: {
        totalItems,
        totalPages,
        currentPage: safePage,
        itemsPerPage,
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

// get vendor tickets route
app.get("/tickets/vendor", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const { email = "" } = req.query;

    if (!email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vendor email is required",
      });
    }

    const tickets = await ticketsCollection
      .find({
        vendorEmail: email.trim(),
      })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error("GET /tickets/vendor error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor tickets",
    });
  }
});

// ticket details route
app.get("/tickets/:id", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
      status: "approved",
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error("GET /tickets/:id error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
    });
  }
});

// manage status route

app.patch("/tickets/:id/status", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const allowedStatuses = ["pending", "approved", "rejected"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket status",
      });
    }

    const result = await ticketsCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const updatedTicket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
    });

    res.status(200).json({
      success: true,
      message: `Ticket ${status} successfully`,
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("PATCH /tickets/:id/status error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update ticket status",
    });
  }
});


// add ticket route
app.post("/tickets", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const {
      title,
      operator,
      from,
      to,
      type,
      price,
      quantity,
      departure,
      date,
      departureDateTime,
      image,
      perks,
      description,
      vendorEmail,
    } = req.body;

    if (
      !title ||
      !operator ||
      !from ||
      !to ||
      !type ||
      price === undefined ||
      quantity === undefined ||
      !departure ||
      !date ||
      !departureDateTime ||
      !image ||
      !description ||
      !vendorEmail
    ) {
      return res.status(400).json({
        success: false,
        message: "Required ticket information is missing",
      });
    }

    const newTicket = {
      title: title.trim(),
      operator: operator.trim(),
      from: from.trim(),
      to: to.trim(),
      type: type.trim(),

      price: Number(price),
      quantity: Number(quantity),

      departure: departure.trim(),
      date: date.trim(),
      departureDateTime,

      image: image.trim(),

      perks: Array.isArray(perks) ? perks : [],

      description: description.trim(),

      vendorEmail: vendorEmail.trim(),

      // Vendor cannot approve their own ticket
      // approved: false,
      status: "pending",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await ticketsCollection.insertOne(newTicket);

    res.status(201).json({
      success: true,
      message: "Ticket added successfully",
      ticketId: result.insertedId,
      ticket: {
        ...newTicket,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("POST /tickets error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to add ticket",
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