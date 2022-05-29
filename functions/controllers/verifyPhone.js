const google = require("googleapis")
const validateFirebaseIdToken = require("./authMiddleware")
const express = require("express")
const { response } = require("express")
const verifyPhoneRouter = express.Router()

verifyPhoneRouter.use(validateFirebaseIdToken)

const verifyPhone = (db) => {
  // route for phone verification check
  verifyPhoneRouter.get("/is_verified", (req, res) => {
    const { user_id } = req.query

    if (!user_id) {
      res.status(400).send({ message: "No user id" })
      return
    }

    db.collection("users")
      .doc(user_id)
      .get()
      .then((response) => {
        res
          .status(200)
          .send({ phone_verified: response?.data()?.phone_verified })
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } })
      })
  })

  // verify phone route
  verifyPhoneRouter.post("/sendSMS", (req, res) => {
    const { user_id } = req.query
    const { phoneNumber, recaptchaToken } = req.body

    const identityToolkit = google.identitytoolkit({
      auth: "AAAATDFuKJA:APA91bFDB9Ir0gKGDxDoh6UlltM2nwfmHGavym3y9U1llslK3_mfpWhhHGcSci7UBwJDfTipBVFfi3Sh6Vdt7BK5IE4vAff3y_yYmht3br_asOidVBzQgi6mfWc7_hCtivU3PJR3G94s",
      version: "v3",
    })

    identityToolkit.relyingparty
      .sendVerificationCode({
        phoneNumber,
        recaptchaToken: recaptchaToken,
      })
      .then((response) => {
        db.collection("users")
          .doc(user_id)
          .update({
            session_info: response.data.sessionInfo,
            phone_number: phoneNumber,
          })
          .then(() => {
            res
              .status(200)
              .send({ success: "Verification code send to your number" })
          })
          .catch((error) => {
            res.status(500).send({ error: { message: error.message } })
          })
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } })
      })
  })

  verifyPhoneRouter.post("/verifyCode", (req, res) => {
    const { user_id } = req.query
    const { code } = req.body

    const identityToolkit = google.identitytoolkit({
      auth: "AAAATDFuKJA:APA91bFDB9Ir0gKGDxDoh6UlltM2nwfmHGavym3y9U1llslK3_mfpWhhHGcSci7UBwJDfTipBVFfi3Sh6Vdt7BK5IE4vAff3y_yYmht3br_asOidVBzQgi6mfWc7_hCtivU3PJR3G94s",
      version: "v3",
    })
    db.collection("users")
      .doc(user_id)
      .get()
      .then((response) => {
        const sessionInfo = response.data()?.session_info

        if (!sessionInfo) {
          res.status(400).send({ message: "Enter mobile number first" })
          return
        }

        identityToolkit.relyingparty
          .verifyPhoneNumber({
            code: code,
            sessionInfo: sessionInfo,
          })
          .then(() => {
            db.collection("users")
              .doc(user_id)
              .update({ phone_verified: true })
              .then(() => {
                res.status(200).send({ success: "Phone number verified" })
              })
              .catch((error) => {
                res.status(500).send({ error: { message: error.message } })
              })
          })
          .catch((error) => {
            res.status(500).send({ error: { message: error.message } })
          })
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } })
      })
  })

  return verifyPhoneRouter
}

module.exports = verifyPhone
