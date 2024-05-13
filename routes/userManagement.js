require("dotenv").config();
const express = require("express");
const router = express.Router();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");
const bcrypt = require("bcrypt");
const {
  verifyToken,
  decodeToken,
  handleServerError,
} = require("../Helper/helper");
const { route } = require("./login");
var CryptoJS = require("crypto-js");

router.get("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      let result = await pool?.request()?.execute("sp_Get_User_Account");
      return res.status(200).json(result.recordsets[0]);
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
      let result = await pool
        ?.request()
        ?.input("userID", sql?.Int, id)
        ?.execute("sp_Get_User_Account_By_ID");

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

router.post("/", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      const pool = await sql?.connect(config);
      const userManagementData = req.body;

      // const encryptPassword = CryptoJS.AES.encrypt(
      //   userManagementData?.password,
      //   "cipherAce"
      // ).toString();

      async function hashPassword(password) {
        const saltRounds = 10;
        return await bcrypt.hash(password, saltRounds);
      }

      // Example usage:
      const hashedPassword = await hashPassword(userManagementData?.password);

      console.log(
        "hashed password while creating user which si stored in db",
        hashedPassword
      );

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("user_id", sql?.Int, null)
        ?.input("email", sql?.NVarChar(255), userManagementData?.email)
        ?.input("first_name", sql?.NVarChar(255), userManagementData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), userManagementData?.lastName)
        ?.input(
          "phone_number",
          sql?.NVarChar(13),
          userManagementData?.phoneNumber
        )
        ?.input("user_role_id", sql?.Int, userManagementData?.userRoleID)
        ?.input("is_active", sql?.Int, userManagementData?.isActive)
        ?.input("is_staff", sql?.Int, userManagementData?.isStaff)
        ?.input("is_superuser", sql?.Int, userManagementData?.isSuperuser)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("password", sql?.NVarChar(128), hashedPassword)
        ?.input(
          "last_login",
          sql?.DateTimeOffset,
          userManagementData?.lastLogin
        )
        ?.output("userId", sql?.Int)
        ?.execute("sp_Ins_Upd_User_Account");

      const userId = result.output.userId;
      if (userId === -1) {
        return res.status(409).json({
          message: "User with the provided email already exists.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the user with User ID = ${userId}`,
        userId: userId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

router.put("/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      const pool = await sql?.connect(config);
      const userManagementData = req.body;
      const user_id = req.params.id;

      const encryptPassword = CryptoJS.AES.encrypt(
        userManagementData?.password,
        "cipherAce"
      ).toString();

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("user_id", sql?.Int, user_id)
        ?.input("email", sql?.NVarChar(255), userManagementData?.email)
        ?.input("first_name", sql?.NVarChar(255), userManagementData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), userManagementData?.lastName)
        ?.input(
          "phone_number",
          sql?.NVarChar(13),
          userManagementData?.phoneNumber
        )
        ?.input("user_role_id", sql?.Int, userManagementData?.userRoleID)
        ?.input("is_active", sql?.Int, userManagementData?.isActive)
        ?.input("is_staff", sql?.Int, userManagementData?.isStaff)
        ?.input("is_superuser", sql?.Int, userManagementData?.isSuperuser)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("password", sql?.NVarChar(128), encryptPassword)
        ?.input(
          "last_login",
          sql?.DateTimeOffset,
          userManagementData?.lastLogin
        )
        ?.output("userId", sql?.Int)
        ?.execute("sp_Ins_Upd_User_Account");

      const userId = result.output.userId;
      if (userId === -1) {
        return res.status(404).json({
          message: "User with the provided user_id does not exist.",
        });
      } else if (userId === -2) {
        return res.status(409).json({
          message:
            "Unable to update email, email already in use by another user",
        });
      }
      return res.status(200).json({
        message: `Successfully updated user with User ID = ${userId}`,
        userId: userId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// Insert user with address
router.post("/user_acc_addr", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      const pool = await sql?.connect(config);
      const userManagementData = req.body;
      // const key = "velankani@123456";

      // const encryptPassword = CryptoJS.AES.encrypt(
      //   userManagementData?.password,
      //   "cipherAce"
      // ).toString();

      async function hashPassword(password) {
        const saltRounds = 10; // This determines the complexity of the hashing algorithm
        return await bcrypt.hash(password, saltRounds);
      }

      // Example usage:
      const hashedPassword = await hashPassword(userManagementData?.password);
      console.log(
        "hashed password while creating user which si stored in db",
        hashedPassword
      );

      // const encryptPassword = encrypt(userManagementData?.password, key);

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("user_id", sql?.Int, null)
        ?.input("email", sql?.NVarChar(255), userManagementData?.email)
        ?.input("first_name", sql?.NVarChar(255), userManagementData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), userManagementData?.lastName)
        ?.input(
          "phone_number",
          sql?.NVarChar(13),
          userManagementData?.phoneNumber
        )
        ?.input("user_role_id", sql?.Int, userManagementData?.userRoleID)
        ?.input("is_active", sql?.Int, userManagementData?.isActive)
        ?.input("is_staff", sql?.Int, userManagementData?.isStaff)
        ?.input("is_superuser", sql?.Int, userManagementData?.isSuperuser)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("password", sql?.NVarChar(128), hashedPassword)
        ?.input(
          "last_login",
          sql?.DateTimeOffset,
          userManagementData?.lastLogin
        )
        ?.output("userId", sql?.Int)
        ?.execute("sp_Ins_Upd_User_Account");

      const userAccountId = result.output.userId;

      if (
        userManagementData?.addressList?.length !== 0 &&
        userAccountId !== -1
      ) {
        for (const address of userManagementData.addressList) {
          let resultAddress = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), "INSERT")
            ?.input("user_address_id", sql?.Int, null)
            ?.input("is_active", sql?.Int, address?.isActive)
            ?.input(
              "street_address_1",
              sql?.NVarChar(200),
              address?.streetAddress1
            )
            ?.input(
              "street_address_2",
              sql?.NVarChar(200),
              address?.streetAddress2
            )
            ?.input("city", sql?.NVarChar(100), address?.city)
            ?.input("state", sql?.NVarChar(100), address?.state)
            ?.input("postal_code", sql?.NVarChar(20), address?.postalCode)
            ?.input("address_type", sql?.NVarChar(255), address?.addressType)
            ?.input("email", sql?.NVarChar(254), address?.email)
            ?.input("phone_number", sql?.NVarChar(13), address?.phoneNumber)
            ?.input("first_name", sql?.NVarChar(255), address?.firstName)
            ?.input("last_name", sql?.NVarChar(255), address?.lastName)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.input("user_id", sql?.Int, userAccountId)
            ?.output("userAddressID", sql?.Int)
            ?.execute("sp_Ins_Upd_User_Address");

          const userAddressID = resultAddress.output.userAddressID;
        }
      }
      if (userAccountId === -1) {
        return res.status(409).json({
          message: "User with the provided email already exists.",
        });
      }
      return res.status(201).json({
        message: "Successfully inserted user details",
        userAccountId: userAccountId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// Update user with address
router.put("/user_acc_addr/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      let decodedToken = decodeToken(token);
      const pool = await sql?.connect(config);
      const userManagementData = req.body;
      const user_id = req.params.id;

      const encryptPassword = CryptoJS.AES.encrypt(
        userManagementData?.password,
        "cipherAce"
      ).toString();

      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("user_id", sql?.Int, user_id)
        ?.input("email", sql?.NVarChar(255), userManagementData?.email)
        ?.input("first_name", sql?.NVarChar(255), userManagementData?.firstName)
        ?.input("last_name", sql?.NVarChar(255), userManagementData?.lastName)
        ?.input(
          "phone_number",
          sql?.NVarChar(13),
          userManagementData?.phoneNumber
        )
        ?.input("user_role_id", sql?.Int, userManagementData?.userRoleID)
        ?.input("is_active", sql?.Int, userManagementData?.isActive)
        ?.input("is_staff", sql?.Int, userManagementData?.isStaff)
        ?.input("is_superuser", sql?.Int, userManagementData?.isSuperuser)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.input("password", sql?.NVarChar(128), encryptPassword)
        ?.input(
          "last_login",
          sql?.DateTimeOffset,
          userManagementData?.lastLogin
        )
        ?.output("userId", sql?.Int)
        ?.execute("sp_Ins_Upd_User_Account");

      const userAccountId = result.output.userId;

      if (userManagementData?.addressList?.length !== 0) {
        for (const address of userManagementData.addressList) {
          addressAction = address?.userAddressID ? "UPDATE" : "INSERT";
          const userAdressId = address?.userAddressID
            ? address?.userAddressID
            : null;
          let resultAddress = await pool
            ?.request()
            ?.input("Action", sql?.NVarChar(255), addressAction)
            ?.input("user_address_id", sql?.Int, userAdressId)
            ?.input("is_active", sql?.Int, address?.isActive)
            ?.input(
              "street_address_1",
              sql?.NVarChar(200),
              address?.streetAddress1
            )
            ?.input(
              "street_address_2",
              sql?.NVarChar(200),
              address?.streetAddress2
            )
            ?.input("city", sql?.NVarChar(100), address?.city)
            ?.input("state", sql?.NVarChar(100), address?.state)
            ?.input("postal_code", sql?.NVarChar(20), address?.postalCode)
            ?.input("address_type", sql?.NVarChar(255), address?.addressType)
            ?.input("email", sql?.NVarChar(254), address?.email)
            ?.input("phone_number", sql?.NVarChar(13), address?.phoneNumber)
            ?.input("first_name", sql?.NVarChar(255), address?.firstName)
            ?.input("last_name", sql?.NVarChar(255), address?.lastName)
            ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
            ?.input("user_id", sql?.Int, userAccountId)
            ?.output("userAddressID", sql?.Int)
            ?.execute("sp_Ins_Upd_User_Address");

          const userAddressID = resultAddress.output.userAddressID;
        }
      }

      if (userAccountId === -1) {
        return res.status(404).json({
          message: "User with the provided user id does not exist.",
        });
      } else if (userAccountId === -2) {
        return res.status(409).json({
          message:
            "Unable to update email, email already in use by another user",
        });
      }
      return res.status(200).json({
        message: "Successfully updated user details",
        userAccountId: userAccountId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// Update user with address
router.put("/user_acc_psw/:id", async (req, res) => {
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const userManagementData = req.body;
      const user_id = req.params.id;
      const encryptPassword = CryptoJS.AES.encrypt(
        userManagementData?.password,
        "cipherAce"
      ).toString();

      let result = await pool
        ?.request()
        ?.input("user_id", sql?.Int, user_id)
        ?.input("password", sql?.NVarChar(128), encryptPassword)
        ?.output("userId", sql?.Int)
        ?.execute("sp_Upd_User_Password");

      const userAccountId = result.output.userId;
      if (userAccountId === -1) {
        return res.status(404).json({
          message: "User with the provided user id does not exist.",
        });
      } else if (userAccountId === -2) {
        return res.status(409).json({
          message:
            "Unable to update email, email already in use by another user",
        });
      }
      return res.status(200).json({
        message: "Successfully updated user details",
        userAccountId: userAccountId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// GET user with address list
router.get("/user_acc_addr/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const pool = await sql?.connect(config);
    let result = await pool
      ?.request()
      ?.input("user_id", sql?.Int, id)
      ?.execute("sp_Get_User_with_Address");
    if (Object.values(Object.values(result.recordsets[0])[0])[0].length === 0) {
      res.status(404).send("Data not found");
    } else {
      const data = JSON.parse(
        Object.values(Object.values(result.recordsets[0])[0])
      );
      res.json(data);
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
        ?.input("userId", sql?.Int, id)
        ?.output("deletedUserId", sql?.Int)
        ?.execute("sp_Del_User_Account");

      const delId = result.output.deletedUserId;
      if (delId === null) {
        return res.status(404).json({
          message: "User not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        userId: delId,
      });
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// GET User order
router.get("/user_order/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      let result = await pool
        ?.request()
        ?.input("user_account_id", sql?.Int, id)
        ?.execute("sp_Get_User_Order_By_ID");

      if (
        Object.values(Object.values(result.recordsets[0])[0])[0].length === 0
      ) {
        res.status(404).send("Data not found");
      } else {
        const data = JSON.parse(
          Object.values(Object.values(result.recordsets[0])[0])
        );
        res.json(data);
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
