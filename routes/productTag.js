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
      const result = await pool?.request()?.execute("sp_Get_Product_Tag");
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
        ?.input("product_tag_id", sql?.Int, id)
        ?.execute("sp_Get_Product_Tag_By_ID");

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
      const productTagData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("product_tag_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, productTagData?.isActive)
        ?.input("name", sql?.NVarChar(255), productTagData?.name)
        ?.input(
          "product_category_id",
          sql?.Int,
          productTagData?.productCategoryID
        )
        ?.input(
          "product_tag_category_id",
          sql?.Int,
          productTagData?.productTagCategoryID
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productTagID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Tag");

      const productTagID = result.output.productTagID;
      if (productTagID === null) {
        res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Product Tag ID = ${productTagID}`,
        productTagID: productTagID,
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
      const productTagData = req.body;
      let productTagId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("product_tag_id", sql?.Int, productTagId)
        ?.input("is_active", sql?.Int, productTagData?.isActive)
        ?.input("name", sql?.NVarChar(255), productTagData?.name)
        ?.input(
          "product_category_id",
          sql?.Int,
          productTagData?.productCategoryID
        )
        ?.input(
          "product_tag_category_id",
          sql?.Int,
          productTagData?.productTagCategoryID
        )
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productTagID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Tag");

      const productTagID = result.output.productTagID;
      if (productTagID === null) {
        res.status(404).json({
          message: "Product Tag Not Found.",
        });
      } else if (productTagID === -1) {
        res.status(409).json({
          message: `Product Tag with name ${productTagData?.name} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Product Tag ID = ${productTagID}`,
        productTagID: productTagID,
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
        ?.input("productTagId", sql?.Int, id)
        ?.output("deletedProductTagId", sql?.Int)
        ?.execute("sp_Del_Product_Tag");

      const delId = result.output.deletedProductTagId;
      if (delId === null) {
        return res.status(404).json({
          message: "Product Tag not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        productTagId: delId,
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
