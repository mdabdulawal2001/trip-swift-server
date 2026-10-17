const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/database");
const { normalizeEmail, ensureVendorOwnership, isPlainObject, isNonEmptyString, isNumericInput, forwardError } = require("../utils/helpers");

const get_bookings_vendor = async (req, res, next) => {
    try {
      const vendorEmail = normalizeEmail(
        req.user?.email,
      );

      if (!vendorEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated vendor email is missing",
        });
      }

      const { bookingsCollection } = await getCollections();

      const bookings = await bookingsCollection
        .find({
          vendorEmail,
        })
        .sort({
          createdAt: -1,
          _id: -1,
        })
        .toArray();

      return res.status(200).json({
        success: true,
        bookings,
      });
    } catch (error) {
      forwardError(next, error, "Failed to fetch vendor bookings");
    }
  };

const patch_bookings_id_status = async (req, res, next) => {
    try {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ success: false, message: "Request body must be a JSON object" });
      }
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

      const { bookingsCollection } = await getCollections();

      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      // Only the booking's vendor can update it
      if (
        !ensureVendorOwnership(
          req,
          res,
          booking.vendorEmail,
        )
      ) {
        return;
      }

      if (booking.status !== "pending") {
        return res.status(400).json({
          success: false,
          message: "Only pending bookings can be updated",
        });
      }

      const departureTime = new Date(
        booking.departureDateTime,
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

      const result = await bookingsCollection.updateOne(
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
          message: "Booking not found",
        });
      }

      const updatedBooking =
        await bookingsCollection.findOne({
          _id: new ObjectId(id),
        });

      return res.status(200).json({
        success: true,
        message: `Booking ${status} successfully`,
        booking: updatedBooking,
      });
    } catch (error) {
      forwardError(next, error, "Failed to update booking status");
    }
  };

const post_bookings = async (req, res, next) => {
    try {
      if (!isPlainObject(req.body)) {
        return res.status(400).json({ success: false, message: "Request body must be a JSON object" });
      }
      const {
        ticketId,
        userName,
        quantity,
      } = req.body;

      if (
        !ticketId ||
        !userName ||
        quantity === undefined
      ) {
        return res.status(400).json({
          success: false,
          message: "Required booking information is missing",
        });
      }

      if (!isNonEmptyString(userName)) {
        return res.status(400).json({ success: false, message: "Invalid booking user name" });
      }

      if (!ObjectId.isValid(ticketId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket ID",
        });
      }

      if (!isNumericInput(quantity)) {
        return res.status(400).json({ success: false, message: "Invalid booking quantity" });
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

      // Get user identity from verified JWT
      const loggedInUserEmail = normalizeEmail(
        req.user?.email,
      );

      if (!loggedInUserEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user email is missing",
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
        ticket.departureDateTime,
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

      const ticketPrice = Number(ticket.price);

      if (
        !Number.isFinite(ticketPrice) ||
        ticketPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket price",
        });
      }

      const totalPrice =
        ticketPrice * bookingQuantity;

      if (
        !Number.isFinite(totalPrice) ||
        totalPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking total price",
        });
      }

      const newBooking = {
        ticketId: ticket._id,

        userName: userName.trim(),

        // Always use authenticated user's email
        userEmail: loggedInUserEmail,

        vendorEmail: normalizeEmail(
          ticket.vendorEmail,
        ),

        ticketTitle: ticket.title,
        operator: ticket.operator,

        from: ticket.from,
        to: ticket.to,
        type: ticket.type,

        price: ticketPrice,
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
        await bookingsCollection.insertOne(
          newBooking,
        );

      return res.status(201).json({
        success: true,
        message: "Booking request created successfully",
        booking: {
          ...newBooking,
          _id: result.insertedId,
        },
      });
    } catch (error) {
      forwardError(next, error, "Failed to create booking");
    }
  };

const get_bookings_user = async (req, res, next) => {
    try {
      const userEmail = normalizeEmail(req.user?.email);

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user email is missing",
        });
      }

      const { bookingsCollection } = await getCollections();

      const bookings = await bookingsCollection
        .find({
          userEmail,
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
      forwardError(next, error, "Failed to fetch user bookings");
    }
  };

const get_bookings_id = async (req, res, next) => {
    try {
      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid booking ID",
        });
      }

      const userEmail = normalizeEmail(req.user?.email);

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user email is missing",
        });
      }

      const { bookingsCollection } = await getCollections();

      const booking = await bookingsCollection.findOne({
        _id: new ObjectId(id),
        userEmail,
      });

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        });
      }

      return res.status(200).json({
        success: true,
        booking,
      });
    } catch (error) {
      forwardError(next, error, "Failed to get booking");
    }
  };

module.exports = {
  get_bookings_vendor,
  patch_bookings_id_status,
  post_bookings,
  get_bookings_user,
  get_bookings_id,
};
