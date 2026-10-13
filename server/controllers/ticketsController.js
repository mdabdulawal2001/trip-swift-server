const { ObjectId } = require("mongodb");
const { getCollections, getFraudVendorEmails } = require("../config/database");
const { normalizeEmail, ensureVendorOwnership } = require("../utils/helpers");

const get_tickets = async (req, res) => {
  try {
    const { ticketsCollection, usersCollection } = await getCollections();

    const fraudVendorEmails = await getFraudVendorEmails(usersCollection);

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
      vendorEmail: {
        $nin: fraudVendorEmails,
      },
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
};

const get_tickets_vendor = async (req, res) => {
    try {
      const { ticketsCollection, usersCollection } = await getCollections();

      const vendorEmail = normalizeEmail(req.user.email);

      
      if (!vendorEmail) {
        return res.status(400).json({
          success: false,
          message: "Vendor email is missing",
        });
      }

      const tickets = await ticketsCollection
        .find({
          vendorEmail,
        })
        .sort({ createdAt: -1 })
        .toArray();

        const vendorUser = await usersCollection.findOne({
        email: vendorEmail,
      });


      res.status(200).json({
        success: true,
        tickets,
        isFraud: vendorUser?.isFraud === true,
      });
    } catch (error) {
      console.error("GET /tickets/vendor error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch vendor tickets",
      });
    }
  };

const get_tickets_admin = async (req, res) => {
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
  };

const get_tickets_vendor_id = async (req, res) => {
    try {
      const { ticketsCollection } = await getCollections();

      const { id } = req.params;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket ID",
        });
      }

      const vendorEmail = normalizeEmail(req.user.email);

      if (!vendorEmail) {
        return res.status(400).json({
          success: false,
          message: "Vendor email is missing",
        });
      }

      const ticket = await ticketsCollection.findOne({
        _id: new ObjectId(id),
        vendorEmail,
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
      console.error("GET /tickets/vendor/:id error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch vendor ticket",
      });
    }
  };

const get_tickets_admin_id = async (req, res) => {
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
      console.error("GET /tickets/admin/:id error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to fetch ticket",
      });
    }
  };

const get_tickets_advertised = async (req, res) => {
  try {
    const { ticketsCollection, usersCollection } = await getCollections();

    const fraudVendorEmails = await getFraudVendorEmails(usersCollection);

    const tickets = await ticketsCollection
      .find({
        status: "approved",
        advertised: true,
        vendorEmail: {
          $nin: fraudVendorEmails,
        },
      })
      .sort({
        advertisedAt: -1,
      })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      tickets,
    });
  } catch (error) {
    console.error("Get advertised tickets error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch advertised tickets",
    });
  }
};

const get_tickets_id = async (req, res) => {
  try {
    const { ticketsCollection, usersCollection } = await getCollections();

    const fraudVendorEmails = await getFraudVendorEmails(usersCollection);

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
      vendorEmail: {
        $nin: fraudVendorEmails,
      },
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
};

const patch_tickets_id_status = async (req, res) => {
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
            ...(status !== "approved"
              ? {
                  advertised: false,
                  advertisedAt: null,
                }
              : {}),
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
  };

const post_tickets = async (req, res) => {
  try {
    const { ticketsCollection, usersCollection } = await getCollections();

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

    const vendorEmail = normalizeEmail(req.user.email);

    if (!vendorEmail) {
      return res.status(400).json({
        success: false,
        message: "Vendor email is missing",
      });
    }

    const vendorUser = await usersCollection.findOne({
      email: vendorEmail,
      role: "vendor",
    });

    if (!vendorUser) {
      return res.status(403).json({
        success: false,
        message: "Only vendors can add tickets.",
      });
    }

    if (vendorUser.isFraud === true) {
      return res.status(403).json({
        success: false,
        message:
          "Your vendor account has been marked as fraud. You cannot add tickets.",
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

      vendorEmail,

      status: "pending",

      advertised: false,
      advertisedAt: null,

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
};

const patch_tickets_id_advertise = async (req, res) => {
    try {
      const { id } = req.params;
      const { advertised } = req.body;

      if (!ObjectId.isValid(id)) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket ID",
        });
      }

      if (typeof advertised !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Advertised value must be boolean",
        });
      }

      const { ticketsCollection, usersCollection } = await getCollections();

      const ticket = await ticketsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!ticket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      // Only approved tickets can be advertised
      if (ticket.status !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Only approved tickets can be advertised.",
        });
      }

      // Fraud vendor tickets cannot be advertised
      const vendorEmail = normalizeEmail(ticket.vendorEmail);

      const vendorUser = await usersCollection.findOne({
        email: vendorEmail,
        role: "vendor",
      });

      if (vendorUser?.isFraud === true) {
        return res.status(403).json({
          success: false,
          message: "Fraud vendor tickets cannot be advertised.",
        });
      }

      // Add advertisement

      if (advertised) {
        const advertisedCount = await ticketsCollection.countDocuments({
          advertised: true,
        });

        // If this ticket is already advertised,
        if (!ticket.advertised && advertisedCount >= 6) {
          return res.status(400).json({
            success: false,
            message: "You can advertise a maximum of 6 tickets.",
          });
        }
      }

      const updateData = {
        advertised,
        advertisedAt: advertised ? new Date() : null,
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

      return res.status(200).json({
        success: true,

        message: advertised
          ? "Ticket added to advertisement."
          : "Ticket removed from advertisement.",

        ticket: updatedTicket,
      });
    } catch (error) {
      console.error("PATCH /tickets/:id/advertise error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update advertisement.",
      });
    }
  };

