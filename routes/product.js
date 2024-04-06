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
const { s3download, s3upload, s3delete } = require("../Helper/S3Helper");

router.get("/", async (req, res) => {
  try {
    const pool = await sql?.connect(config);
    let result = await pool?.request()?.execute("sp_Get_Product");
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
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Product_By_ID");

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

// GET active product by its product_category_id
router.get("/active/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await sql?.connect(config);
    let result = await pool?.request()?.execute("sp_Get_Product");

    const activeProductsByProductCategoryID = result.recordsets[0].filter(
      (product) => {
        return (
          product.productCategoryID === parseInt(id) && product.isActive === 1
        );
      }
    );
    if (activeProductsByProductCategoryID.length === 0) {
      res.status(404).send("Data not found");
    } else {
      return res.status(200).json(activeProductsByProductCategoryID);
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
      let productData = req.body.product;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("product_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, productData?.isActive)
        ?.input("name", sql?.NVarChar(255), productData?.name)
        ?.input(
          "product_description",
          sql?.NVarChar(sql?.MAX),
          productData?.productDescription
        )
        ?.input("price", sql?.Numeric(10, 2), productData?.price)
        ?.input(
          "price_with_tax",
          sql?.Numeric(10, 2),
          productData?.priceWithTax
        )
        ?.input("stock", sql?.Int, productData?.stock)
        ?.input("product_category_id", sql?.Int, productData?.productCategoryID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input(
          "product_feature",
          sql?.NVarChar(sql.MAX),
          productData?.productFeature
        )
        ?.output("productID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product");

      const productID = result.output.productID;

      if (productID !== null || productID !== "") {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        let imageDetailsArray = productData?.imageDetails;
        await Promise.all(
          imageDetailsArray?.map(async (imageDetails) => {
            var buf = Buffer.from(
              imageDetails?.fileContent.replace(/^data:image\/\w+;base64,/, ""),
              "base64"
            );
            const fileUploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Body: buf,
              Key: "Product/" + productID + "/" + uuid?.output?.UUID,
              ContentEncoding: "base64",
              ContentType: imageDetails?.fileExtension,
            };
            await s3upload(fileUploadParams);
            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("product_id", sql?.Int, productID)
              ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
              ?.input("image_type", sql?.NVarChar, imageDetails?.fileExtension)
              ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
              ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
              ?.input(
                "product_image_path",
                sql?.NVarChar,
                "Product" + "/" + productID + "/" + uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product");
          })
        );
      }

      if (productID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Product ID = ${productID}`,
        productID: productID,
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
      let productData = req.body.product;
      let productId = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("product_id", sql?.Int, productId)
        ?.input("is_active", sql?.Int, productData?.isActive)
        ?.input("name", sql?.NVarChar(255), productData?.name)
        ?.input(
          "product_description",
          sql?.NVarChar(sql?.MAX),
          productData?.productDescription
        )
        ?.input("price", sql?.Numeric(10, 2), productData?.price)
        ?.input(
          "price_with_tax",
          sql?.Numeric(10, 2),
          productData?.priceWithTax
        )
        ?.input("stock", sql?.Int, productData?.stock)
        ?.input("product_category_id", sql?.Int, productData?.productCategoryID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input(
          "product_feature",
          sql?.NVarChar(sql.MAX),
          productData?.productFeature
        )
        ?.output("productID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product");

      const productID = result.output.productID;

      if (productID !== null && productID !== "" && productID !== -1) {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "product")
          ?.input("id", sql?.Int, productID)
          ?.output("path", sql?.NVarChar)
          ?.execute("sp_Get_Resource_Path");
        if (path?.output?.path === null || path?.output?.path === "") {
          let uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");
          let imageDetailsArray = productData?.imageDetails;
          if (
            productData?.imageDetails &&
            imageDetailsArray &&
            imageDetailsArray.length > 0
          ) {
            await Promise.all(
              imageDetailsArray?.map(async (imageDetails) => {
                var buf = Buffer.from(
                  imageDetails?.fileContent.replace(
                    /^data:image\/\w+;base64,/,
                    ""
                  ),
                  "base64"
                );
                const fileUploadParams = {
                  Bucket: process.env.S3_BUCKET_NAME,
                  Body: buf,
                  Key: "Product/" + productID + "/" + uuid?.output?.UUID,
                  ContentEncoding: "base64",
                  ContentType: imageDetails?.fileExtension,
                };
                await s3upload(fileUploadParams);
                let result = await pool
                  ?.request()
                  ?.input("Action", sql?.NVarChar(255), "UPDATE")
                  ?.input("product_id", sql?.Int, productID)
                  ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                  ?.input(
                    "image_type",
                    sql?.NVarChar,
                    imageDetails?.fileExtension
                  )
                  ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                  ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                  ?.input(
                    "product_image_path",
                    sql?.NVarChar,
                    "Product" + "/" + productID + "/" + uuid?.output?.UUID
                  )
                  ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                  ?.output("productID", sql?.Int)
                  ?.execute("sp_Ins_Upd_Product");
              })
            );
          }
        } else {
          let uuid = null;
          if(productData?.imageDetails?.length !== 0){
          uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");

          const deleteParams = {
            Bucket: process.env.S3_BUCKET_NAME,
            Key: path?.output?.path,
          };
          await s3delete(deleteParams);
        }

          let imageDetailsArray = productData?.imageDetails;
          if (
            productData?.imageDetails &&
            imageDetailsArray &&
            imageDetailsArray.length > 0
          ) {
            await Promise.all(
              imageDetailsArray?.map(async (imageDetails) => {
                var buf = Buffer.from(
                  imageDetails?.fileContent.replace(
                    /^data:image\/\w+;base64,/,
                    ""
                  ),
                  "base64"
                );
                const fileUploadParams = {
                  Bucket: process.env.S3_BUCKET_NAME,
                  Body: buf,
                  Key: "Product" + "/" + productID + "/" + uuid?.output?.UUID,
                  ContentEncoding: "base64",
                  ContentType: imageDetails?.fileExtension,
                };
                await s3upload(fileUploadParams);
                let result = await pool
                  ?.request()
                  ?.input("Action", sql?.NVarChar(255), "UPDATE")
                  ?.input("product_id", sql?.Int, productID)
                  ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                  ?.input(
                    "image_type",
                    sql?.NVarChar,
                    imageDetails?.fileExtension
                  )
                  ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                  ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                  ?.input(
                    "product_image_path",
                    sql?.NVarChar,
                    "Product" + "/" + productID + "/" + uuid?.output?.UUID
                  )
                  ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                  ?.output("productID", sql?.Int)
                  ?.execute("sp_Ins_Upd_Product");
              })
            );
          }
        }
      }

      if (productID === null) {
        return res.status(404).json({
          message: "Product not found.",
        });
      } else if (productID === -1) {
        return res.status(409).json({
          message: `Product ${productData?.name} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Product ID = ${productID}`,
        productID: productID,
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
        ?.input("productId", sql?.Int, id)
        ?.output("deletedProductId", sql?.Int)
        ?.execute("sp_Del_Product");

      const delId = result.output.deletedProductId;
      if (delId === null) {
        return res.status(404).json({
          message: "Product not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        productId: delId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST with driver howto and manual
router.post("/complete", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productData = req?.body?.product;
      let driverIDs = req?.body?.driverId;
      let howTosIdIDs = req?.body?.howTosId;
      let manualsIdIDs = req?.body?.manualsId;
      let prdCustDftQtyIDs = req?.body?.prdCustDftQtyId;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("product_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, productData?.isActive)
        ?.input("name", sql?.NVarChar(255), productData?.name)
        ?.input(
          "product_description",
          sql?.NVarChar(sql?.MAX),
          productData?.productDescription
        )
        ?.input("price", sql?.Numeric(10, 2), productData?.price)
        ?.input(
          "price_with_tax",
          sql?.Numeric(10, 2),
          productData?.priceWithTax
        )
        ?.input("stock", sql?.Int, productData?.stock)
        ?.input("product_category_id", sql?.Int, productData?.productCategoryID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product");

      const productID = result.output.productID;

      if (productID !== null && productID !== "") {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        let imageDetailsArray = productData?.imageDetails;
        await Promise.all(
          imageDetailsArray?.map(async (imageDetails) => {
            var buf = Buffer.from(
              imageDetails?.fileContent.replace(/^data:image\/\w+;base64,/, ""),
              "base64"
            );
            const fileUploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Body: buf,
              Key: "Product/" + productID + "/" + uuid?.output?.UUID,
              ContentEncoding: "base64",
              ContentType: imageDetails?.fileExtension,
            };
            await s3upload(fileUploadParams);
            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("product_id", sql?.Int, productID)
              ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
              ?.input("image_type", sql?.NVarChar, imageDetails?.fileExtension)
              ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
              ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
              ?.input(
                "product_image_path",
                sql?.NVarChar,
                "Product" + "/" + productID + "/" + uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product");
          })
        );
      }

      if (productID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      if (productID !== null) {
        await Promise.all(
          driverIDs?.map(async (driver) => {
            let resultProductDriver = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("product_id", sql?.Int, productID)
              ?.input("driver_id", sql?.Int, driver?.id)
              ?.input("product_driver_status", sql?.Int, driver?.status)
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productDriverID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product_Driver");
            const productDriverID =
              resultProductDriver?.output?.productDriverID;
            // insertedProductDriverID.push(productDriverID);
          })
        );
        await Promise.all(
          manualsIdIDs?.map(async (manual) => {
            let resultProductManual = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("product_id", sql?.Int, productID)
              ?.input("manuals_id", sql?.Int, manual?.id)
              ?.input("product_manuals_status", sql?.Int, manual?.status)
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productManualsID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product_Manuals");
            const productManualsID =
              resultProductManual?.output?.productManualsID;
            // insertedProductManualsID.push(productManualsID);
          })
        );
        await Promise.all(
          howTosIdIDs?.map(async (howTos) => {
            let resultProductHowto = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("product_id", sql?.Int, productID)
              ?.input("howto_id", sql?.Int, howTos?.id)
              ?.input("product_howto_status", sql?.Int, howTos?.status)
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productHowtoID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product_Howto");
            const productHowtoID = resultProductHowto?.output?.productHowtoID;
            // insertedProductHowtoID.push(productHowtoID);
          })
        );
        await Promise.all(
          prdCustDftQtyIDs?.map(async (data) => {
            await Promise.all(
              data?.options?.map(async (prdCDQ) => {
                let result = await pool
                  ?.request()
                  ?.input("Action", sql?.NVarChar(255), "INSERT")
                  ?.input(
                    "product_customization_default_quantity_id",
                    sql?.Int,
                    null
                  )
                  ?.input("is_active", sql?.Int, prdCDQ?.isActive)
                  ?.input("default_quantity", sql?.Int, prdCDQ?.defaultQuantity)
                  ?.input("is_default", sql?.Int, prdCDQ?.isDefault)
                  ?.input(
                    "customization_option_id",
                    sql?.Int,
                    prdCDQ?.customizationOptionID
                  )
                  ?.input("product_id", sql?.Int, productID)
                  ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                  ?.input("max_quantity", sql?.Int, prdCDQ?.maxQuantity)
                  ?.input("min_quantity", sql?.Int, prdCDQ?.minQuantity)
                  ?.output("productCustomizationDefaultQuantityID", sql?.Int)
                  ?.execute("sp_Ins_Upd_Prd_Cust_Default_Qty");
                const productCustomizationDefaultQuantityID =
                  result.output.productCustomizationDefaultQuantityID;
              })
            );
          })
        );
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Product ID = ${productID}`,
        productID: productID,
        // productDriverID: insertedProductDriverID,
        // productHowtoIDs: insertedProductHowtoID,
        // productManualsID: insertedProductManualsID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.put("/complete/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    let productId = req.params.id;
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productData = req?.body?.product;
      let driverIDs = req?.body?.driverId;
      let howTosIdIDs = req?.body?.howTosId;
      let manualsIdIDs = req?.body?.manualsId;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("product_id", sql?.Int, productId)
        ?.input("is_active", sql?.Int, productData?.isActive)
        ?.input("name", sql?.NVarChar(255), productData?.name)
        ?.input(
          "product_description",
          sql?.NVarChar(sql?.MAX),
          productData?.productDescription
        )
        ?.input("price", sql?.Numeric(10, 2), productData?.price)
        ?.input(
          "price_with_tax",
          sql?.Numeric(10, 2),
          productData?.priceWithTax
        )
        ?.input("stock", sql?.Int, productData?.stock)
        ?.input("product_category_id", sql?.Int, productData?.productCategoryID)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("productID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product");

      const productID = result.output.productID;
      if (productID !== null && productID !== "" && productID !== -1) {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "product")
          ?.input("id", sql?.Int, productID)
          ?.output("path", sql?.NVarChar)
          ?.execute("sp_Get_Resource_Path");
        if (path?.output?.path === null || path?.output?.path === "") {
          let uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");
          let imageDetailsArray = productData?.imageDetails;
          await Promise.all(
            imageDetailsArray?.map(async (imageDetails) => {
              var buf = Buffer.from(
                imageDetails?.fileContent.replace(
                  /^data:image\/\w+;base64,/,
                  ""
                ),
                "base64"
              );
              const fileUploadParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Body: buf,
                Key: "Product/" + productID + "/" + uuid?.output?.UUID,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("product_id", sql?.Int, productID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                ?.input(
                  "product_image_path",
                  sql?.NVarChar,
                  "Product" + "/" + productID + "/" + uuid?.output?.UUID
                )
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("productID", sql?.Int)
                ?.execute("sp_Ins_Upd_Product");
            })
          );
        } else {
          let imageDetailsArray = productData?.imageDetails;
          await Promise.all(
            imageDetailsArray?.map(async (imageDetails) => {
              var buf = Buffer.from(
                imageDetails?.fileContent.replace(
                  /^data:image\/\w+;base64,/,
                  ""
                ),
                "base64"
              );
              const fileUploadParams = {
                Bucket: process.env.S3_BUCKET_NAME,
                Body: buf,
                Key: path?.output?.path,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("product_id", sql?.Int, productID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("productID", sql?.Int)
                ?.execute("sp_Ins_Upd_Product");
            })
          );
        }
      }
      if (productID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      } else if (productID === -1) {
        return res.status(409).json({
          message: `Product ${productData?.name} already exists.`,
        });
      }
      if (productID !== null && productID !== -1) {
        await Promise.all(
          driverIDs?.map(async (driver) => {
            let resultProductDriver = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("product_id", sql?.Int, productID)
              ?.input("driver_id", sql?.Int, driver?.id)
              ?.input("product_driver_status", sql?.Int, driver?.status)
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productDriverID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product_Driver");
            const productDriverID =
              resultProductDriver?.output?.productDriverID;
            // insertedProductDriverID.push(productDriverID);
          })
        );
        await Promise.all(
          manualsIdIDs?.map(async (manual) => {
            let resultProductManual = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("product_id", sql?.Int, productID)
              ?.input("manuals_id", sql?.Int, manual?.id)
              ?.input("product_manuals_status", sql?.Int, manual?.status)
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productManualsID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product_Manuals");
            const productManualsID =
              resultProductManual?.output?.productManualsID;
            // insertedProductManualsID.push(productManualsID);
          })
        );
        await Promise.all(
          howTosIdIDs?.map(async (howTos) => {
            let resultProductHowto = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "INSERT")
              ?.input("product_id", sql?.Int, productID)
              ?.input("howto_id", sql?.Int, howTos?.id)
              ?.input("product_howto_status", sql?.Int, howTos?.status)
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("productHowtoID", sql?.Int)
              ?.execute("sp_Ins_Upd_Product_Howto");
            const productHowtoID = resultProductHowto?.output?.productHowtoID;
            // insertedProductHowtoID.push(productHowtoID);
          })
        );
      }
      return res.status(200).json({
        message: `Successfully updated the data with Product ID = ${productID}`,
        productID: productID,
        // productDriverID: insertedProductDriverID,
        // productHowtoIDs: insertedProductHowtoID,
        // productManualsID: insertedProductManualsID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.get("/complete/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Product_By_ID_With_Drivers_Manuals_HowTo");
    let resultRecords = result.recordsets[0][0];
    if (result.length === 0) {
      res.status(404).send("Data not found");
    } else if (resultRecords) {
      res.json(JSON.parse(Object.values(resultRecords)[0]));
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// Get manuals by product id
router.get("/manuals_by_prd/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Manuals_By_ProductID");

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

// Get tags by product id
router.get("/tags_by_prd/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Tags_By_ProductID");

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

// Get drivers by product id
router.get("/drivers_by_prd/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Drivers_By_ProductID");

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

// Get howtos by product id
router.get("/howtos_by_prd/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_Howtos_By_ProductID");

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

// Get prdCustDftQty w/t CustOpt and CustCat by product id
router.get("/custopt_by_prd/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("productID", sql?.Int, id)
      ?.execute("sp_Get_PrdCustDftQty_With_CustOpt_CustCat_By_PrdID");

    let resultRecords = result.recordsets[0][0];
    if (result.length === 0) {
      res.status(404).send("Data not found");
    } else if (resultRecords) {
      let data = Object.values(resultRecords);
      if (data[0] !== null && data[0] !== "") {
        res.json(JSON.parse(Object.values(resultRecords)[0]));
      }
      res.status(404).send("Data not found");
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST Insert tags by product id
router.post("/ins_tags_by_prd", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productID = req?.body?.productID;
      let tagsIDs = req?.body?.tagsIds;

      await Promise.all(
        tagsIDs?.map(async (tag) => {
          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "INSERT")
            ?.input("id", sql?.Int, null)
            ?.input("product_id", sql?.Int, productID)
            ?.input("producttag_id", sql?.Int, tag?.id)
            ?.input("is_active", sql?.Int, tag?.status)
            ?.output("idOut", sql?.Int)
            ?.execute("sp_Ins_Upd_Product_Tags");
          const id = result?.output?.idOut;
          if (id === null) {
            return res.status(400).json({
              message: "Insert Failed",
            });
          }
        })
      );

      return res.sendStatus(201);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// Update tags by product id and product tag id
router.put("/upd_tags/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productTagId = req.params.id;
      let payload = req?.body;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("id", sql?.Int, null)
        ?.input("product_id", sql?.Int, payload?.productID)
        ?.input("producttag_id", sql?.Int, productTagId)
        ?.input("is_active", sql?.Int, payload?.isActive)
        ?.output("idOut", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Tags");
      const id = result?.output?.idOut;
      if (id === null) {
        return res.status(400).json({
          message: "Update Failed",
        });
      } else if (id === -1) {
        return res.status(404).json({
          message: "Data not found",
        });
      } else if (id === 0) {
        return res.sendStatus(200);
      }
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST Insert manuals by product id
router.post("/ins_manuals_by_prd", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productID = req?.body?.productID;
      let manualsIdIDs = req?.body?.manualsId;

      await Promise.all(
        manualsIdIDs?.map(async (manual) => {
          let resultProductManual = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "INSERT")
            ?.input("product_id", sql?.Int, productID)
            ?.input("manuals_id", sql?.Int, manual?.id)
            ?.input("product_manuals_status", sql?.Int, manual?.status)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("productManualsID", sql?.Int)
            ?.execute("sp_Ins_Upd_Product_Manuals");
          const productManualsID =
            resultProductManual?.output?.productManualsID;
          if (productManualsID === null) {
            return res.status(400).json({
              message: "Insert Failed",
            });
          }
        })
      );

      return res.sendStatus(201);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST Insert drivers by product id
router.post("/ins_drivers_by_prd", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productID = req?.body?.productID;
      let driverIDs = req?.body?.driverId;

      await Promise.all(
        driverIDs?.map(async (driver) => {
          let resultProductDriver = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "INSERT")
            ?.input("product_id", sql?.Int, productID)
            ?.input("driver_id", sql?.Int, driver?.id)
            ?.input("product_driver_status", sql?.Int, driver?.status)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("productDriverID", sql?.Int)
            ?.execute("sp_Ins_Upd_Product_Driver");
          const productDriverID = resultProductDriver?.output?.productDriverID;
          if (productDriverID === null) {
            return res.status(400).json({
              message: "Insert Failed",
            });
          }
        })
      );
      return res.sendStatus(201);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST Insert howtos by product id
router.post("/ins_howtos_by_prd", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productID = req?.body?.productID;
      let howTosIdIDs = req?.body?.howTosId;

      await Promise.all(
        howTosIdIDs?.map(async (howTos) => {
          let resultProductHowto = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "INSERT")
            ?.input("product_id", sql?.Int, productID)
            ?.input("howto_id", sql?.Int, howTos?.id)
            ?.input("product_howto_status", sql?.Int, howTos?.status)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.output("productHowtoID", sql?.Int)
            ?.execute("sp_Ins_Upd_Product_Howto");
          const productHowtoID = resultProductHowto?.output?.productHowtoID;
          if (productHowtoID === null) {
            return res.status(400).json({
              message: "Insert Failed",
            });
          }
        })
      );

      return res.sendStatus(201);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// POST Insert productCustDftQty by product id
router.post("/ins_prdCustDftQty_by_prd", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productID = req?.body?.productID;
      let prdCustDftQtyIDs = req?.body?.prdCustDftQtyId;

      await Promise.all(
        prdCustDftQtyIDs?.map(async (prdCDQ) => {
          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "INSERT")
            ?.input("product_customization_default_quantity_id", sql?.Int, null)
            ?.input("is_active", sql?.Int, prdCDQ?.isActive)
            ?.input("default_quantity", sql?.Int, prdCDQ?.defaultQuantity)
            ?.input("is_default", sql?.Int, prdCDQ?.isDefault)
            ?.input(
              "customization_option_id",
              sql?.Int,
              prdCDQ?.customizationOptionID
            )
            ?.input("product_id", sql?.Int, productID)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.input("max_quantity", sql?.Int, prdCDQ?.maxQuantity)
            ?.input("min_quantity", sql?.Int, prdCDQ?.minQuantity)
            ?.output("productCustomizationDefaultQuantityID", sql?.Int)
            ?.execute("sp_Ins_Upd_Prd_Cust_Default_Qty");
          const productCustomizationDefaultQuantityID =
            result.output.productCustomizationDefaultQuantityID;
          if (productCustomizationDefaultQuantityID === null) {
            return res.status(400).json({
              message: "Insert Failed",
            });
          }
        })
      );

      return res.sendStatus(201);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// put Insert productCustDftQty by product id
router.post("/upd_prdCustDftQty_by_prd", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let productID = req?.body?.productID;
      let prdCustDftQtyIDs = req?.body?.prdCustDftQtyId;

      await Promise.all(
        prdCustDftQtyIDs?.map(async (prdCDQ) => {
          let result = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "UPDATE")
            ?.input(
              "product_customization_default_quantity_id",
              sql?.Int,
              prdCDQ?.productCustomizationDefaultQuantityID
            )
            ?.input("is_active", sql?.Int, prdCDQ?.isActive)
            ?.input("default_quantity", sql?.Int, prdCDQ?.defaultQuantity)
            ?.input("is_default", sql?.Int, prdCDQ?.isDefault)
            ?.input(
              "customization_option_id",
              sql?.Int,
              prdCDQ?.customizationOptionID
            )
            ?.input("product_id", sql?.Int, productID)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.input("max_quantity", sql?.Int, prdCDQ?.maxQuantity)
            ?.input("min_quantity", sql?.Int, prdCDQ?.minQuantity)
            ?.output("productCustomizationDefaultQuantityID", sql?.Int)
            ?.execute("sp_Ins_Upd_Prd_Cust_Default_Qty");
          const productCustomizationDefaultQuantityID =
            result.output.productCustomizationDefaultQuantityID;
          if (productCustomizationDefaultQuantityID === null) {
            return res.status(400).json({
              message: "Update Failed",
            });
          }
        })
      );

      return res.sendStatus(200);
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
