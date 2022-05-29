const calculateTax = require("../calculateTax");

module.exports = (restaurant, variant) => {
  let newOrder = {};
  if (!restaurant?.is_vat_included) {
    newOrder = {
      tax: variant.price * variant?.quantity * (restaurant?.vat ?? 0.05),
      sub_total: variant.price * variant?.quantity,
      total:
        (variant.price + variant.price * (restaurant?.vat ?? 0.05)) *
        variant?.quantity,
    };
  } else {
    newOrder = {
      tax:
        calculateTax(variant.price, restaurant?.vat ?? 0.05) *
        variant?.quantity,
      sub_total:
        ((100 * variant.price) / (100 + (restaurant?.vat ?? 0.05))) *
        variant?.quantity,
    };
  }

  return newOrder;
};
