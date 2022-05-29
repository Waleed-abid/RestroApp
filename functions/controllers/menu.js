const express = require("express")
const menuRouter = express.Router()

const menuController = (db) => {
  menuRouter.get("/", (req, res) => {
    const restaurant_id = req.query.restaurant_id
    const category_id = req.query.category_id || null
    const type = req.query.type || "food"
    let categories = []
    const categoriesRef = db.collection(
      `restaurants/${restaurant_id}/categories`
    )

    categoriesRef
      .where("type", "==", type)
      .orderBy("position", "asc")
      .get()
      .then((responses) => {
        categories = responses?.docs?.map((doc) => {
          return { id: doc.id, ...doc.data() }
        })
        return Promise.resolve(categories)
      })
      .then((responses) => {
        const variantsRef = db.collection(
          `restaurants/${restaurant_id}/variants`
        )
        variantsRef
          .where("category_id", "==", category_id || responses[0].id)
          .where("type", "==", type)
          .get()
          .then((response) => {
            Promise.all(
              response?.docs?.map((variant) => {
                const pairRef = db.collection(
                  `restaurants/${restaurant_id}/variants/${variant.id}/pairings`
                )
                return pairRef
                  .get()
                  .then((recommendationResponse) => {
                    let refs = recommendationResponse?.docs?.map(
                      (recommendation) => recommendation?.data()?.item
                    )
                    return Promise.resolve(refs)
                  })
                  .then((variantsRefs) => {
                    return Promise.all(
                      variantsRefs?.map((variantRef) => {
                        return variantRef.get().then((response) => {
                          return Promise.resolve({
                            id: response?.id,
                            ...response?.data(),
                          })
                        })
                      })
                    ).then((response) => {
                      return Promise.resolve({
                        id: variant?.id,
                        ...variant?.data(),
                        pairings: response,
                      })
                    })
                  })
              })
            ).then((response) => {
              res.status(200).send({
                data: {
                  variants: response,
                  categories: categories,
                },
              })
            })
          })
      })
      .catch((error) => {
        res.status(500).send({ error: error.message })
      })
  })

  return menuRouter
}

module.exports = menuController
