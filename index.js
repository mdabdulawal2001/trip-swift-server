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
  }),
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
    usersCollection: database.collection("user"),
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

    const itemsPerPage = Math.min(Math.max(Number(limit) || 6, 1), 20);

    const query = {
      status: "approved",
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
    let sortOption = {
      createdAt: -1,
      _id: -1,
    };

    if (sort === "low") {
      sortOption = { price: 1, _id: 1 };
    } else if (sort === "high") {
      sortOption = { price: -1, _id: -1 };
    }

    // Total matching tickets
    const totalItems = await ticketsCollection.countDocuments(query);

    const totalPages = Math.max(Math.ceil(totalItems / itemsPerPage), 1);

    // Prevent invalid page
    const safePage = Math.min(currentPage, totalPages);

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

// admin route to get all tickets
app.get("/tickets/admin", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const tickets = await ticketsCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error("GET /tickets/admin error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch admin tickets",
    });
  }
});

// get vendor tickets by id route
app.get("/tickets/vendor/:id", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();

    const { id } = req.params;
    const { email = "" } = req.query;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    if (!email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vendor email is required",
      });
    }

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(id),
      vendorEmail: email.trim().toLowerCase(),
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Vendor ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      ticket,
    });
  } catch (error) {
    console.error(
      "GET /tickets/vendor/:id error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor ticket",
    });
  }
});

// get admin tickets by id route
app.get("/tickets/admin/:id", async (req, res) => {
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
    console.error(
      "GET /tickets/admin/:id error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch ticket",
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
      },
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


// edit ticket route
app.patch("/tickets/:id", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

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
      !description
    ) {
      return res.status(400).json({
        success: false,
        message: "Required ticket information is missing",
      });
    }

    const updateData = {
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

      // Edited ticket needs admin approval again
      status: "pending",

      updatedAt: new Date(),
    };

    const result = await ticketsCollection.updateOne(
      {
        _id: new ObjectId(id),
      },
      {
        $set: updateData,
      },
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
      message: "Ticket updated successfully",
      ticket: updatedTicket,
    });
  } catch (error) {
    console.error("PATCH /tickets/:id error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to update ticket",
    });
  }
});

// delete ticket route
app.delete("/tickets/:id", async (req, res) => {
  try {
    const { ticketsCollection } = await getCollections();
    const { id } = req.params;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const result = await ticketsCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Ticket deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /tickets/:id error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to delete ticket",
    });
  }
});

// bookings route for vendors to get their bookings
app.get("/bookings/vendor", async (req, res) => {
  try {
    const { email = "" } = req.query;

    if (!email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Vendor email is required",
      });
    }

    const { bookingsCollection } =
      await getCollections();

    const bookings = await bookingsCollection
      .find({
        vendorEmail: email.trim(),
      })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .toArray();

    res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error(
      "GET /bookings/vendor error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to fetch vendor bookings",
    });
  }
});

// update booking status route for vendors
app.patch("/bookings/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const allowedStatuses = [
      "pending",
      "accepted",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking status",
      });
    }

    const {
      bookingsCollection,
    } = await getCollections();

    const booking =
      await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Only pending bookings can be updated",
      });
    }

    const departureTime = new Date(
      booking.departureDateTime
    );

    if (
      !Number.isNaN(departureTime.getTime()) &&
      departureTime.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "Cannot update a booking after departure",
      });
    }

    const updateData = {
      status,
      updatedAt: new Date(),
    };

    // Rejected booking no longer needs payment
    if (status === "rejected") {
      updateData.paymentStatus = "not_required";
    }

    const result =
      await bookingsCollection.updateOne(
        {
          _id: new ObjectId(id),
        },
        {
          $set: updateData,
        }
      );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    const updatedBooking =
      await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

    res.status(200).json({
      success: true,
      message: `Booking ${status} successfully`,
      booking: updatedBooking,
    });
  } catch (error) {
    console.error(
      "PATCH /bookings/:id/status error:",
      error
    );

    res.status(500).json({
      success: false,
      message: "Failed to update booking status",
    });
  }
});


// ============ user routes ============

