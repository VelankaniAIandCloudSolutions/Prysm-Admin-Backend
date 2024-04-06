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
    let result = await pool?.request()?.execute("sp_Get_Product_Document");
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
      ?.input("productDocumentID", sql?.Int, id)
      ?.execute("sp_Get_Product_Document_By_ID");

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
      let productDocumentData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("productDocumentID", sql?.Int, null)
        ?.input("is_active", sql?.Int, productDocumentData?.isActive)
        ?.input("name", sql?.NVarChar(255), productDocumentData?.name)
        ?.input("is_thumbnail", sql?.Int, productDocumentData?.isThumbnail)
        ?.input(
          "document_category_id",
          sql?.Int,
          productDocumentData?.documentCategoryID
        )
        ?.input("product_id", sql?.Int, productDocumentData?.productID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productDocumentIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Document");

      const productDocumentID = result.output.productDocumentIDOutput;

      if (productDocumentID !== null && productDocumentID !== "") {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        if (req?.files?.file) {
          const fileUploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Body: req?.files?.file.data,
            Key:
              "ProductDocument/" + productDocumentID + "/" + uuid?.output?.UUID,
          };
          await s3upload(fileUploadParams);

          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("productDocumentID", sql?.Int, productDocumentID)
            ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
            ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
            ?.input(
              "file_size",
              sql?.NVarChar,
              req?.files?.file.size?.toString()
            )
            ?.input("file_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
            ?.input(
              "product_document_path",
              sql?.NVarChar,
              "ProductDocument" +
                "/" +
                productDocumentID +
                "/" +
                uuid?.output?.UUID
            )
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("productDocumentIDOutput", sql?.Int)
            ?.execute("sp_Ins_Upd_Product_Document");
        }
      }

      if (productDocumentID === -1) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      } else if (
        productDocumentID !== null &&
        productDocumentID !== "" &&
        productDocumentID !== -1
      ) {
        return res.status(201).json({
          message: `Successfully inserted the data with Product Document ID = ${productDocumentID}`,
          productDocumentID: productDocumentID,
        });
      } else {
        return res.status(404).json({
          message: "Product Document Not Found",
        });
      }
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
      let productDocumentData = req.body;
      let productDocumentID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("productDocumentID", sql?.Int, productDocumentID)
        ?.input("is_active", sql?.Int, productDocumentData?.isActive)
        ?.input("name", sql?.NVarChar(255), productDocumentData?.name)
        ?.input("is_thumbnail", sql?.Int, productDocumentData?.isThumbnail)
        ?.input(
          "document_category_id",
          sql?.Int,
          productDocumentData?.documentCategoryID
        )
        ?.input("product_id", sql?.Int, productDocumentData?.productID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productDocumentIDOutput", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Document");

      const updatedProductDocumentID = result.output.productDocumentIDOutput;

      if (
        updatedProductDocumentID !== null &&
        updatedProductDocumentID !== "" &&
        updatedProductDocumentID !== -1
      ) {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        if (req?.files?.file) {
          const fileUploadParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Body: req?.files?.file.data,
            Key:
              "ProductDocument/" + productDocumentID + "/" + uuid?.output?.UUID,
          };
          await s3upload(fileUploadParams);

          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input("productDocumentID", sql?.Int, updatedProductDocumentID)
            ?.input("file_name", sql?.NVarChar, req?.files?.file.name)
            ?.input("file_type", sql?.NVarChar, req?.files?.file.mimetype)
            ?.input(
              "file_size",
              sql?.NVarChar,
              req?.files?.file.size?.toString()
            )
            ?.input("file_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
            ?.input(
              "product_document_path",
              sql?.NVarChar,
              "ProductDocument" +
                "/" +
                productDocumentID +
                "/" +
                uuid?.output?.UUID
            )
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("productDocumentIDOutput", sql?.Int)
            ?.execute("sp_Ins_Upd_Product_Document");
        }
      }

      if (updatedProductDocumentID === -1) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      } else if (
        updatedProductDocumentID !== null &&
        updatedProductDocumentID !== "" &&
        updatedProductDocumentID !== -1
      ) {
        return res.status(201).json({
          message: `Successfully Updated the data with Product Document ID = ${updatedProductDocumentID}`,
          productDocumentID: updatedProductDocumentID,
        });
      } else {
        return res.status(404).json({
          message: "Product Document Not Found",
        });
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
