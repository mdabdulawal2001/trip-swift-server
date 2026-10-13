const { ObjectId } = require("mongodb");
const { client, getCollections } = require("../config/database");
const { normalizeEmail, createTransactionId } = require("../utils/helpers");

const post_payments = async (req, res) => {
  try {
    const { bookingId, userEmail } = req.body;

    if (!bookingId || !userEmail) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and user email are required",
      });
    }

    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const loggedInUserEmail = normalizeEmail(req.user?.email);

    const normalizedUserEmail = normalizeEmail(userEmail);

    if (!loggedInUserEmail || loggedInUserEmail !== normalizedUserEmail) {
      return res.status(403).json({
        success: false,
        message: "You can only make payments for your own booking.",
      });
    }

    const { bookingsCollection, ticketsCollection, paymentsCollection } =
      await getCollections();

    const booking = await bookingsCollection.findOne({
      _id: new ObjectId(bookingId),
      userEmail: loggedInUserEmail,
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: "Booking not found",
      });
    }

    if (booking.status !== "accepted") {
      return res.status(400).json({
        success: false,
        message: "Only accepted bookings can be paid",
      });
    }

    if (booking.paymentStatus === "paid") {
      return res.status(400).json({
        success: false,
        message: "This booking has already been paid",
      });
    }

    const ticket = await ticketsCollection.findOne({
      _id: booking.ticketId,
      status: "approved",
    });

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: "Ticket not found",
      });
    }

    const departureTime = new Date(ticket.departureDateTime);

    if (Number.isNaN(departureTime.getTime()) || departureTime <= new Date()) {
      return res.status(400).json({
        success: false,
        message: "This ticket has already expired",
      });
    }

    const bookingQuantity = Number(booking.quantity);

    const currentQuantity = Number(ticket.quantity);

    if (currentQuantity <= 0) {
      return res.status(400).json({
        success: false,
        message: "Ticket is sold out",
      });
    }

    if (bookingQuantity > currentQuantity) {
      return res.status(400).json({
        success: false,
        message: "Not enough tickets are available",
      });
    }

    const amount = Number(booking.totalPrice || 0);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const transactionId = createTransactionId();

    const ticketUpdate = await ticketsCollection.updateOne(
      {
        _id: booking.ticketId,
        status: "approved",
        quantity: {
          $gte: bookingQuantity,
        },
      },
      {
        $inc: {
          quantity: -bookingQuantity,
        },

        $set: {
          updatedAt: new Date(),
        },
      },
    );

    if (ticketUpdate.modifiedCount !== 1) {
      return res.status(400).json({
        success: false,
        message: "Ticket quantity is no longer available",
      });
    }

    await bookingsCollection.updateOne(
      {
        _id: booking._id,
      },
      {
        $set: {
          paymentStatus: "paid",
          transactionId,
          paidAt: new Date(),
          updatedAt: new Date(),
        },
      },
    );

    const transaction = {
      transactionId,

      bookingId: booking._id,

      ticketId: booking.ticketId,

      userEmail: loggedInUserEmail,

      vendorEmail: normalizeEmail(booking.vendorEmail),

      ticketTitle: booking.ticketTitle,

      amount,

      quantity: bookingQuantity,

      paymentDate: new Date(),

      status: "paid",

      createdAt: new Date(),
    };

    await paymentsCollection.insertOne(transaction);

    return res.status(201).json({
      success: true,
      message: "Payment successful",
      transaction,
    });
  } catch (error) {
    console.error("POST /payments error:", error);

    return res.status(500).json({
      success: false,
      message: "Payment failed",
    });
  }
};

