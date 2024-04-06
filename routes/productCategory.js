require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const { s3download, s3upload, s3delete } = require("../Helper/S3Helper");
const {
  verifyToken,
  decodeToken,
  handleServerError,
} = require("../Helper/helper");
const MAX = 99;

router.get("/", async (req, res) => {
  try {
    const pool = await sql?.connect(config);
    let result = await pool?.request()?.execute("sp_Get_Product_Categories");
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
      ?.input("productCategoryID", sql?.Int, id)
      ?.execute("sp_Get_Product_Categories_By_ID");

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
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: "Content/en/translation.json",
    };
    const dataresult = await s3download(params);
    const json = { ...JSON.parse(dataresult.Body.toString()) };

    let productCategoryData = req.body;
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let activeParentsCount = MAX;
      let activeChild4ParentCount = MAX;
      try {
        let result = await pool
          ?.request()
          ?.execute("sp_Get_Product_Categories");
        const activeParents = result.recordsets[0].filter((item) => {
          return item.parentProductCategoryID === null && item.isActive === 1;
        });
        const activeChild4Parent = result.recordsets[0].filter((item) => {
          return (
            item.parentProductCategoryID ===
              productCategoryData?.parentProductCategoryID &&
            item.isActive === 1
          );
        });
        activeParentsCount = activeParents.length;
        activeChild4ParentCount = activeChild4Parent.length;
      } catch (error) {
        logger.error(err);
        if (!res.headersSent) {
          handleServerError(res, err);
        }
      }
      let insertable = false;
      if (
        productCategoryData?.isActive === 2 ||
        productCategoryData?.isActive === 3 ||
        ((productCategoryData?.parentProductCategoryID === null ||
          productCategoryData?.parentProductCategoryID === undefined) &&
          activeParentsCount < 8) ||
        ((productCategoryData?.parentProductCategoryID !== null ||
          productCategoryData?.parentProductCategoryID !== undefined) &&
          activeChild4ParentCount < 10)
      ) {
        insertable = true;
      }

      if (insertable) {
        let result = await pool
          ?.request()
          ?.input("Action", sql?.NVarChar(255), "INSERT")
          ?.input("product_category_id", sql?.Int, null)
          ?.input("is_active", sql?.Int, productCategoryData?.isActive)
          ?.input("name", sql?.NVarChar(255), productCategoryData?.name)
          ?.input(
            "parent_product_category_id",
            sql?.Int,
            productCategoryData?.parentProductCategoryID
          )
          ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
          ?.input(
            "description",
            sql?.NVarChar(sql?.MAX),
            productCategoryData?.description
          )
          ?.output("productCategoryID", sql?.Int)
          ?.execute("sp_Ins_Upd_Product_Category");

        const productCategoryID = result.output.productCategoryID;
        let uuid;
        if (productCategoryID !== null || productCategoryID !== "") {
          uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");
          let imageDetailsArray = productCategoryData?.imageDetails;
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
                Key:
                  "ProductCategory/" +
                  productCategoryID +
                  "/" +
                  uuid?.output?.UUID,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("product_category_id", sql?.Int, productCategoryID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                ?.input(
                  "product_category_image_path",
                  sql?.NVarChar,
                  "ProductCategory" +
                    "/" +
                    productCategoryID +
                    "/" +
                    uuid?.output?.UUID
                )
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("productCategoryID", sql?.Int)
                ?.execute("sp_Ins_Upd_Product_Category");
            })
          );
        }

        if (productCategoryID === null || productCategoryID === "") {
          return res.status(409).json({
            message:
              "Resource already exists. Operation failed due to a conflict.",
          });
        }

        if (productCategoryData.parentProductCategoryID == null) {
          const newProductFam = {
            productFamilyId: productCategoryID,
            productFamilyTitle: productCategoryData?.name,
            productDescription: productCategoryData?.description,
            imageURL:
              "ProductCategory" +
              "/" +
              productCategoryID +
              "/" +
              uuid?.output?.UUID,
            isActive: productCategoryData?.isActive,
          };
          let productFamily = [...json["productFamily"]];
          productFamily.push(newProductFam);
          json["productFamily"] = [...productFamily];
        } else {
          let subProduct = {
            productId: productCategoryID,
            productFamilyId: productCategoryData.parentProductCategoryID,
            productTitle: productCategoryData?.name,
            imageURL:
              "ProductCategory" +
              "/" +
              productCategoryID +
              "/" +
              uuid?.output?.UUID,
            isActive: productCategoryData?.isActive,
          };
          let productFamilyproducts = [...json["browseProduct"]["products"]];
          productFamilyproducts.push(subProduct);
          json["browseProduct"]["products"] = [...productFamilyproducts];
        }
        const params2 = {
          Bucket: process.env.S3_BUCKET_NAME,
          Body: JSON.stringify(json),
          Key: "Content/en/translation.json",
        };
        await s3upload(params2);

        return res.status(201).json({
          message: `Sucessfully inserted the data with Product ID = ${productCategoryID}`,
          productCategoryID: productCategoryID,
        });
      } else {
        return res.status(422).json({
          message:
            "Failed to INSERT. set status=InActive, atleast in one product category to insert.",
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
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: "Content/en/translation.json",
    };
    const dataresult = await s3download(params);
    const json = { ...JSON.parse(dataresult.Body.toString()) };

    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      let productCategoryData = req.body;
      let productCategoryId = req.params.id;
      let pool = await sql?.connect(config);
      let activeParentsCount = MAX;
      let activeChild4ParentCount = MAX;
      try {
        let result = await pool
          ?.request()
          ?.execute("sp_Get_Product_Categories");
        const activeParents = result.recordsets[0].filter((item) => {
          return item.parentProductCategoryID === null && item.isActive === 1;
        });
        const activeChild4Parent = result.recordsets[0].filter((item) => {
          return (
            item.parentProductCategoryID ===
              productCategoryData?.parentProductCategoryID &&
            item.isActive === 1
          );
        });
        activeParentsCount = activeParents.length;
        activeChild4ParentCount = activeChild4Parent.length;
      } catch (error) {
        logger.error(err);
        if (!res.headersSent) {
          handleServerError(res, err);
        }
      }
      let updatable = false;
      if (
        productCategoryData?.isActive === 2 ||
        productCategoryData?.isActive === 3 ||
        ((productCategoryData?.parentProductCategoryID === null ||
          productCategoryData?.parentProductCategoryID === undefined) &&
          activeParentsCount < 8) ||
        ((productCategoryData?.parentProductCategoryID !== null ||
          productCategoryData?.parentProductCategoryID !== undefined) &&
          activeChild4ParentCount < 10)
      ) {
        updatable = true;
      }
      if (updatable) {
        let result = await pool
          ?.request()
          ?.input("Action", sql?.NVarChar(255), "UPDATE")
          ?.input("product_category_id", sql?.Int, productCategoryId)
          ?.input("is_active", sql?.Int, productCategoryData?.isActive)
          ?.input("name", sql?.NVarChar(255), productCategoryData?.name)
          ?.input(
            "parent_product_category_id",
            sql?.Int,
            productCategoryData?.parentProductCategoryID
          )
          ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
          ?.input(
            "description",
            sql?.NVarChar(sql?.MAX),
            productCategoryData?.description
          )
          ?.output("productCategoryID", sql?.Int)
          ?.execute("sp_Ins_Upd_Product_Category");

        const productCategoryID = result.output.productCategoryID;

        let img_path;
        if (
          productCategoryID !== null &&
          productCategoryID !== "" &&
          productCategoryID !== -1
        ) {
          let path = await pool
            ?.request()
            ?.input("resourceType", sql?.NVarChar, "productCategory")
            ?.input("id", sql?.Int, productCategoryID)
            ?.output("path", sql?.NVarChar)
            ?.execute("sp_Get_Resource_Path");
          if (path?.output?.path === null || path?.output?.path === "") {
            let uuid = await pool
              ?.request()
              ?.output("UUID", sql.UniqueIdentifier)
              ?.execute("sp_Generate_UUID");
            let imageDetailsArray = productCategoryData?.imageDetails;
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
                  Key:
                    "ProductCategory/" +
                    productCategoryID +
                    "/" +
                    uuid?.output?.UUID,
                  ContentEncoding: "base64",
                  ContentType: imageDetails?.fileExtension,
                };
                img_path =
                  "ProductCategory/" +
                  productCategoryID +
                  "/" +
                  uuid?.output?.UUID;
                await s3upload(fileUploadParams);
                let result = await pool
                  ?.request()
                  ?.input("Action", sql?.NVarChar(255), "UPDATE")
                  ?.input("product_category_id", sql?.Int, productCategoryID)
                  ?.input(
                    "parent_product_category_id",
                    sql?.Int,
                    productCategoryData?.parentProductCategoryID
                  )
                  ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                  ?.input(
                    "image_type",
                    sql?.NVarChar,
                    imageDetails?.fileExtension
                  )
                  ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                  ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                  ?.input(
                    "product_category_image_path",
                    sql?.NVarChar,
                    "ProductCategory" +
                      "/" +
                      productCategoryID +
                      "/" +
                      uuid?.output?.UUID
                  )
                  ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                  ?.output("productCategoryID", sql?.Int)
                  ?.execute("sp_Ins_Upd_Product_Category");
              })
            );
          } else {
            let uuid = null;
            if(productCategoryData?.imageDetails?.length !== 0){
            const deleteParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Key: path?.output?.path,
            };
            await s3delete(deleteParams);
          
             uuid = await pool
              ?.request()
              ?.output("UUID", sql.UniqueIdentifier)
              ?.execute("sp_Generate_UUID");
            img_path =
              "ProductCategory/" + productCategoryID + "/" + uuid?.output?.UUID;
          }
          else {
            img_path = path?.output?.path
          }
            let imageDetailsArray = productCategoryData?.imageDetails;
            await Promise.all(
              imageDetailsArray?.map(async (imageDetails) => {
                if(productCategoryData?.imageDetails?.length !== 0){
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
                  Key: img_path,
                  ContentEncoding: "base64",
                  ContentType: imageDetails?.fileExtension,
                };
                await s3upload(fileUploadParams);
              }
                let result = await pool
                  ?.request()
                  ?.input("Action", sql?.NVarChar(255), "UPDATE")
                  ?.input("product_category_id", sql?.Int, productCategoryID)
                  ?.input(
                    "parent_product_category_id",
                    sql?.Int,
                    productCategoryData?.parentProductCategoryID
                  )
                  ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                  ?.input(
                    "image_type",
                    sql?.NVarChar,
                    imageDetails?.fileExtension
                  )
                  ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                  ?.input("image_uuid", sql?.NVarChar(255), uuid?uuid?.output?.UUID:null)
                  ?.input(
                    "product_category_image_path",
                    sql?.NVarChar,
                    img_path
                  )
                  ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                  ?.output("productCategoryID", sql?.Int)
                  ?.execute("sp_Ins_Upd_Product_Category");
              })
            );
          }
        }

        let productFamily = [...json["productFamily"]];
        let tobeUpdatedProdCatFam = productFamily.filter(
          (fam) => fam.productFamilyId === productCategoryID
        );
        let productFamilyproducts = [...json["browseProduct"]["products"]];
        let tobeUpdatedProd = productFamilyproducts.filter(
          (fam) => fam.productId === productCategoryID
        );

        if (!productCategoryData?.parentProductCategoryID) {
          let newProductFam = {
            productFamilyId: productCategoryID,
            productFamilyTitle: productCategoryData?.name,
            productDescription: productCategoryData?.description,
            imageURL: img_path,
            isActive: productCategoryData?.isActive,
          };
          if (tobeUpdatedProdCatFam.length !== 0) {
            newProductFam = {
              ...tobeUpdatedProdCatFam[0],
              ...newProductFam,
            };
          } else if (tobeUpdatedProd.length !== 0) {
            let restSubProductFamily = productFamilyproducts.filter(
              (fam) => fam.productId !== productCategoryID
            );
            json["browseProduct"]["products"] = [...restSubProductFamily];
          }
          let restProductFamily = productFamily.filter(
            (fam) => fam.productFamilyId !== productCategoryID
          );
          restProductFamily.push(newProductFam);
          json["productFamily"] = [...restProductFamily];
        } else {
          let subProduct = {
            productId: productCategoryID,
            productFamilyId: productCategoryData.parentProductCategoryID,
            productTitle: productCategoryData?.name,
            imageURL: img_path,
            isActive: productCategoryData?.isActive,
          };
          let restProductFamily = productFamilyproducts.filter(
            (fam) => fam.productId !== productCategoryID
          );
          restProductFamily.push(subProduct);
          json["browseProduct"]["products"] = [...restProductFamily];
          if (tobeUpdatedProdCatFam.length !== 0) {
            let ProductFamily = productFamily.filter(
              (fam) => fam.productFamilyId !== productCategoryID
            );
            json["productFamily"] = [...ProductFamily];
          }
        }
        const params2 = {
          Bucket: process.env.S3_BUCKET_NAME,
          Body: JSON.stringify(json),
          Key: "Content/en/translation.json",
        };
        await s3upload(params2);

        if (productCategoryID === null || productCategoryID === "") {
          return res.status(404).json({
            message: "Product not found",
          });
        } else if (productCategoryID === -1) {
          return res.status(409).json({
            message: `Product Category with name ${productCategoryData?.name} already exists.`,
          });
        }

        return res.status(200).json({
          message: `Successfully updated the data with Product Category ID = ${productCategoryID}`,
          productCategoryID: productCategoryID,
        });
      } else {
        return res.status(422).json({
          message:
            "Failed to UPDATE, set status=InActive, atleast in one product category to update.",
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
        ?.input("productCategoryId", sql?.Int, id)
        ?.output("deletedProductCategoryId", sql?.Int)
        ?.execute("sp_Del_Product_Category");

      const delId = result.output.deletedProductCategoryId;
      if (delId === null) {
        return res.status(404).json({
          message: "Product Category not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        productCategoryId: delId,
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