// bookings route
app.post("/bookings", async (req, res) => {
  try {
    const {
      ticketId,
      userName,
      userEmail,
      quantity,
    } = req.body;

    if (
      !ticketId ||
      !userName ||
      !userEmail ||
      quantity === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Required booking information is missing",
      });
    }

    if (!ObjectId.isValid(ticketId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid ticket ID",
      });
    }

    const bookingQuantity = Number(quantity);

    if (
      !Number.isInteger(bookingQuantity) ||
      bookingQuantity < 1
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking quantity",
      });
    }

    const {
      ticketsCollection,
      bookingsCollection,
    } = await getCollections();

    const ticket = await ticketsCollection.findOne({
      _id: new ObjectId(ticketId),
      status: "approved",
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    if (ticket.quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket is sold out",
      });
    }

    if (bookingQuantity > ticket.quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${ticket.quantity} tickets are available`,
      });
    }

    const departureTime = new Date(
      ticket.departureDateTime
    );

    if (
      Number.isNaN(departureTime.getTime()) ||
      departureTime.getTime() <= Date.now()
    ) {
      return res.status(400).json({
        success: false,
        message: "This ticket has already departed",
      });
    }

    const totalPrice =
      Number(ticket.price) * bookingQuantity;

    const newBooking = {
      ticketId: ticket._id,

      userName: userName.trim(),
      userEmail: userEmail.trim(),

      vendorEmail: ticket.vendorEmail,

      ticketTitle: ticket.title,
      operator: ticket.operator,

      from: ticket.from,
      to: ticket.to,
      type: ticket.type,

      price: Number(ticket.price),
      quantity: bookingQuantity,
      totalPrice,

      departure: ticket.departure,
      date: ticket.date,
      departureDateTime: ticket.departureDateTime,

      image: ticket.image,

      status: "pending",
      paymentStatus: "unpaid",

      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result =
      await bookingsCollection.insertOne(newBooking);

    res.status(201).json({
      success: true,
      message: "Booking request created successfully",
      booking: {
        ...newBooking,
        _id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("POST /bookings error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to create booking",
    });
  }
});

app.get("/bookings/user", async (req, res) => {
  try {
    const { email = "" } = req.query;

    if (!email.trim()) {
      return res.status(400).json({
        success: false,
        message: "User email is required",
      });
    }

    const { bookingsCollection } =
      await getCollections();

    const bookings = await bookingsCollection
      .find({
        userEmail: email.trim(),
      })
      .sort({
        createdAt: -1,
        _id: -1,
      })
      .toArray();

    res.status(200).json({
      success: true,
      bookings,
    });
  } catch (error) {
    console.error("GET /bookings/user error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch user bookings",
    });
  }
});


// ============ admin dashboard stats ============

app.get("/admin/dashboard-stats", async (req, res) => {
  try {
    const {
      ticketsCollection,
      usersCollection,
      bookingsCollection,
    } = await getCollections();

    const [
      totalUsers,
      vendors,
      blockedUsers,
      totalTickets,
      approvedTickets,
      pendingTickets,
      rejectedTickets,
      totalBookings,
      recentUsers,
      recentTickets,
      recentBookings,
    ] = await Promise.all([
      usersCollection.countDocuments({}),

      usersCollection.countDocuments({
        role: "vendor",
      }),

      usersCollection.countDocuments({
        status: {
          $in: ["blocked", "fraud", "Blocked", "Fraud"],
        },
      }),

      ticketsCollection.countDocuments({}),

      ticketsCollection.countDocuments({
        status: "approved",
      }),

      ticketsCollection.countDocuments({
        status: "pending",
      }),

      ticketsCollection.countDocuments({
        status: "rejected",
      }),

      bookingsCollection.countDocuments({}),

      usersCollection
        .find({})
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(3)
        .toArray(),

      ticketsCollection
        .find({})
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(3)
        .toArray(),

      bookingsCollection
        .find({})
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .limit(3)
        .toArray(),
    ]);

    const ticketTotalForPercentage =
      totalTickets || 1;

    const approvalStats = {
      approved: Math.round(
        (approvedTickets /
          ticketTotalForPercentage) *
          100
      ),

      pending: Math.round(
        (pendingTickets /
          ticketTotalForPercentage) *
          100
      ),

      rejected: Math.round(
        (rejectedTickets /
          ticketTotalForPercentage) *
          100
      ),
    };

    const activities = [];

    recentUsers.forEach((user) => {
      activities.push({
        type:
          user.role === "vendor"
            ? "vendor"
            : "user",

        title:
          user.role === "vendor"
            ? "New vendor registered"
            : "New user registered",

        description:
          user.name ||
          user.email ||
          "New account created",

        createdAt:
          user.createdAt || null,
      });
    });

    recentTickets.forEach((ticket) => {
      activities.push({
        type: "ticket",

        title: "New ticket submitted",

        description: `${ticket.from || "Unknown"} → ${
          ticket.to || "Unknown"
        }`,

        createdAt:
          ticket.createdAt || null,
      });
    });

    recentBookings.forEach((booking) => {
      activities.push({
        type: "booking",

        title: "New booking created",

        description:
          booking.ticketTitle ||
          `${booking.from || "Unknown"} → ${
            booking.to || "Unknown"
          }`,

        createdAt:
          booking.createdAt || null,
      });
    });

    activities.sort((a, b) => {
      const dateA = new Date(
        a.createdAt || 0
      ).getTime();

      const dateB = new Date(
        b.createdAt || 0
      ).getTime();

      return dateB - dateA;
    });

    res.status(200).json({
      success: true,

      stats: {
        totalUsers,
        vendors,
        blockedUsers,
        totalTickets,
        approvedTickets,
        pendingTickets,
        rejectedTickets,
        totalBookings,
      },

      approvalStats,

      activities: activities.slice(0, 3),
    });
  } catch (error) {
    console.error(
      "GET /admin/dashboard-stats error:",
      error
    );

    res.status(500).json({
      success: false,
      message:
        "Failed to fetch admin dashboard stats",
    });
  }
});

// ============ user dashboard stats ============
app.get("/user/dashboard-stats", async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email query parameter is required",
      });
    }

    const { bookingsCollection } = await getCollections();

    // নির্দিষ্ট ইউজারের সব বুকিং আনুন
    const userBookings = await bookingsCollection
      .find({ userEmail: email }) // আপনার DB তে ফিল্ডের নাম email বা userEmail যা আছে তা দিন
      .sort({ createdAt: -1, _id: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      bookings: userBookings,
    });
  } catch (error) {
    console.error("GET /user/dashboard-stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user dashboard stats",
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
