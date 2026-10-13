const express = require("express");
const { verifyToken, authorizeRole } = require("../middleware/auth");
const controllers = require("../controllers/dashboardController");

const router = express.Router();

// ADMIN DASHBOARD STATS
// ADMIN ONLY


router.get("/admin/dashboard-stats", verifyToken, authorizeRole("admin"), controllers.get_admin_dashboard_stats);


// USER DASHBOARD STATS
// USER ONLY


router.get("/user/dashboard-stats", verifyToken, authorizeRole("user"), controllers.get_user_dashboard_stats);

module.exports = router;
