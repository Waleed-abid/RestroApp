const express = require("express")
const searchRouter = express.Router()

const categorySearchController = (db) => {
  // route for category search
  searchRouter.get("/:id/category", (req, res) => {
    const categories = db.collection(`restaurants/${req.params.id}/categories`)

    categories
      .orderBy("position", "asc")
      .get()
      .then((responses) => {
        let result = responses.docs.map((doc) => {
          return { id: doc.id, ...doc.data() }
        })
        return Promise.resolve(result)
      })
      .then((responses) => {
        db.collection(`restaurants/${req.params.id}/variants`)
          .where("category_id", "==", responses[0].id)
          .get()
          .then((response) => {
            let variants = response.docs.map((variant) => {
              return {
                id: variant.id,
                ...variant.data(),
              }
            })

            res.status(200).send({
              data: {
                categories: responses,
                variants: variants,
              },
            })
          })
      })
      .catch((error) => {
        console.log(error.message)
        res.status(500).send({ error: "Internal server error" })
      })
  })

  // Route for variants for specific category
  searchRouter.get("/:restaurant_id/category/:id", (req, res) => {
    const variants = db.collection(
      `restaurants/${req.params.restaurant_id}/variants`
    )
    variants
      .where("category_id", "==", req.params.id)
      .get()
      .then((responses) => {
        let result = responses.docs.map((varaint) => {
          return {
            id: varaint.id,
            ...varaint.data(),
          }
        })
        res.status(200).send({ data: result })
      })
      .catch((error) => {
        console.log(error.message)
        res.status(500).send({ error: "Internal server error" })
      })
  })

  // route for search
  searchRouter.get("/:restaurant_id/:search_text", (req, res) => {
    const searchText = req.params.search_text
    const variants = db.collection(
      `restaurants/${req.params.restaurant_id}/variants`
    )

    variants
      .where("name", ">=", searchText.toLowerCase())
      .get()
      .then((responses) => {
        let result = responses.docs.map((varaint) => {
          return {
            id: varaint.id,
            ...varaint.data(),
          }
        })
        res.status(200).send({ data: result })
      })
      .catch((error) => {
        console.log(error.message)
        res.status(500).send({ error: "Internal server error" })
      })
  })

  return searchRouter
}

module.exports = categorySearchController