const patch_tickets_id = async (req, res) => {
    try {
      const { ticketsCollection, usersCollection } =
        await getCollections();

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

      // Find existing ticket first
      const existingTicket = await ticketsCollection.findOne({
        _id: new ObjectId(id),
      });

      if (!existingTicket) {
        return res.status(404).json({
          success: false,
          message: "Ticket not found",
        });
      }

      // Only the ticket owner can edit it
      if (
        !ensureVendorOwnership(
          req,
          res,
          existingTicket.vendorEmail,
        )
      ) {
        return;
      }

      const vendorEmail = normalizeEmail(
        existingTicket.vendorEmail,
      );

      // Check vendor fraud status
      const vendorUser = await usersCollection.findOne({
        email: vendorEmail,
        role: "vendor",
      });

      if (vendorUser?.isFraud === true) {
        return res.status(403).json({
          success: false,
          message: "Fraud vendors cannot edit tickets.",
        });
      }

      const numericPrice = Number(price);
      const numericQuantity = Number(quantity);

      if (
        !Number.isFinite(numericPrice) ||
        numericPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket price",
        });
      }

      if (
        !Number.isInteger(numericQuantity) ||
        numericQuantity < 1
      ) {
        return res.status(400).json({
          success: false,
          message: "Invalid ticket quantity",
        });
      }

      const updateData = {
        title: title.trim(),
        operator: operator.trim(),
        from: from.trim(),
        to: to.trim(),
        type: type.trim(),
        price: numericPrice,
        quantity: numericQuantity,
        departure: departure.trim(),
        date: date.trim(),
        departureDateTime,
        image: image.trim(),
        perks: Array.isArray(perks) ? perks : [],
        description: description.trim(),

        // Edited ticket needs admin approval again
        status: "pending",

        // Edited ticket cannot remain advertised
        advertised: false,
        advertisedAt: null,

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

      return res.status(200).json({
        success: true,
        message: "Ticket updated successfully",
        ticket: updatedTicket,
      });
    } catch (error) {
      console.error("PATCH /tickets/:id error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to update ticket",
      });
    }
  };

const delete_tickets_id = async (req, res) => {
    try {
      const { ticketsCollection, usersCollection } =
        await getCollections();

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

      // Only the ticket owner can delete it
      if (
        !ensureVendorOwnership(
          req,
          res,
          ticket.vendorEmail,
        )
      ) {
        return;
      }

      // Check vendor fraud status
      const vendorUser = await usersCollection.findOne({
        email: normalizeEmail(ticket.vendorEmail),
        role: "vendor",
      });

      if (vendorUser?.isFraud === true) {
        return res.status(403).json({
          success: false,
          message: "Fraud vendors cannot delete tickets.",
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

      return res.status(200).json({
        success: true,
        message: "Ticket deleted successfully",
      });
    } catch (error) {
      console.error("DELETE /tickets/:id error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to delete ticket",
      });
    }
  };

module.exports = {
  get_tickets,
  get_tickets_vendor,
  get_tickets_admin,
  get_tickets_vendor_id,
  get_tickets_admin_id,
  get_tickets_advertised,
  get_tickets_id,
  patch_tickets_id_status,
  post_tickets,
  patch_tickets_id_advertise,
  patch_tickets_id,
  delete_tickets_id,
};
