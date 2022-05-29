const admin = require("firebase-admin");
const { Variant } = require("../../models");
const functions = require("firebase-functions");
const FieldPath = admin.firestore.FieldPath;

module.exports = async (pairings) => {
  try {
    if (pairings?.length == 0) {
      return Promise.resolve([]);
    }
    let recommended = [];
    let options = {};
    pairings?.forEach((pairing) => {
      if (pairing?.recommended) {
        recommended.push(pairing?.recommended?.id);
      }
      options = pairing.options?.reduce((accu, curr) => {
        if (!accu[`${curr?.id}`]) {
          accu[`${curr?.id}`] = true;
        }
        return accu;
      }, options);
    });

    let variants = await Variant.where(
      FieldPath.documentId(),
      "in",
      Object.keys(options)
    ).get();

    variants = variants?.docs?.map((variant) => {
      return {
        id: variant.id,
        image: variant.data()?.image,
        restaurant_id: variant.data()?.restaurant_id,
        description: variant.data()?.description,
        type: variant.data()?.type,
        category_id: variant.data()?.category_id,
        price: variant.data()?.price,
        name: variant.data()?.name,
        is_recommended: recommended.includes(variant?.id),
      };
    });

    return Promise.resolve(variants);
  } catch (error) {
    functions.logger.log(error);
    return Promise.resolve([]);
  }
};
