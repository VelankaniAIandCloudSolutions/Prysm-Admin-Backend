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
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool?.request()?.execute("sp_Get_Ticket");
      res.status(200).json(result?.recordsets[0]);
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
        ?.input("eticket_id", sql?.Int, id)
        ?.execute("sp_Get_Ticket_By_ID");

      if (result.recordsets[0].length === 0) {
        res.status(404).send("Data not found");
      } else {
        let opt = result.recordset[0];
        opt.additionalFiles = JSON.parse(opt.additionalFiles);
        res.status(200).json([opt]);
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
      const ticketData = req?.body;
      let uuid = await pool
        ?.request()
        ?.output("UUID", sql.UniqueIdentifier)
        ?.execute("sp_Generate_UUID");
      let result = await pool
        ?.request()
        ?.input("Action", sql.NVarChar(255), "INSERT")
        ?.input("eticket_id", sql?.Int, null)
        ?.input("created_by", sql?.Int, decodedToken?.userId)
        ?.input("serial_number", sql?.NVarChar(255), ticketData?.serialNumber)
        ?.input("problem_id", sql?.Int, ticketData?.problemID)
        ?.input("status", sql?.Int, ticketData?.status)
        ?.input(
          "client_ticket_ref_no",
          sql?.NVarChar(255),
          ticketData?.clientTicketRefNo
        )
        ?.input(
          "issue_description",
          sql?.NVarChar(sql?.MAX),
          ticketData?.issueDescription
        )
        ?.input(
          "diagnostic_code",
          sql?.NVarChar(255),
          ticketData?.diagnosticCode
        )
        ?.input("diagnostic_date", sql?.DateTime, ticketData?.diagnosticDate)
        ?.input("country_id", sql?.Int, ticketData?.countryID)
        ?.input("first_name", sql?.NVarChar(255), ticketData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), ticketData?.lastName)
        ?.input("email", sql?.NVarChar(255), ticketData?.email)
        ?.input(
          "alternate_email",
          sql?.NVarChar(255),
          ticketData?.alternateEmail
        )
        ?.input("mobile_number", sql?.NVarChar(255), ticketData?.mobileNumber)
        ?.input(
          "alternate_mobile_number",
          sql?.NVarChar(255),
          ticketData?.alternateMobileNumber
        )
        ?.input("company_name", sql?.NVarChar(255), ticketData?.companyName)
        ?.input("address", sql?.NVarChar(sql?.MAX), ticketData?.address)
        ?.input("city", sql?.NVarChar(100), ticketData?.city)
        ?.input("state", sql?.NVarChar(100), ticketData?.state)
        ?.input("postal_code", sql?.NVarChar(100), ticketData?.postalCode)
        ?.input("country", sql?.NVarChar(100), ticketData?.country)
        ?.input(
          "machine_address",
          sql?.NVarChar(255),
          ticketData?.machineAddress
        )
        ?.input("machine_city", sql?.NVarChar(100), ticketData?.machineCity)
        ?.input("machine_state", sql?.NVarChar(100), ticketData?.machineState)
        ?.input(
          "machine_country",
          sql?.NVarChar(100),
          ticketData?.machineCountry
        )
        ?.input(
          "machine_postal_code",
          sql?.NVarChar(100),
          ticketData?.machinePostalCode
        )
        ?.input("assigned_to", sql?.Int, ticketData?.assignedTo)
        ?.input("UUID", sql?.NVarChar(255), uuid?.output?.UUID)
        ?.input(
          "additional_email",
          sql?.NVarChar(sql?.MAX),
          ticketData?.additionalEmail
        )
        ?.input(
          "additional_files",
          sql?.NVarChar(sql?.MAX),
          JSON.stringify(ticketData?.additionalFiles)
        )
        ?.input("comment", sql?.NVarChar(sql?.MAX), ticketData?.comment)
        ?.input("eta", sql?.NVarChar(sql?.DateTime), ticketData?.eta)
        ?.input("priority_level", sql?.Int, 2) //ticketData.priorityLevel
        ?.output("eticketIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Ticket");

      const eticketID = result.output.eticketIDOutput;
      if (eticketID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with eTicket ID = ${eticketID}`,
        eticketID: eticketID,
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
      const ticketData = req?.body;
      let eTicketID = req.params.id;
      let result = await pool
        ?.request()
        ?.input("Action", sql.NVarChar(255), "UPDATE")
        ?.input("eticket_id", sql?.Int, eTicketID)
        ?.input("created_by", sql?.Int, decodedToken?.userId)
        ?.input("serial_number", sql?.NVarChar(255), ticketData?.serialNumber)
        ?.input("problem_id", sql?.Int, ticketData?.problemID)
        ?.input("status", sql?.Int, ticketData?.status)
        ?.input(
          "client_ticket_ref_no",
          sql?.NVarChar(255),
          ticketData?.clientTicketRefNo
        )
        ?.input(
          "issue_description",
          sql?.NVarChar(sql?.MAX),
          ticketData?.issueDescription
        )
        ?.input(
          "diagnostic_code",
          sql?.NVarChar(255),
          ticketData?.diagnosticCode
        )
        ?.input("diagnostic_date", sql?.DateTime, ticketData?.diagnosticDate)
        ?.input("country_id", sql?.Int, ticketData?.countryID)
        ?.input("first_name", sql?.NVarChar(255), ticketData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), ticketData?.lastName)
        ?.input("email", sql?.NVarChar(255), ticketData?.email)
        ?.input(
          "alternate_email",
          sql?.NVarChar(255),
          ticketData?.alternateEmail
        )
        ?.input("mobile_number", sql?.NVarChar(255), ticketData?.mobileNumber)
        ?.input(
          "alternate_mobile_number",
          sql?.NVarChar(255),
          ticketData?.alternateMobileNumber
        )
        ?.input("company_name", sql?.NVarChar(255), ticketData?.companyName)
        ?.input("address", sql?.NVarChar(sql?.MAX), ticketData?.address)
        ?.input("city", sql?.NVarChar(100), ticketData?.city)
        ?.input("state", sql?.NVarChar(100), ticketData?.state)
        ?.input("postal_code", sql?.NVarChar(100), ticketData?.postalCode)
        ?.input("country", sql?.NVarChar(100), ticketData?.country)
        ?.input(
          "machine_address",
          sql?.NVarChar(255),
          ticketData?.machineAddress
        )
        ?.input("machine_city", sql?.NVarChar(100), ticketData?.machineCity)
        ?.input("machine_state", sql?.NVarChar(100), ticketData?.machineState)
        ?.input(
          "machine_country",
          sql?.NVarChar(100),
          ticketData?.machineCountry
        )
        ?.input(
          "machine_postal_code",
          sql?.NVarChar(100),
          ticketData?.machinePostalCode
        )
        ?.input("assigned_to", sql?.Int, ticketData?.assignedTo)
        ?.input(
          "additional_email",
          sql?.NVarChar(sql?.MAX),
          ticketData?.additionalEmail
        )
        ?.input(
          "additional_files",
          sql?.NVarChar(sql?.MAX),
          JSON.stringify(ticketData?.additionalFiles)
        )
        ?.input("comment", sql?.NVarChar(sql?.MAX), ticketData?.comment)
        ?.input("eta", sql?.NVarChar(sql?.DateTime), ticketData?.eta)
        ?.input("priority_level", sql?.Int, 2) //ticketData.priorityLevel
        ?.output("eticketIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Ticket");

      const eticketID = result.output.eticketIDOutput;
      if (eticketID === null) {
        res.status(404).json({
          message: "Ticket not found",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with eTicket ID = ${eticketID}`,
        eticketID: eticketID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// assign ticket
router.post("/assign_ticket", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      const ticketData = req?.body;

      await Promise.all(
        ticketData.eTicketIDs?.map(async (eTicketID) => {
          let result = await pool
            ?.request()
            ?.input("Action", sql.NVarChar(255), "UPDATE")
            ?.input("eticket_id", sql?.Int, eTicketID)
            ?.input("assigned_to", sql?.Int, ticketData?.assignedTo)
            ?.input("status", sql?.Int, ticketData?.status)
            ?.input("priority_level", sql?.Int, ticketData?.priorityLevel)
            ?.output("eticketIDOutput", sql?.Int)
            ?.execute("sp_Ins_Upd_Ticket");
        })
      );
      return res.status(200).json({
        message: "Successfully assigned ticket",
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
