const express = require("express")
const dealsRouter = express.Router()

const dealsController = (db) => {
  // Route for placing order

  dealsRouter.get("/:id", (req, res) => {
    const dealsdb = db.collection(`restaurants/${req.params.id}/deals`)

    dealsdb
      .where("expire_at", ">=", new Date())
      .get()
      .then((response) => {
        const variant_id = response.docs[0]?.data()?.variant_id
        if (!variant_id) {
          res.status(200).send({ data: {} })
        }
        db.collection(`restaurants/${req.params.id}/variants`)
          .doc(variant_id)
          .get()
          .then((variant) => {
            res.status(200).send({
              data: {
                id: response.docs[0].id,
                ...response.docs[0].data(),
                variant: {
                  id: variant.id,
                  ...variant.data(),
                },
              },
            })
          })
      })
      .catch((error) => {
        console.log(error)
        res.status(500).send({ error: { message: "Internal server error" } })
      })
  })

  return dealsRouter
}

module.exports = dealsController
