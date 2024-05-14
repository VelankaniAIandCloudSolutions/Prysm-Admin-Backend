require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const {
  verifyToken,
  decodeToken,
  handleServerError,
} = require("../Helper/helper");

router.get("/", async (req, res) => {
  try {
    const pool = await sql?.connect(config);
    const result = await pool?.request()?.execute("sp_Get_mail_conversation");
    res.status(200).json(result.recordsets[0]);
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    const result = await pool
      ?.request()
      ?.input("conversationID", sql?.Int, id)
      ?.execute("sp_Get_mail_conversation_By_ID");

    if (result.recordsets[0].length === 0) {
      res.status(404).send("Data not found");
    } else {
      res.json(result.recordsets[0]);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST
router.post("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let conversationData = req?.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("conversation_id", sql?.Int, null)
        ?.input("eticket_id", sql?.Int, conversationData?.eticketID)
        ?.input("sender_id", sql?.Int, conversationData?.senderID)
        ?.input("receiver_id", sql?.Int, conversationData?.receiverID)
        ?.input("message", sql?.NVarChar, conversationData?.message)
        ?.input("messaged_at", sql?.DateTime, conversationData?.messagedAt)
        ?.output("conversationID", sql?.Int)
        ?.execute("sp_Ins_Upd_mail_conversation");

      const conversationID = result.output.conversationID;

      if (conversationID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Conversation ID = ${conversationID}`,
        conversationID: conversationID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// PUT
router.put("/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let conversationData = req?.body;
      let id = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("conversation_id", sql?.Int, id)
        ?.input("eticket_id", sql?.Int, conversationData?.eticketID)
        ?.input("sender_id", sql?.Int, conversationData?.senderID)
        ?.input("receiver_id", sql?.Int, conversationData?.receiverID)
        ?.input("message", sql?.NVarChar, conversationData?.message)
        ?.input("messaged_at", sql?.DateTime, conversationData?.messagedAt)
        ?.output("conversationID", sql?.Int)
        ?.execute("sp_Ins_Upd_mail_conversation");

      const conversationID = result.output.conversationID;
      if (conversationID === null) {
        return res.status(404).json({
          message: "Manual not found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Conversation ID = ${conversationID}`,
        conversationID: conversationID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.use((req, res) => {
  return res.status(404).json({
    error: `${req.originalUrl} Not Found`,
  });
});

module.exports = router;
