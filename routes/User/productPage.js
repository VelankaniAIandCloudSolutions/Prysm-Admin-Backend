require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../../dbConfig");
const logger = require("../../logger");
const {
  verifyToken,
  decodeToken,
  handleServerError,
} = require("../../Helper/helper");

router.get("/howto/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Product_By_ID_How_To");

    let resultRecords = result.recordsets;
    if (!resultRecords || resultRecords.length === 0 || resultRecords === "") {
      res.status(404).send("Data not found");
    } else if (resultRecords) {
      res.json(resultRecords[0]);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST
router.post("/howto", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];

    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);

      const productHowtoData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("product_howto_id", sql?.Int, null)
        ?.input("howto_id", sql?.Int, productHowtoData?.howtoID)
        ?.input("product_id", sql?.Int, productHowtoData?.productID)
        ?.input(
          "product_howto_status",
          sql?.Int,
          productHowtoData?.productHowtoStatus
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productHowtoID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Howto");

      const productHowtoID = result.output.productHowtoID;
      if (productHowtoID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Product Howto ID = ${productHowtoID}`,
        productHowtoID: productHowtoID,
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
router.put("/howto/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      const productHowtoData = req.body;
      let productHowtoID = req.params.id;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("product_howto_id", sql?.Int, productHowtoID)
        // ?.input("howto_id", sql?.Int, productHowtoData?.howtoID)
        // ?.input("product_id", sql?.Int, productHowtoData?.productID)
        ?.input("product_howto_status", sql?.Int, productHowtoData?.status)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productHowtoID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Howto");

      const updatedProductHowtoID = result.output.productHowtoID;
      if (updatedProductHowtoID === null) {
        res.status(404).json({
          message: "Product Howto Not Found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Product Howto ID = ${updatedProductHowtoID}`,
        productHowtoID: updatedProductHowtoID,
      });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.get("/driver/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    const result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Product_By_ID_Driver");

    const resultRecords = result.recordsets;

    if (!resultRecords || resultRecords.length === 0 || resultRecords === "") {
      res.status(404).send("Data not found");
    } else {
      res.json(resultRecords[0]);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST
router.post("/driver", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];

    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);

      const productDriverData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("product_driver_id", sql?.Int, null)
        ?.input("driver_id", sql?.Int, productDriverData?.driverID)
        ?.input("product_id", sql?.Int, productDriverData?.productID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input(
          "product_driver_status",
          sql?.Int,
          productDriverData?.productDriverStatus
        )
        ?.output("productDriverID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Driver");

      const productDriverID = result.output.productDriverID;
      if (productDriverID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Product Driver ID = ${productDriverID}`,
        productDriverID: productDriverID,
      });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// PUT
router.put("/driver/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      const productDriverData = req.body;
      let productDriverID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("product_driver_id", sql?.Int, productDriverID)
        // ?.input("driver_id", sql?.Int, productDriverData?.driverID)
        // ?.input("product_id", sql?.Int, productDriverData?.productID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("product_driver_status", sql?.Int, productDriverData?.status)
        ?.output("productDriverID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Driver");

      const updatedProductDriverID = result.output.productDriverID;
      if (updatedProductDriverID === null) {
        res.status(404).json({
          message: "Product Driver Not Found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Product Driver ID = ${updatedProductDriverID}`,
        productDriverID: updatedProductDriverID,
      });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.get("/manuals/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    const result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Product_By_ID_Manuals");

    const resultRecords = result.recordsets;

    if (!resultRecords || resultRecords.length === 0 || resultRecords === "") {
      res.status(404).send("Data not found");
    } else {
      res.json(resultRecords[0]);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST
router.post("/manuals", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];

    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);

      const productManualData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("product_manuals_id", sql?.Int, null)
        ?.input("manuals_id", sql?.Int, productManualData?.manualsID)
        ?.input("product_id", sql?.Int, productManualData?.productID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input(
          "product_manuals_status",
          sql?.Int,
          productManualData?.productManualsStatus
        )
        ?.output("productManualsID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Manuals");

      const productManualsID = result.output.productManualsID;
      if (productManualsID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }

      return res.status(201).json({
        message: `Successfully inserted the data with Product Manuals ID = ${productManualsID}`,
        productManualsID: productManualsID,
      });
    }
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// PUT
router.put("/manuals/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      const productManualData = req.body;
      let productManualsID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("product_manuals_id", sql?.Int, productManualsID)
        // ?.input("manuals_id", sql?.Int, productManualData?.manualsID)
        // ?.input("product_id", sql?.Int, productManualData?.productID)
        // ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("product_manuals_status", sql?.Int, productManualData?.status)
        ?.output("productManualsID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Manuals");

      const updatedProductManualsID = result.output.productManualsID;
      if (updatedProductManualsID === null) {
        res.status(404).json({
          message: "Product Manuals Not Found.",
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Product Manuals ID = ${updatedProductManualsID}`,
        productManualsID: updatedProductManualsID,
      });
    }
  } catch (err) {
    console.error(err);
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
