// require("dotenv").config();
const nodemailer = require("nodemailer");
const smtpTransport = require("nodemailer-smtp-transport");
const logger = require("../logger");

const EMAIL_USER = "info@automhr.com";
const EMAIL_PASSWORD = "Hotel@123!";

const sendEmail = async (recipientEmail, subject, body) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtpout.secureserver.net",
      port: 465,
      secure: true,
      auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
      },
    });

    const mailOptions = {
      from: EMAIL_USER,
      to: recipientEmail,
      subject: subject,
      html: body,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.response);

    return info.messageId;
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
};

module.exports = { sendEmail };

// const sendmail = (mailData) => {
//   const transporter = nodemailer.createTransport(
//     smtpTransport({
//       host: "smtpout.secureserver.net",
//       port: 465,
//       secure: true,

//       auth: {
//         user: EMAIL_USER,
//         pass: EMAIL_PASSWORD,
//       },
//     })
//   );

//   const mailOptions = {
//     from: EMAIL_USER,
//     to: mailData.receiverEmailID,
//     subject: mailData.subject,
//     text: mailData.body,
//   };

//   transporter.sendMail(mailOptions, (error, info) => {
//     if (error) {
//       logger.error("ERROR: ", error);
//       console.log("error", error);
//     } else {
//       console.log("Email sent:", info.response);
//       return info.messageId;
//     }
//   });
// };

// module.exports = { sendmail };
