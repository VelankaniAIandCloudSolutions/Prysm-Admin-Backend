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
    const pool = await sql.connect(config);
    const result = await pool.request().execute("sp_Get_User_Address");
    return res.status(200).json(result.recordsets[0]);
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
    const pool = await sql.connect(config);
    const result = await pool
      .request()
      .input("userAddressID", sql.Int, id)
      .execute("sp_Get_User_Address_By_ID");

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
      const pool = await sql?.connect(config);
      const userAddressData = req.body;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("user_address_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, userAddressData?.isActive)
        ?.input(
          "street_address_1",
          sql?.NVarChar(200),
          userAddressData?.streetAddress1
        )
        ?.input(
          "street_address_2",
          sql?.NVarChar(200),
          userAddressData?.streetAddress2
        )
        ?.input("city", sql?.NVarChar(100), userAddressData?.city)
        ?.input("state", sql?.NVarChar(100), userAddressData?.state)
        ?.input("postal_code", sql?.NVarChar(20), userAddressData?.postalCode)
        ?.input(
          "address_type",
          sql?.NVarChar(255),
          userAddressData?.addressType
        )
        ?.input("email", sql?.NVarChar(254), userAddressData?.email)
        ?.input("phone_number", sql?.NVarChar(13), userAddressData?.phoneNumber)
        ?.input("first_name", sql?.NVarChar(255), userAddressData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), userAddressData?.lastName)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("user_id", sql?.Int, userAddressData?.userId)
        ?.output("userAddressID", sql?.Int)
        ?.execute("sp_Ins_Upd_User_Address");

      const userAddressID = result.output.userAddressID;

      if (userAddressID === null) {
        return res.status(409).json({
          message: "User Address already exists.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted user address with User Address ID = ${userAddressID}`,
        userAddressID: userAddressID,
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
      const pool = await sql?.connect(config);
      const userAddressData = req.body;
      const userAddressId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("user_address_id", sql?.Int, userAddressId)
        ?.input("is_active", sql?.Int, userAddressData?.isActive)
        ?.input(
          "street_address_1",
          sql?.NVarChar(200),
          userAddressData?.streetAddress1
        )
        ?.input(
          "street_address_2",
          sql?.NVarChar(200),
          userAddressData?.streetAddress2
        )
        ?.input("city", sql?.NVarChar(100), userAddressData?.city)
        ?.input("state", sql?.NVarChar(100), userAddressData?.state)
        ?.input("postal_code", sql?.NVarChar(20), userAddressData?.postalCode)
        ?.input(
          "address_type",
          sql?.NVarChar(255),
          userAddressData?.addressType
        )
        ?.input("email", sql?.NVarChar(254), userAddressData?.email)
        ?.input("phone_number", sql?.NVarChar(13), userAddressData?.phoneNumber)
        ?.input("first_name", sql?.NVarChar(255), userAddressData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), userAddressData?.lastName)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("user_id", sql?.Int, userAddressData?.userId)
        ?.output("userAddressID", sql?.Int)
        ?.execute("sp_Ins_Upd_User_Address");

      const userAddressID = result.output.userAddressID;
      if (userAddressID === null) {
        return res.status(404).json({
          message:
            "User Address with the provided user_address_id does not exist.",
        });
      } else if (userAddressID === -1) {
        return res.status(409).json({
          message: "User Address already exists.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated User Address with User Address ID = ${userAddressID}`,
        userAddressID: userAddressID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// DELETE
router.delete("/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];

    if (verifyToken(res, token)) {
      let pool = await sql?.connect(config);
      let id = req.params.id;
      let result = await pool
        ?.request()
        ?.input("userAddressID", sql?.Int, id)
        ?.output("deletedUserAddressID", sql?.Int)
        ?.execute("sp_Del_User_Address");

      const delId = result.output.deletedUserAddressID;

      if (delId === null) {
        return res.status(404).json({
          message: "User Address not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the user address with ID = ${delId}`,
        userAddressId: delId,
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
