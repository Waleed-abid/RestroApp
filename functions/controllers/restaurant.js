const express = require("express");
const restaurantRouter = express.Router();

const restaurantController = (db) => {
  // route for restaurant data inseting
  restaurantRouter.post("/", (req, res) => {
    let { restaurant } = req.body;
    const name = restaurant?.name?.toLowerCase();
    restaurant = {
      ...restaurant,
      name: name,
    };
    db.collection("restaurants")
      .add(restaurant)
      .then((response) => {
        console.log(response.id);
        res.status(200).send({ data: { message: "Successfully" } });
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } });
      });
  });
  // route for category insertion
  restaurantRouter.post("/:id/category", (req, res) => {
    let { category } = req.body;
    const name = category?.name?.toLowerCase();
    category = {
      ...category,
      name: name,
    };
    const id = req.params.id;
    db.collection("restaurants")
      .doc(id)
      .collection("categories")
      .add(category)
      .then((response) => {
        console.log(response.id);
        res.status(200).send({ data: { message: "Successfully" } });
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } });
      });
  });
  // route for variant insertion
  restaurantRouter.post("/:id/variant", (req, res) => {
    let { variant } = req.body;
    const name = variant?.name?.toLowerCase();
    variant = {
      ...variant,
      name: name,
    };

    const id = req.params.id;
    db.collection("restaurants")
      .doc(id)
      .collection("variants")
      .add(variant)
      .then((response) => {
        console.log(response.id);
        res.status(200).send({ data: { message: "Successfully" } });
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } });
      });
  });
  // route for categroy pairings
  restaurantRouter.post("/:id/category/:category_id/pairings", (req, res) => {
    const { variant_id, title } = req.body;
    const id = req.params.id;
    const category_id = req.params.category_id;
    db.collection("restaurants")
      .doc(id)
      .collection("categories")
      .doc(category_id)
      .collection("pairings")
      .add({
        name: title,
        item: db.doc(`restaurants/${id}/variants/${variant_id}`),
      })
      .then((response) => {
        console.log(response.id);
        res.status(200).send({ data: { message: "Successfully" } });
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } });
      });
  });

  // route for variants pairings
  restaurantRouter.post("/:restaurant_id/variant/:id/pairings", (req, res) => {
    const { variant_id, title } = req.body;
    const id = req.params.id;
    const restaurant_id = req.params.restaurant_id;
    db.collection("restaurants")
      .doc(restaurant_id)
      .collection("variants")
      .doc(id)
      .collection("pairings")
      .add({
        item: db.doc(`restaurants/${restaurant_id}/variants/${variant_id}`),
        title: title || "",
      })
      .then((response) => {
        console.log(response.id);
        res.status(200).send({ data: { message: "Successfully" } });
      })
      .catch((error) => {
        res.status(500).send({ error: { message: error.message } });
      });
  });
  // route for restaurant menu
  restaurantRouter.get("/:id", (req, res) => {
    const restaurant = db.collection("restaurants").doc(req.params.id);
    restaurant
      .get()
      .then((response) => {
        return Promise.resolve({
          id: response.id,
          ...response.data(),
        });
      })
      .then((response) => {
        res.status(200).send({ data: response });
      })
      .catch((error) => res.status(500).send({ error: error.message }));
  });

  // route for specific variant
  restaurantRouter.get("/:restaurant_id/variants/:id", (req, res) => {
    const variant = db
      .collection(`restaurants/${req.params.restaurant_id}/variants`)
      .doc(req.params.id)
      .get()
      .then((response) => {
        db.collection(`restaurants/${req.params.restaurant_id}/variants`)
          .doc(req.params.id)
          .collection("pairings")
          .get()
          .then((recommendationResponse) => {
            let refs = recommendationResponse.docs.map(
              (recommendation) => recommendation.data().item
            );
            return Promise.resolve(refs);
          })
          .then((variantsRefs) => {
            Promise.all(
              variantsRefs.map((variantRef) => {
                return variantRef.get().then((response) => {
                  return Promise.resolve({
                    id: response.id,
                    ...response.data(),
                  });
                });
              })
            )
              .then((pairings) => {
                res.status(200).send({
                  id: response.id,
                  ...response.data(),
                  pairings: pairings,
                });
              })
              .catch((error) => Promise.reject(error));
          });
      })
      .catch((error) => {
        console.log(error);
        res.status(500).send({ error: { message: "Internal Server Error" } });
      });
  });

  // Route for food Menu
  restaurantRouter.get("/:id/:type", (req, res) => {
    let categories = [];

    const categoriesRef = db.collection(
      `restaurants/${req.params.id}/categories`
    );

    categoriesRef
      .where("type", "==", req.params.type)
      .orderBy("position", "asc")
      .get()
      .then((responses) => {
        categories = responses.docs.map((doc) => {
          return { id: doc.id, ...doc.data() };
        });
        return Promise.resolve(categories);
      })
      .then((responses) => {
        const variantsRef = db.collection(
          `restaurants/${req.params.id}/variants`
        );
        variantsRef
          .where("category_id", "==", responses[0].id)
          .where("type", "==", req.params.type)
          .get()
          .then((response) => {
            Promise.all(
              response.docs.map((variant) => {
                const pairRef = db.collection(
                  `restaurants/${req.params.id}/variants/${variant.id}/pairings`
                );
                return pairRef
                  .get()
                  .then((recommendationResponse) => {
                    let refs = recommendationResponse.docs.map(
                      (recommendation) => recommendation.data().item
                    );
                    return Promise.resolve(refs);
                  })
                  .then((variantsRefs) => {
                    return Promise.all(
                      variantsRefs.map((variantRef) => {
                        return variantRef.get().then((response) => {
                          return Promise.resolve({
                            id: response.id,
                            ...response.data(),
                          });
                        });
                      })
                    ).then((response) => {
                      return Promise.resolve({
                        id: variant.id,
                        ...variant.data(),
                        pairings: response,
                      });
                    });
                  });
              })
            ).then((response) => {
              res.status(200).send({
                data: {
                  variants: response,
                  categories: categories,
                },
              });
            });
          });
      })
      .catch((error) => {
        res.status(500).send({ error: error.message });
      });
  });

  // Route for foodmenu variants for specific category
  restaurantRouter.get("/:restaurant_id/:type/:id", (req, res) => {
    db.collection(`restaurants/${req.params.restaurant_id}/variants`)
      .where("category_id", "==", req.params.id)
      .where("type", "==", req.params.type)
      .get()
      .then((response) => {
        Promise.all(
          response.docs.map((variant) => {
            const pairRef = db.collection(
              `restaurants/${req.params.restaurant_id}/variants/${variant.id}/pairings`
            );
            return pairRef
              .get()
              .then((recommendationResponse) => {
                let refs = recommendationResponse.docs.map(
                  (recommendation) => recommendation.data().item
                );

                return Promise.resolve(refs);
              })
              .then((variantsRefs) => {
                return Promise.all(
                  variantsRefs.map((variantRef) => {
                    return variantRef.get().then((response) => {
                      return Promise.resolve({
                        id: response.id,
                        ...response.data(),
                      });
                    });
                  })
                ).then((response) => {
                  return Promise.resolve({
                    id: variant.id,
                    ...variant.data(),
                    pairings: response,
                  });
                });
              });
          })
        ).then((response) => {
          res.status(200).send({
            data: {
              variants: response,
            },
          });
        });
      });
  });

  return restaurantRouter;
};

module.exports = restaurantController;
