require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8000;
const allowedOrigins = process.env.NEXT_PUBLIC_BETTER_AUTH_URL
  ? [new URL(process.env.NEXT_PUBLIC_BETTER_AUTH_URL).origin]
  : [];

app.use(
  cors({
    origin(origin, callback) {
      // Requests without an Origin header (for example server-to-server calls) remain allowed.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json());

app.get("/", (req, res) => {
  res.status(200).json({
    message: "Trip Swift Server is running smoothly!",
    status: "Active",
  });
});

app.use(require("./routes/tickets"));
app.use(require("./routes/bookings"));
app.use(require("./routes/dashboard"));
app.use(require("./routes/payments"));
app.use(require("./routes/contact"));

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  });
});

app.use((error, req, res, next) => {
  console.error("Unhandled Server Error:", error);

  const candidateStatus = Number(error.status || error.statusCode);
  const status =
    Number.isInteger(candidateStatus) && candidateStatus >= 400 && candidateStatus < 600
      ? candidateStatus
      : 500;

  res.status(status).json({
    success: false,
    message: error.publicMessage || (status >= 500 ? "Internal server error" : error.message),
    ...(!error.publicMessage ? { error: error.message } : {}),
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
});

module.exports = app;


