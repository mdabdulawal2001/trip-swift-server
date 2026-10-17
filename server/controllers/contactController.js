const { ObjectId } = require("mongodb");
const { getCollections } = require("../config/database");
const { forwardError } = require("../utils/helpers");

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const post_contact = async (req, res, next) => {
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
    const { contactMessagesCollection } = await getCollections();

    await contactMessagesCollection.insertOne({
      ...normalized,
      createdAt: new Date(),
    });

    return res.status(201).json({
      success: true,
      message: "Your message has been saved.",
    });
  } catch (error) {
    return forwardError(next, error, "Failed to save contact message.");
  }
};

const get_contact_admin = async (req, res, next) => {
  try {
    const { contactMessagesCollection } = await getCollections();
    const messages = await contactMessagesCollection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return res.status(200).json({ success: true, messages });
  } catch (error) {
    return forwardError(next, error, "Failed to fetch contact messages.");
  }
};

const delete_contact_id = async (req, res, next) => {
  const { id } = req.params;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid contact message ID.",
    });
  }

  try {
    const { contactMessagesCollection } = await getCollections();
    const result = await contactMessagesCollection.deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount !== 1) {
      return res.status(404).json({
        success: false,
        message: "Contact message not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact message deleted.",
    });
  } catch (error) {
    return forwardError(next, error, "Failed to delete contact message.");
  }
};

module.exports = {
  post_contact,
  get_contact_admin,
  delete_contact_id,
};
