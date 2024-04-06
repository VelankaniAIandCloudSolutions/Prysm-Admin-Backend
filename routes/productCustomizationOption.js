require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const { verifyToken, decodeToken, handleServerError } = require("../Helper/helper");

router.get("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool
        ?.request()
        ?.execute("sp_Get_Product_Customization_Option");
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
        ?.input("customization_option_id", sql?.Int, id)
        ?.execute("sp_Get_Product_Customization_Option_By_ID");

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
      const pool = await sql?.connect(config);
      const productCustomizationOptionData = req.body;
      const customizationCategoryID =
        productCustomizationOptionData?.customizationCategoryID;
      for (const productCustomizationOptionDataIter of productCustomizationOptionData.options) {
        const result = await pool
          ?.request()
          ?.input("Action", sql?.NVarChar(255), "INSERT")
          ?.input("customization_option_id", sql?.Int, null)
          ?.input(
            "is_active",
            sql?.Int,
            productCustomizationOptionDataIter?.isActive
          )
          ?.input(
            "name",
            sql?.NVarChar(1000),
            productCustomizationOptionDataIter?.name
          )
          ?.input(
            "price",
            sql?.Numeric(10, 2),
            productCustomizationOptionDataIter?.price
          )
          ?.input("stock", sql?.Int, productCustomizationOptionDataIter?.stock)
          ?.input(
            "has_quantity",
            sql?.Int,
            productCustomizationOptionDataIter?.hasQuantity
          )
          ?.input(
            "customization_category_id",
            sql?.Int,
            customizationCategoryID
          )
          ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
          ?.output("customizationOptionID", sql?.Int)
          ?.execute("sp_Ins_Upd_Product_Customization_Option");

        const customizationOptionID = result.output.customizationOptionID;
        if (customizationOptionID === null || customizationOptionID === "") {
          return res.status(409).json({
            message:
              "Resource already exists. Operation failed due to a conflict.",
          });
        }
      }
      return res.status(201).json({
        message: "Successfully inserted the data",
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
router.put("/update", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productCustomizationOptionData = req.body;

      for (const productCustomizationOptionDataIter of productCustomizationOptionData) {
        const result = await pool
          ?.request()
          ?.input("Action", sql?.NVarChar(255), "UPDATE")
          ?.input(
            "customization_option_id",
            sql?.Int,
            productCustomizationOptionDataIter?.customizationOptionID
          )
          ?.input(
            "is_active",
            sql?.Int,
            productCustomizationOptionDataIter?.isActive
          )
          ?.input(
            "name",
            sql?.NVarChar(1000),
            productCustomizationOptionDataIter?.name
          )
          ?.input(
            "price",
            sql?.Numeric(10, 2),
            productCustomizationOptionDataIter?.price
          )
          ?.input("stock", sql?.Int, productCustomizationOptionDataIter?.stock)
          ?.input(
            "has_quantity",
            sql?.Int,
            productCustomizationOptionDataIter?.hasQuantity
          )
          ?.input(
            "customization_category_id",
            sql?.Int,
            productCustomizationOptionDataIter?.customizationCategoryID
          )
          ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
          ?.output("customizationOptionID", sql?.Int)
          ?.execute("sp_Ins_Upd_Product_Customization_Option");

        const customizationOptionID = result.output.customizationOptionID;

        if (customizationOptionID === null) {
          return res.status(404).json({
            message: "Product Customization Option not found",
          });
        }
      }

      return res.status(200).json({
        message: "Successfully updated the data",
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
        ?.input("customizationOptionId", sql?.Int, id)
        ?.output("deletedCustomizationOptionId", sql?.Int)
        ?.execute("sp_Del_Product_Customization_Option");

      const delId = result.output.deletedCustomizationOptionId;
      if (delId === null) {
        return res.status(404).json({
          message: "Product Customization Option not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        customizationOptionId: delId,
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
