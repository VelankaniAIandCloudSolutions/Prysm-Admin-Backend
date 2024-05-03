const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const fileUpload = require("express-fileupload");
const { listenEmailServer } = require("./mail_watcher/watchMail");
const { Worker } = require("node:worker_threads");
const Imap = require("imap");

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "500mb" }));
// if (process.env.NODE_ENV === "development") {
app.use(cors());
// }

app.use(fileUpload());

// Listen to Email Server
// setInterval(listenEmailServer, process.env.LIESTEN_TO_EMAIL_DELAY);

// Login
const loginRoute = require("./routes/login");
app.use("/api/v1/login", loginRoute);

// Product Category
const productCategoryRoute = require("./routes/productCategory");
app.use("/api/v1/product_category", productCategoryRoute);
app.use("/api/v1/product_category/:id", productCategoryRoute);

// Product
const productRoute = require("./routes/product");
app.use("/api/v1/product", productRoute);
app.use("/api/v1/product/:id", productRoute);

// Product Tag
const productTagRoute = require("./routes/productTag");
app.use("/api/v1/product_tag", productTagRoute);
app.use("/api/v1/product_tag/:id", productTagRoute);

// Product Customization Category
const productCustCat = require("./routes/productCustomizationCategory");
app.use("/api/v1/product_cust_cat", productCustCat);
app.use("/api/v1/product_cust_cat/:id", productCustCat);

// Product Customization Option
const productCustOpt = require("./routes/productCustomizationOption");
app.use("/api/v1/product_cust_opt", productCustOpt);
app.use("/api/v1/product_cust_opt/:id", productCustOpt);

// User Management
const userManagementRoute = require("./routes/userManagement");
app.use("/api/v1/user_account", userManagementRoute);
app.use("/api/v1/user_account/:id", userManagementRoute);

// Role
const roleRoute = require("./routes/role");
app.use("/api/v1/role", roleRoute);

// Language
const languageRoute = require("./routes/language");
app.use("/api/v1/lang", languageRoute);
app.use("/api/v1/lang/:id", languageRoute);

// Os
const osRoute = require("./routes/os");
app.use("/api/v1/os", osRoute);
app.use("/api/v1/os/:id", osRoute);

// Driver Group
const driverGroupRoute = require("./routes/driverGroup");
app.use("/api/v1/driver_group", driverGroupRoute);
app.use("/api/v1/driver_group/:id", driverGroupRoute);

// Driver
const driverRoute = require("./routes/driver");
app.use("/api/v1/driver", driverRoute);
app.use("/api/v1/driver/:id", driverRoute);

// Driver Version
const driverVersionRoute = require("./routes/driverVersion");
app.use("/api/v1/driverVersion", driverVersionRoute);
app.use("/api/v1/driverVersion/:id", driverVersionRoute);

// Footer Configuration
const footerConfigurationRoute = require("./routes/footerConfiguration");
app.use("/api/v1/footerConfiguration", footerConfigurationRoute);

// Howto
const howtoRoute = require("./routes/howto");
app.use("/api/v1/howto", howtoRoute);

// Manuals
const manuals = require("./routes/manuals");
app.use("/api/v1/manuals", manuals);

// User Address
const userAddressRoute = require("./routes/userAddress");
app.use("/api/v1/user_address", userAddressRoute);
app.use("/api/v1/user_address/:id", userAddressRoute);
//USERS

// PRODUCT PAGE
const productPage = require("./routes/User/productPage");
app.use("/api/v1/user/product", productPage);
app.use("/api/v1/user/product/:id", productPage);

// Tax
const taxRoute = require("./routes/tax");
app.use("/api/v1/tax", taxRoute);
app.use("/api/v1/tax/:id", taxRoute);

// Region
const regionRoute = require("./routes/region");
app.use("/api/v1/region", regionRoute);
app.use("/api/v1/region/:id", regionRoute);

// Country Currency Details
const countryRoute = require("./routes/country");
app.use("/api/v1/country", countryRoute);
app.use("/api/v1/country/:id", countryRoute);

// Discount Code
const discountCodeRoute = require("./routes/discountCode");
app.use("/api/v1/discount_code", discountCodeRoute);
app.use("/api/v1/discount_code/:id", discountCodeRoute);

// Download Files
const downloadFilesRoute = require("./routes/downloadFiles");
app.use("/api/v1/download", downloadFilesRoute);

// Ticket
const ticketRoute = require("./routes/ticket");
app.use("/api/v1/ticket", ticketRoute);

// Ticket File Upload
const ticketFileUpload = require("./routes/ticketFileUpload");
app.use("/api/v1/ticket_file_upd", ticketFileUpload);

// Problem
const problemRoute = require("./routes/problem");
app.use("/api/v1/problem", problemRoute);
app.use("/api/v1/problem/:id", problemRoute);

// File Attachment
const fileAttachmentRoute = require("./routes/fileAttachments");
app.use("/api/v1/fileAttachment", fileAttachmentRoute);
app.use("/api/v1/fileAttachment/:id", fileAttachmentRoute);

// Mail Conversation
const mailConversationsRoute = require("./routes/mailConversations");
app.use("/api/v1/mailConversations", mailConversationsRoute);
app.use("/api/v1/mailConversations/:id", mailConversationsRoute);

// Product Document
const productDocumentRoute = require("./routes/productDocument");
app.use("/api/v1/product_document", productDocumentRoute);
app.use("/api/v1/product_document/:id", productDocumentRoute);

// Product Document Category
const productDocumentCategoryRoute = require("./routes/productDocumentCategory");
app.use("/api/v1/product_document_category", productDocumentCategoryRoute);
app.use("/api/v1/product_document_category/:id", productDocumentCategoryRoute);

// Response Ticket History
const ticketResponseHistoryRoute = require("./routes/ticketResponseHistory");
app.use("/api/v1/ticket_response", ticketResponseHistoryRoute);
app.use("/api/v1/ticket_response/:id", ticketResponseHistoryRoute);

// Translation files
const contentRoute = require("./routes/translationFiles");
app.use("/api/v1/content", contentRoute);
app.use("/api/v1/content/:lng/:ns", contentRoute);

// Ticket Status
const ticketStatusRoute = require("./routes/ticketStatus");
app.use("/api/v1/ticket_status", ticketStatusRoute);
app.use("/api/v1/ticket_status/:id", ticketStatusRoute);

// Homepage Images
const homepageImageRoute = require("./routes/homepageImage");
app.use("/api/v1/homepg_img", homepageImageRoute);
app.use("/api/v1/homepg_img/:id", homepageImageRoute);

// Orders
const orderRoute = require("./routes/order");
app.use("/api/v1/orders", orderRoute);
// app.use("/api/v1/homepg_img/:id", homepageImageRoute);

app.listen(PORT, () => {
  console.log(`listening on port = ${PORT}`);
});
