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
const { s3download, s3upload } = require("../Helper/S3Helper");

router.get("/", async (req, res) => {
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.execute("sp_Get_Product_Document_Category");
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
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productDocumentCategoryID", sql?.Int, id)
      ?.execute("sp_Get_Product_Document_Category_By_ID");

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
      let productDocumentCategoryData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("productDocumentCategoryID", sql?.Int, null)
        ?.input("is_active", sql?.Int, productDocumentCategoryData?.isActive)
        ?.input("name", sql?.NVarChar(255), productDocumentCategoryData?.name)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productDocumentCategoryIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Document_Category");

      const productDocumentCategoryID =
        result.output.productDocumentCategoryIDOutput;

      if (
        productDocumentCategoryID !== null &&
        productDocumentCategoryID !== ""
      ) {
        return res.status(201).json({
          message: `Successfully inserted the data with Product Document Category ID = ${productDocumentCategoryID}`,
          productDocumentCategoryID: productDocumentCategoryID,
        });
      }

      return res.status(409).json({
        message: "Resource already exists. Operation failed due to a conflict.",
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
      let productDocumentCategoryData = req.body;
      let productDocumentCategoryID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input(
          "productDocumentCategoryID",
          sql?.Int,
          productDocumentCategoryID
        )
        ?.input("is_active", sql?.Int, productDocumentCategoryData?.isActive)
        ?.input("name", sql?.NVarChar(255), productDocumentCategoryData?.name)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productDocumentCategoryIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Document_Category");

      const updatedProductDocumentCategoryID =
        result.output.productDocumentCategoryIDOutput;

      if (
        updatedProductDocumentCategoryID !== null &&
        updatedProductDocumentCategoryID !== "" &&
        updatedProductDocumentCategoryID !== -1
      ) {
        return res.status(200).json({
          message: `Successfully updated the data with Product Document Category ID = ${updatedProductDocumentCategoryID}`,
          productDocumentCategoryID: updatedProductDocumentCategoryID,
        });
      } else if (updatedProductDocumentCategoryID === -1) {
        return res.status(409).json({
          message: `Product Document Category with name ${productDocumentCategoryData?.name} already exists.`,
        });
      }

      return res.status(404).json({
        message: "Product Document Category not found.",
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
