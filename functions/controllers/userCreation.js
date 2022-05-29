const functions = require("firebase-functions")
const secret_key =
  "sk_test_51KJF1zGj04uFIrLMJJ8mpZxGS2pcYQXzP0WO8ux0cb2mR2qlUdLBEEDm6vPEJF9ub6LiOTKRmE1wAgKpvAgxEqFU00H2hU5CUx"
const stripe = require("stripe")(secret_key)

const userController = (db) => {
  return functions.auth.user().onCreate((user) => {
    const {
      uid,
      email,
      photoUrl,
      phoneNumber,
      displayName,
      emailVerified,
      disabled,
    } = user

    return stripe.customers
      .create({
        name: displayName,
        email: email,
      })
      .then((customer) => {
        return db
          .collection("users")
          .doc(uid)
          .set(
            {
              name: displayName,
              email: email || "",
              customer_id: customer.id,
              phone_number: phoneNumber || "",
              image: photoUrl || "",
              email_verified: emailVerified || false,
              phone_verified: false,
              disabled: disabled,
            },
            { merge: true }
          )
          .then((response) => {
            console.log(response)
            return Promise.resolve({
              data: {
                message: "User Successfully created ",
              },
            })
          })
          .catch((error) => {
            console.log(error)
            return Promise.reject({
              error: { message: error.message },
            })
          })
      })
      .catch((error) => {
        console.log(error)
        return Promise.reject({
          error: { message: error.message },
        })
      })
  })
}

module.exports = userController
