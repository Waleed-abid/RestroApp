module.exports = (coupon, visit) => {
  if (!(coupon && Object.keys(coupon)?.length != 0)) {
    return false;
  }

  if (!(coupon?.visit && visit >= coupon?.target_customers)) {
    return false;
  }
  let date = new Date();
  let day = date.getDay();

  if (!coupon?.valid_from && !(new Date(coupon.valid_from) <= date)) {
    return false;
  }
  if (!coupon?.valid_untill && !(new Date(coupon.valid_untill) >= date)) {
    return false;
  }

  if (!coupon?.valid_days && !coupon?.valid_days.includes(day)) {
    return false;
  }

  return true;
};
