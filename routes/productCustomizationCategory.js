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
      const result = await pool
        ?.request()
        ?.execute("sp_Get_Product_Customization_Category");
      res.status(200).json(result.recordsets[0]);
    }
  } catch (err) {
    logger.error(err);
    if (!res.headersSent) {
      handleServerError(res, err);
    }
  }
});

// GET BY id
// router.get("/:id", async (req, res) => {
//   const { id } = req.params;
//   try {
//     const authHeader = req?.headers?.authorization;
//     const token = authHeader?.split(" ")[1];
//     if (verifyToken(res, token)) {
//       const pool = await sql?.connect(config);
//       const result = await pool
//         ?.request()
//         ?.input("customization_category_id", sql?.Int, id)
//         ?.execute("sp_Get_Product_Customization_Category_By_ID");

//       if (result.recordset.length === 0) {
//         res.status(404).send("Data not found");
//       } else {
//         res.json(result.recordsets[0]);
//       }
//     }
//   } catch (err) {
//     logger.error(err);
//     if (!res.headersSent) {
//     handleServerError(res, err);
//     }
//   }
// });

router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const authHeader = req?.headers?.authorization;
    const token = authHeader?.split(" ")[1];
    if (verifyToken(res, token)) {
      const pool = await sql?.connect(config);
      const result = await pool
        ?.request()
        ?.input("custCatID", sql?.Int, id)
        ?.execute("sp_Get_PrdCustCat_With_CustOpt");

      if (result.recordsets[0].length === 0) {
        res.status(404).send("Data not found");
      } else {
        const readyResult = JSON.parse(
          Object.values(Object.values(result.recordsets[0])[0])
        );
        res.json(readyResult);
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
      let categoryData = req.body;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "INSERT")
        ?.input("customization_category_id", sql?.Int, null)
        ?.input("is_active", sql?.Int, categoryData?.isActive)
        ?.input("name", sql?.NVarChar(255), categoryData?.name)
        ?.input("is_multiselect", sql?.Int, categoryData?.isMultiselect)
        ?.input(
          "parent_customization_category_id",
          sql?.Int,
          categoryData?.parentCustomizationCategoryID
        )
        ?.input("max_quantity", sql?.Int, categoryData?.maxQty)
        ?.input("min_quantity", sql?.Int, categoryData?.minQty)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("customizationCategoryID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Customization_Category");
      const categoryID = result.output.customizationCategoryID;
      if (categoryID === null || categoryID === "") {
        return res.status(409).json({
          message:
            "Resource already exists. Operation failed due to a conflict.",
        });
      }
      return res.status(201).json({
        message: `Successfully inserted the data with Customization Category ID = ${categoryID}`,
        categoryID: categoryID,
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
      let categoryData = req.body;
      let categoryId = req.params.id;
      let result = await pool
        ?.request()
        ?.input("Action", sql?.NVarChar(255), "UPDATE")
        ?.input("customization_category_id", sql?.Int, categoryId)
        ?.input("is_active", sql?.Int, categoryData?.isActive)
        ?.input("name", sql?.NVarChar(255), categoryData?.name)
        ?.input("is_multiselect", sql?.Int, categoryData?.isMultiselect)
        ?.input(
          "parent_customization_category_id",
          sql?.Int,
          categoryData?.parentCustomizationCategoryID
        )
        ?.input("max_quantity", sql?.Int, categoryData?.maxQty)
        ?.input("min_quantity", sql?.Int, categoryData?.minQty)
        ?.input("updated_by_id", sql?.Int, decodedToken?.userId)
        ?.output("customizationCategoryID", sql?.Int)
        ?.execute("sp_Ins_Upd_Product_Customization_Category");
      const categoryID = result.output.customizationCategoryID;
      if (categoryID === null) {
        return res.status(404).json({
          message: "Customization Category not found",
        });
      } else if (categoryID === -1) {
        return res.status(409).json({
          message: `Customization Category name ${categoryData?.name} has already been created.`,
        });
      }
      return res.status(200).json({
        message: `Successfully updated the data with Customization Category ID = ${categoryID}`,
        categoryID: categoryID,
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
      let decodedToken = decodeToken(token);
      let pool = await sql?.connect(config);
      let id = req.params.id;
      let result = await pool
        ?.request()
        ?.input("customizationCategoryId", sql?.Int, id)
        ?.output("deletedCustomizationCategoryId", sql?.Int)
        ?.execute("sp_Del_Product_Customization_Category");

      const delId = result.output.deletedCustomizationCategoryId;
      if (delId === null) {
        return res.status(404).json({
          message: "Product Customization Category not found",
        });
      }

      return res.status(200).json({
        message: `Successfully deleted the data with ID = ${delId}`,
        customizationCategoryId: delId,
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
