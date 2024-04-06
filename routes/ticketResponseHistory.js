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
const {sendmail} = require("../send_mail/sendMail");

router.get("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool?.request()?.execute("sp_Get_Ticket_Res_History");
      res.status(200).json(result.recordsets[0]);
    }
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
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool
        ?.request()
        ?.input("ticket_response_id", sql?.Int, id)
        ?.execute("sp_Get_Ticket_Res_History_By_ID");

      if (result.recordsets[0].length === 0) {
        res.status(404).send("Data not found");
      } else {
        res.json(result.recordsets[0]);
      }
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
        const ticketResponseData = req?.body;

        const result4UUID = await pool
        ?.request()
        ?.input("eticket_id", sql?.Int, ticketResponseData?.eTicketID)
        ?.execute("sp_Get_Ticket_By_ID");

      if (result4UUID.recordsets[0].length !== 0) {
        const messageID = sendmail(ticketResponseData, result4UUID.recordsets[0][0].UUID);
        if(messageID !== null){
        let result = await pool
          ?.request()
          ?.input("Action", sql.NVarChar(255), "INSERT")
          ?.input("sender_email_id", sql.NVarChar(255), decodedToken?.user)
          ?.input("receiver_email_id", sql.NVarChar(255), ticketResponseData?.receiverEmailID)
          ?.input("subject", sql.NVarChar(sql.MAX), ticketResponseData?.subject)
          ?.input("body", sql.NVarChar(sql.MAX), ticketResponseData?.body)
          ?.input("eTicket_id", sql.Int, ticketResponseData?.eTicketID)
          ?.input("response_received_from", sql.Int, ticketResponseData?.responseReceivedFrom)
          ?.input("last_updated_by", sql.Int, decodedToken?.userId)
          ?.output("ticket_response_id_out", sql.Int)
          ?.execute("sp_Ins_Ticket_Res_History");
  
        const ticketResponseId = result.output.ticket_response_id_out;
        if (ticketResponseId === null) {
          res.status(409).json({
            message: "Insert failed",
          });
        }
        return res.status(201).json({
          message: `Successfully inserted the data with Ticket Response ID = ${ticketResponseId}`,
          ticketResponseID: ticketResponseId,
        });
      }
      }else{
        res.status(404).send("Data not found");
      }
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
