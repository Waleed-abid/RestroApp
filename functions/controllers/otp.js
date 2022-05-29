const functions = require("firebase-functions");
const accountSid = functions.config().secret.twilio_account_sid;
const authToken = functions.config().secret.twilio_auth_token;
const service_id = functions.config().secret.twilio_service_id;
const client = require("twilio")(accountSid, authToken);
const express = require("express");
const validateFirebaseIdToken = require("./authMiddleware");
const otpRouter = express();

otpRouter.use(validateFirebaseIdToken);

const otpController = (db) => {
  otpRouter.post("/sendOTP", (req, res) => {
    const { phone } = req.body;
    client.verify
      .services(service_id)
      .verifications.create({
        to: phone,
        channel: "sms",
        locale: "en",
      })
      .then(() => {
        res.status(200).send({
          message: "OTP has been sent to your Phone Number",
        });
      })
      .catch((error) => {
        res.status(500).send({
          error: {
            message: error.message,
          },
        });
      });
  });

  otpRouter.post("/verifyOTP", (req, res) => {
    const { OTP, phone, uid } = req.body;

    if (OTP.toString().length == 4) {
      client.verify
        .services(service_id)
        .verificationChecks.create({
          to: phone,
          code: OTP,
        })
        .then((verification) => {
          if (verification.status === "approved") {
            const ref = db.collection("users").doc(`${uid}`);
            ref
              .update({
                phone_verified: true,
                phone_number: phone,
              })
              .then(() => {
                res.status(200).send({
                  message: "Phone has been verified",
                });
              })
              .catch((err) => {
                res.status(500).send({
                  error: {
                    message: err.message,
                  },
                });
              });
          } else {
            res.status(500).send({
              error: {
                message: "Your Phone has not been verified. Wrong OTP",
              },
            });
          }
        })
        .catch((err) => {
          res.status(500).send({
            error: {
              message:
                "Phone Numbers Donot Match. Please Try entering OTP again with valid phone number",
              Error: err.message,
            },
          });
        });
    } else {
      res.status(400).send({
        error: {
          message:
            "Your OTP is less than or Greater than 4 digits, Please Try Again with valid OTP.",
        },
      });
    }
  });
  return otpRouter;
};
module.exports = otpController;
