require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 8000;

app.use(
  cors({
    origin: true,
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
    message: status >= 500 ? "Internal server error" : error.message,
    error: error.message,
  });
});

if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Server is running locally on http://localhost:${PORT}`);
  });
}

module.exports = app;
