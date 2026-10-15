
const express = require("express");
const { connectDB } = require("../config/database");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post("/contact", async (req, res, next) => {
  const { name, email, subject, message } = req.body || {};
  const normalized = {
    name: typeof name === "string" ? name.trim() : "",
    email: typeof email === "string" ? email.trim().toLowerCase() : "",
    subject: typeof subject === "string" ? subject.trim() : "",
    message: typeof message === "string" ? message.trim() : "",
  };

  if (
    normalized.name.length < 2 ||
    normalized.name.length > 80 ||
    !emailPattern.test(normalized.email) ||
    normalized.email.length > 254 ||
    normalized.subject.length < 5 ||
    normalized.subject.length > 120 ||
    normalized.message.length < 20 ||
    normalized.message.length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message: "Please provide valid contact details and a 20–2000 character message.",
    });
  }

  try {
    const database = await connectDB();
    await database.collection("contactMessages").insertOne({
      ...normalized,
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Your message has been saved.",
    });
  } catch (error) {
    return next(error);
  }
});




