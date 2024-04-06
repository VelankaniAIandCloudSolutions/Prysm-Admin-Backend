const Imap = require("imap");
const { simpleParser } = require("mailparser");
const { exitOnError } = require("winston");
require("dotenv").config();
const sql = require("mssql");
const config = require("../dbConfig");
const logger = require("../logger");

const listenEmailServer = () => {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

  const imapConfig = {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    host: "mail.cipheracetech.com",
    port: 993,
    tls: true,
  };

  const insertToTicketResHistory = async (
    from,
    to,
    subject,
    html,
    uuid,
    cc
  ) => {
    try {
      let pool = await sql?.connect(config);

      const ticketID = await pool
        ?.request()
        ?.input("UUID", sql?.NVarChar(255), uuid)
        ?.execute("sp_Get_Ticket_By_UUID");

      if (ticketID?.recordset?.length > 0) {
        try {
          const ticketData = await pool
            ?.request()
            ?.input("eticket_id", sql?.Int, ticketID.recordset[0].eTicket_ID)
            ?.execute("sp_Get_Ticket_By_ID");

          const additionalEmailList =
            ticketData?.recordsets[0][0]?.additionalEmail;
          let additionalEmailListJSON = JSON.parse(
            additionalEmailList ? additionalEmailList : "{}"
          );
          if (!additionalEmailListJSON?.hasOwnProperty("to")) {
            additionalEmailListJSON.to = [];
          }
          if (!additionalEmailListJSON?.hasOwnProperty("cc")) {
            additionalEmailListJSON.cc = [];
          }
          if (to?.value) {
            to?.value.forEach((mail) => {
              if (!additionalEmailListJSON?.to?.includes(mail?.address))
                additionalEmailListJSON?.to?.push(mail?.address);
            });
          }
          if (cc?.value) {
            cc?.value.forEach((mail) => {
              if (!additionalEmailListJSON?.cc?.includes(mail?.address))
                additionalEmailListJSON?.cc?.push(mail?.address);
            });
          }
          const additionalEmail2Ins = JSON.stringify(additionalEmailListJSON);
          let resultUpdTicket = await pool
            ?.request()
            ?.input("Action", sql.NVarChar(255), "UPDATE")
            ?.input("eticket_id", sql?.Int, ticketID.recordset[0].eTicket_ID)
            ?.input(
              "additional_email",
              sql?.NVarChar(sql?.MAX),
              additionalEmail2Ins
            )
            ?.output("eticketIDOutput", sql?.Int)
            ?.execute("sp_Ins_Upd_Ticket");
        } catch (err) {
          logger.error(err);
        }
        let result = await pool
          ?.request()
          ?.input("Action", sql.NVarChar(255), "INSERT")
          ?.input("sender_email_id", sql.NVarChar(255), from?.value[0]?.address)
          ?.input(
            "receiver_email_id",
            sql.NVarChar(255),
            process.env.EMAIL_USER
          ) // to?.value[0]?.address
          ?.input("subject", sql.NVarChar(sql.MAX), subject)
          ?.input("body", sql.NVarChar(sql.MAX), html)
          ?.input("eTicket_id", sql.Int, ticketID.recordset[0].eTicket_ID)
          ?.input("response_received_from", sql.Int, 0) // external
          ?.output("ticket_response_id_out", sql.Int)
          ?.execute("sp_Ins_Ticket_Res_History");

        const ticketResponseId = result.output.ticket_response_id_out;
        if (ticketResponseId !== null) {
          console.log("Mail received and successfully inserted");
        }
      }
    } catch (err) {
      logger.error(err);
      console.log(err);
    }
  };

  const getEmails = () => {
    try {
      const imap = new Imap(imapConfig);
      imap.once("ready", () => {
        imap.openBox("INBOX", false, () => {
          imap.search(["NEW", ["SINCE", new Date()]], (err, results) => {
            if (results.length > 0) {
              const f = imap.fetch(results, { bodies: "" });
              f.on("message", (msg) => {
                msg.on("body", (stream) => {
                  simpleParser(stream, async (err, parsed) => {
                    const { from, to, subject, html, textAsHtml, text, cc } =
                      parsed;
                    if (err) {
                      console.log("Error: ", err);
                    } else {
                      console.log(parsed);
                      const regex = /<UUID>(.*?)<\/UUID>/;
                      const match = subject.match(regex);
                      let sub = subject.replace(match[0], "");
                      if (match) {
                        const uuid = match[1];
                        let count = 0;
                        if (uuid !== null) {
                          console.log(count + 1);
                          await insertToTicketResHistory(
                            from,
                            to,
                            sub,
                            html,
                            uuid,
                            cc
                          );
                        }
                      }
                    }
                  });
                });

                msg.once("attributes", (attrs) => {
                  const { uid } = attrs;
                  imap.addFlags(uid, ["\\Seen"], () => {
                    // Mark the email as read after reading it
                    console.log("Marked as read!");
                  });
                });
              });
              f.once("error", (ex) => {
                return Promise.reject(ex);
              });
              f.once("end", () => {
                console.log("Done fetching all messages!");
                imap.end();
              });

              imap.end();
            } else {
              console.log("No New Emails");
              imap.end();
            }
          });
        });
      });

      imap.once("error", (err) => {
        console.log("IMAP ERR: ", err);
      });

      imap.once("end", () => {
        console.log("Connection ended");
      });

      imap.connect();
    } catch (ex) {
      console.log("error occurred");
    }
  };

  getEmails();
};

module.exports = { listenEmailServer };
