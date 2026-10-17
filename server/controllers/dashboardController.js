const { getCollections } = require("../config/database");
const { normalizeEmail, forwardError } = require("../utils/helpers");

const get_admin_dashboard_stats = async (req, res, next) => {
    try {
      const {
        ticketsCollection,
        usersCollection,
        bookingsCollection,
        paymentsCollection,
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
        revenueResult,
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

        paymentsCollection
          .aggregate([
            {
              $match: {
                status: "paid",
              },
            },
            {
              $group: {
                _id: null,
                totalRevenue: {
                  $sum: "$amount",
                },
              },
            },
          ])
          .toArray(),

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

      const totalRevenue = revenueResult[0]?.totalRevenue || 0;

      const ticketTotalForPercentage = totalTickets || 1;

      const approvalStats = {
        approved: Math.round(
          (approvedTickets / ticketTotalForPercentage) * 100,
        ),

        pending: Math.round((pendingTickets / ticketTotalForPercentage) * 100),

        rejected: Math.round(
          (rejectedTickets / ticketTotalForPercentage) * 100,
        ),
      };

      const activities = [];

      recentUsers.forEach((user) => {
        activities.push({
          type: user.role === "vendor" ? "vendor" : "user",

          title:
            user.role === "vendor"
              ? "New vendor registered"
              : "New user registered",

          description: user.name || user.email || "New account created",

          createdAt: user.createdAt || null,
        });
      });

      recentTickets.forEach((ticket) => {
        activities.push({
          type: "ticket",

          title: "New ticket submitted",

          description: `${ticket.from || "Unknown"} → ${
            ticket.to || "Unknown"
          }`,

          createdAt: ticket.createdAt || null,
        });
      });

      recentBookings.forEach((booking) => {
        activities.push({
          type: "booking",

          title: "New booking created",

          description:
            booking.ticketTitle ||
            `${booking.from || "Unknown"} → ${booking.to || "Unknown"}`,

          createdAt: booking.createdAt || null,
        });
      });

      activities.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();

        const dateB = new Date(b.createdAt || 0).getTime();

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
          totalRevenue,
        },

        approvalStats,

        activities: activities.slice(0, 3),
      });
    } catch (error) {
      forwardError(next, error, "Failed to fetch admin dashboard stats");
    }
  };

const get_user_dashboard_stats = async (req, res, next) => {
    try {
      const userEmail = normalizeEmail(req.user?.email);

      if (!userEmail) {
        return res.status(401).json({
          success: false,
          message: "Authenticated user email is missing",
        });
      }

      const { bookingsCollection } = await getCollections();

      const userBookings = await bookingsCollection
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
        bookings: userBookings,
      });
    } catch (error) {
      forwardError(next, error, "Failed to fetch user dashboard stats");
    }
  };

module.exports = {
  get_admin_dashboard_stats,
  get_user_dashboard_stats,
};