const post_payments_confirm = async (req, res) => {
  const session = client.startSession();

  try {
    const { bookingId, stripeSessionId, paymentIntentId, amount } = req.body;

    if (!bookingId || !stripeSessionId) {
      return res.status(400).json({
        success: false,
        message: "Booking ID and Stripe session ID are required",
      });
    }

    if (!ObjectId.isValid(bookingId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid booking ID",
      });
    }

    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment amount",
      });
    }

    const { bookingsCollection, ticketsCollection, paymentsCollection } =
      await getCollections();

    let result;

    await session.withTransaction(async () => {

      // Prevent duplicate processing


      const existingPayment = await paymentsCollection.findOne(
        {
          stripeSessionId,
        },
        { session },
      );

      if (existingPayment) {
        result = {
          alreadyProcessed: true,
          payment: existingPayment,
        };

        return;
      }

      // Find booking


      const booking = await bookingsCollection.findOne(
        {
          _id: new ObjectId(bookingId),
        },
        { session },
      );

      if (!booking) {
        throw new Error("Booking not found");
      }

      // Already paid


      if (booking.paymentStatus === "paid") {
        result = {
          alreadyProcessed: true,
          payment: null,
        };

        return;
      }

      // Booking must be accepted

      if (booking.status !== "accepted") {
        throw new Error("Only accepted bookings can be paid");
      }

      // Amount must match booking

      const bookingTotal = Number(booking.totalPrice);

      if (!Number.isFinite(bookingTotal) || bookingTotal !== numericAmount) {
        throw new Error("Payment amount does not match booking amount");
      }

      // Validate quantity

      const bookingQuantity = Number(booking.quantity);

      if (!Number.isInteger(bookingQuantity) || bookingQuantity <= 0) {
        throw new Error("Invalid booking quantity");
      }

      // Find ticket

      const ticketId = booking.ticketId;

      const normalizedTicketId =
        ticketId instanceof ObjectId ? ticketId : new ObjectId(ticketId);

      const ticket = await ticketsCollection.findOne(
        {
          _id: normalizedTicketId,
          status: "approved",
        },
        { session },
      );

      if (!ticket) {
        throw new Error("Ticket not found");
      }

      // Check departure time

      const departureTime = new Date(ticket.departureDateTime);

      if (
        Number.isNaN(departureTime.getTime()) ||
        departureTime.getTime() <= Date.now()
      ) {
        throw new Error("This ticket has already departed");
      }

      // Check available quantity

      const availableQuantity = Number(ticket.quantity);

      if (availableQuantity < bookingQuantity) {
        throw new Error("Not enough tickets are available");
      }

      // Atomically decrease quantity

      const ticketUpdate = await ticketsCollection.updateOne(
        {
          _id: normalizedTicketId,

          quantity: {
            $gte: bookingQuantity,
          },
        },
        {
          $inc: {
            quantity: -bookingQuantity,
          },

          $set: {
            updatedAt: new Date(),
          },
        },
        { session },
      );

      if (ticketUpdate.modifiedCount !== 1) {
        throw new Error("Ticket quantity could not be updated");
      }

      // Create transaction ID

      const transactionId = createTransactionId();

      // Create payment document

      const paymentDocument = {
        transactionId,

        stripeSessionId,

        paymentIntentId: paymentIntentId || null,

        bookingId: booking._id,

        ticketId: normalizedTicketId,

        userEmail: normalizeEmail(booking.userEmail),

        vendorEmail: normalizeEmail(booking.vendorEmail),

        ticketTitle: booking.ticketTitle,

        from: booking.from,

        to: booking.to,

        operator: booking.operator,

        type: booking.type,

        amount: bookingTotal,

        quantity: bookingQuantity,

        paymentDate: new Date(),

        status: "paid",

        createdAt: new Date(),

        updatedAt: new Date(),
      };

      await paymentsCollection.insertOne(paymentDocument, { session });

      // Update booking

      await bookingsCollection.updateOne(
        {
          _id: booking._id,
        },
        {
          $set: {
            paymentStatus: "paid",

            paymentId: transactionId,

            stripeSessionId,

            updatedAt: new Date(),
          },
        },
        { session },
      );

      result = {
        alreadyProcessed: false,

        payment: paymentDocument,
      };
    });

    return res.status(200).json({
      success: true,

      message: result?.alreadyProcessed
        ? "Payment was already processed"
        : "Payment confirmed successfully",

      alreadyProcessed: result?.alreadyProcessed || false,

      payment: result?.payment || null,
    });
  } catch (error) {
    console.error("Payment confirmation error:", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to confirm payment",
    });
  } finally {
    await session.endSession();
  }
};

const get_payments_user = async (req, res) => {
    try {
      const userEmail = normalizeEmail(req.user?.email);

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user email is missing",
        });
      }

      const { paymentsCollection } = await getCollections();

      const payments = await paymentsCollection
        .find({
          userEmail,
          status: "paid",
        })
        .sort({
          paymentDate: -1,
          _id: -1,
        })
        .toArray();

      return res.status(200).json({
        success: true,
        payments,
      });
    } catch (error) {
      console.error("Get user payments error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch user payments",
      });
    }
  };

const get_payments_vendor = async (req, res) => {
    try {
      const vendorEmail = normalizeEmail(req.user?.email);

      if (!vendorEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated vendor email is missing",
        });
      }

      const { paymentsCollection } = await getCollections();

      const payments = await paymentsCollection
        .find({
          vendorEmail,
          status: "paid",
        })
        .sort({
          paymentDate: -1,
          _id: -1,
        })
        .toArray();

      return res.status(200).json({
        success: true,
        payments,
      });
    } catch (error) {
      console.error("Get vendor payments error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch vendor payments",
      });
    }
  };

const get_payments_admin = async (req, res) => {
    try {
      const { paymentsCollection } = await getCollections();

      const payments = await paymentsCollection
        .find({
          status: "paid",
        })
        .sort({
          paymentDate: -1,
          _id: -1,
        })
        .toArray();

      const totalRevenue = payments.reduce(
        (total, payment) => total + Number(payment.amount || 0),
        0,
      );

      return res.status(200).json({
        success: true,
        payments,
        totalRevenue,
      });
    } catch (error) {
      console.error("GET /payments/admin error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to fetch admin revenue",
      });
    }
  };

module.exports = {
  post_payments,
  post_payments_confirm,
  get_payments_user,
  get_payments_vendor,
  get_payments_admin,
};
