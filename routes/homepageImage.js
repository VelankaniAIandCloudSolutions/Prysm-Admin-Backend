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
    let result = await pool?.request()?.execute("sp_Get_Homepg_Img");
    return res.status(200).json(result.recordsets[0]);
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.get("/:id", async (req, res) => {
  const { id } = req?.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("homepageImageID", sql?.Int, id)
      ?.execute("sp_Get_Homepg_Img_By_ID");

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
      let homepgImgData = req?.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("home_page_image_id", sql?.BigInt, null)
        ?.input("is_active", sql?.Int, homepgImgData?.status)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("display_order", sql?.Int, homepgImgData?.displayOrder)
        ?.output("homepageImageID", sql?.BigInt)
        ?.execute("sp_Ins_Upd_Homepg_Img");

      const homepageImageID = result.output.homepageImageID;

      if (
        homepageImageID !== null &&
        homepageImageID !== "" &&
        homepageImageID !== -1
      ) {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        let imageDetailsArray = homepgImgData?.imageDetails;
        await Promise.all(
          imageDetailsArray?.map(async (imageDetails) => {
            var buf = Buffer.from(
              imageDetails?.fileContent.replace(/^data:image\/\w+;base64,/, ""),
              "base64"
            );
            const fileUploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Body: buf,
              Key:
                "HomepageImage/" + homepageImageID + "/" + uuid?.output?.UUID,
              ContentEncoding: "base64",
              ContentType: imageDetails?.fileExtension,
            };
            await s3upload(fileUploadParams);
            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("home_page_image_id", sql?.Int, homepageImageID)
              ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
              ?.input("image_type", sql?.NVarChar, imageDetails?.fileExtension)
              ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
              ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
              ?.input(
                "image_file_path",
                sql?.NVarChar,
                "HomepageImage/" + homepageImageID + "/" + uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("homepageImageID", sql?.Int)
              ?.execute("sp_Ins_Upd_Homepg_Img");
          })
        );
      }

      if (homepageImageID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Homepage Image ID = ${homepageImageID}`,
        homepageImageID: homepageImageID,
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
      let homepgImgData = req?.body;
      let homepageImageID = req?.params?.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("home_page_image_id", sql?.Int, homepageImageID)
        ?.input("is_active", sql?.Int, homepgImgData?.status)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("display_order", sql?.Int, homepgImgData?.displayOrder)
        ?.output("homepageImageID", sql?.BigInt)
        ?.execute("sp_Ins_Upd_Homepg_Img");

      const updatedHomepgImgID = result.output.homepageImageID;

      if (
        updatedHomepgImgID !== null &&
        updatedHomepgImgID !== "" &&
        updatedHomepgImgID !== -1
      ) {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "HomepgImg")
          ?.input("id", sql?.Int, updatedHomepgImgID)
          ?.output("path", sql?.NVarChar)
          ?.execute("sp_Get_Resource_Path");
        if (path?.output?.path === null || path?.output?.path === "") {
          let uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");
          let imageDetailsArray = homepgImgData?.imageDetails;
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
                  "HomepageImage/" +
                  updatedHomepgImgID +
                  "/" +
                  uuid?.output?.UUID,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("home_page_image_id", sql?.Int, updatedHomepgImgID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                ?.input(
                  "image_file_path",
                  sql?.NVarChar,
                  "HomepageImage/" +
                    updatedHomepgImgID +
                    "/" +
                    uuid?.output?.UUID
                )
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("homepageImageID", sql?.Int)
                ?.execute("sp_Ins_Upd_Homepg_Img");
            })
          );
        } else {
          let uuid = null;
          if(homepgImgData?.imageDetails.length !== 0){
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

          let imageDetailsArray = homepgImgData?.imageDetails;
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
                  "HomepageImage/" +
                  updatedHomepgImgID +
                  "/" +
                  uuid?.output?.UUID,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("home_page_image_id", sql?.Int, updatedHomepgImgID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                ?.input(
                  "image_file_path",
                  sql?.NVarChar,
                  "HomepageImage/" +
                    updatedHomepgImgID +
                    "/" +
                    uuid?.output?.UUID
                )
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("homepageImageID", sql?.Int)
                ?.execute("sp_Ins_Upd_Homepg_Img");
            })
          );
        }
      }

      if (updatedHomepgImgID === null) {
        return res.status(404).json({
          message: "Homepage Image not found.",
        });
      } else if (updatedHomepgImgID === -1) {
        return res.status(409).json({
          message: `Homepage Image displayOrder ${homepgImgData?.displayOrder} already exists.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Homepage Image ID = ${updatedHomepgImgID}`,
        homepageImageID: updatedHomepgImgID,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

module.exports = router;
