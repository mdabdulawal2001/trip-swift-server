const express = require("express");
const controllers = require("../controllers/contactController");

const router = express.Router();

router.post("/contact", controllers.post_contact);

module.exports = router;
