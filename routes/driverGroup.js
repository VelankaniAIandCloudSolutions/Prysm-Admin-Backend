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
    let result = await pool?.request()?.execute("sp_Get_Driver_Group");
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
      ?.input("groupID", sql?.Int, id)
      ?.execute("sp_Get_Driver_Group_By_ID");

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
      let groupData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("group_id", sql?.Int, null)
        ?.input("name", sql?.NVarChar(255), groupData?.name)
        ?.input("description", sql?.NVarChar(255), groupData?.description)
        ?.input("status", sql?.Int, groupData?.status)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("groupID", sql?.Int)
        ?.execute("sp_Ins_Upd_Driver_Group");

      const groupID = result.output.groupID;

      if (groupID !== null && groupID !== "" && groupID !== -1) {
        let uuid = await pool
          ?.request()
          ?.output("UUID", sql.UniqueIdentifier)
          ?.execute("sp_Generate_UUID");
        let imageDetailsArray = groupData?.imageDetails;
        await Promise.all(
          imageDetailsArray?.map(async (imageDetails) => {
            var buf = Buffer.from(
              imageDetails?.fileContent.replace(/^data:image\/\w+;base64,/, ""),
              "base64"
            );
            const fileUploadParams = {
              Bucket: process.env.S3_BUCKET_NAME,
              Body: buf,
              Key: "DriverGroup/" + groupID + "/" + uuid?.output?.UUID,
              ContentEncoding: "base64",
              ContentType: imageDetails?.fileExtension,
            };
            await s3upload(fileUploadParams);
            let result = await pool
              ?.request()
              ?.input("Action", sql?.NVarChar(255), "UPDATE")
              ?.input("group_id", sql?.Int, groupID)
              ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
              ?.input("image_type", sql?.NVarChar, imageDetails?.fileExtension)
              ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
              ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
              ?.input(
                "image_url",
                sql?.NVarChar,
                "DriverGroup" + "/" + groupID + "/" + uuid?.output?.UUID
              )
              ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
              ?.output("groupID", sql?.Int)
              ?.execute("sp_Ins_Upd_Driver_Group");
          })
        );
      }

      if (groupID === null) {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Group ID = ${groupID}`,
        groupID: groupID,
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
      let groupData = req.body;
      let groupID = req.params.id;

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("group_id", sql?.Int, groupID)
        ?.input("name", sql?.NVarChar(255), groupData?.name)
        ?.input("description", sql?.NVarChar(255), groupData?.description)
        ?.input("status", sql?.Int, groupData?.status)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("groupID", sql?.Int)
        ?.execute("sp_Ins_Upd_Driver_Group");

      const updatedGroupID = result.output.groupID;

      if (
        updatedGroupID !== null &&
        updatedGroupID !== "" &&
        updatedGroupID !== -1
      ) {
        let path = await pool
          ?.request()
          ?.input("resourceType", sql?.NVarChar, "driverGroup")
          ?.input("id", sql?.Int, updatedGroupID)
          ?.output("path", sql?.NVarChar)
          ?.execute("sp_Get_Resource_Path");
        if (path?.output?.path === null || path?.output?.path === "") {
          let uuid = await pool
            ?.request()
            ?.output("UUID", sql.UniqueIdentifier)
            ?.execute("sp_Generate_UUID");
          let imageDetailsArray = groupData?.imageDetails;
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
                Key: "DriverGroup/" + updatedGroupID + "/" + uuid?.output?.UUID,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("group_id", sql?.Int, updatedGroupID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                ?.input(
                  "image_url",
                  sql?.NVarChar,
                  "DriverGroup" +
                    "/" +
                    updatedGroupID +
                    "/" +
                    uuid?.output?.UUID
                )
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("groupID", sql?.Int)
                ?.execute("sp_Ins_Upd_Driver_Group");
            })
          );
        } else {
          let uuid = null;
          if(groupData?.imageDetails?.length !== 0){
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

          let imageDetailsArray = groupData?.imageDetails;
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
                Key: "DriverGroup/" + updatedGroupID + "/" + uuid?.output?.UUID,
                ContentEncoding: "base64",
                ContentType: imageDetails?.fileExtension,
              };
              await s3upload(fileUploadParams);
              let result = await pool
                ?.request()
                ?.input("Action", sql?.NVarChar(255), "UPDATE")
                ?.input("group_id", sql?.Int, updatedGroupID)
                ?.input("image_name", sql?.NVarChar, imageDetails?.fileName)
                ?.input(
                  "image_type",
                  sql?.NVarChar,
                  imageDetails?.fileExtension
                )
                ?.input("image_size", sql?.NVarChar, imageDetails?.fileSize)
                ?.input("image_uuid", sql?.NVarChar(255), uuid?.output?.UUID)
                ?.input(
                  "image_url",
                  sql?.NVarChar,
                  "DriverGroup" +
                    "/" +
                    updatedGroupID +
                    "/" +
                    uuid?.output?.UUID
                )
                ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
                ?.output("groupID", sql?.Int)
                ?.execute("sp_Ins_Upd_Driver_Group");
            })
          );
        }
      }

      if (updatedGroupID === null) {
        return res.status(404).json({
          message: "Driver group not found.",
        });
      } else if (updatedGroupID === -1) {
        return res
          .status(409)
          .json({ message: `Driver Group ${groupData?.name} already exists.` });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Group ID = ${updatedGroupID}`,
        groupID: updatedGroupID,
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
      let groupId = req.params.id;
      let result = await pool
        ?.request()
        ?.input("groupId", sql?.Int, groupId)
        ?.output("deletedGroupId", sql?.Int)
        ?.execute("sp_Del_Driver_Group");

      const deletedGroupId = result.output.deletedGroupId;
      if (deletedGroupId === null) {
        return res.status(404).json({
          message: "Driver group not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${deletedGroupId}`,
        groupId: deletedGroupId,
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
