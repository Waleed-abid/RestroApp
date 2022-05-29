const is_valid = (curr) => {
  if (!curr?.discount) {
    return false;
  }
  let date = new Date();
  let hours = date.getHours();
  if (!(new Date(curr.discount?.valid_from) <= date)) {
    return false;
  }
  if (!(new Date(curr.discount?.valid_untill) >= date)) {
    return false;
  }
  if (!(curr.discount?.valid_start_time && curr.discount?.valid_end_time)) {
    return false;
  }

  if (
    hours >= curr.discount.valid_start_time &&
    hours < curr.discount.valid_end_time
  ) {
    return true;
  }

  return false;
};

const order = (prev, curr) => {
  if (curr.offer_category_id == 1) {
    prev["total"] += curr?.price * curr?.quantity;

    prev.line_items.push({ ...curr, quantity: curr?.quantity * 2 });

    return prev;
  }

  if (curr.offer_category_id == 3) {
    prev["total"] += curr?.price * curr?.quantity;

    prev.line_items.push(curr);

    return prev;
  }

  if (curr.offer_category_id == 2) {
    prev["total"] +=
      curr?.discount?.temp_price != 0
        ? curr?.discount?.temp_price * curr?.quantity
        : (curr?.price - curr?.price * curr?.discount?.discount) *
          curr?.quantity;

    prev.line_items.push(curr);

    return prev;
  }
  prev["total"] += curr?.price * curr?.quantity;

  prev.line_items.push(curr);

  return prev;
};

module.exports = (line_items) => {
  return line_items?.reduce(
    (prev, curr) => {
      if (!curr?.is_offer_active) {
        prev["total"] += curr?.price * curr?.quantity;

        prev.line_items.push(curr);

        return prev;
      }
      if (!is_valid(curr)) {
        prev["total"] += curr?.price * curr?.quantity;

        prev.line_items.push(curr);

        return prev;
      }

      return order(prev, curr);
    },
    { total: 0, discount: 0, line_items: [] }
  );
};
