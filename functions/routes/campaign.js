const express = require("express");
const bodyParser = require("body-parser");
const functions = require("firebase-functions");
const cors = require("cors");
const { Campaign } = require("../models");
const router = express();

router.use(cors({ origin: true }));
router.use(bodyParser.urlencoded({ extended: true }));
router.use(express.json());

router.post("/", async (req, res) => {
  try {
    const { campaign } = req.body;
    if (!(campaign && Object.keys(campaign)?.length != 0)) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Compaign data missing",
      });
    }

    let date = new Date();

    await Campaign.add({
      is_active: campaign?.is_active || false,
      name: campaign?.name || "",
      code: `${date.toDateString().split(" ").reverse().join("")}${
        campaign?.discount
      }`,
      discount: campaign?.discount,
      message: campaign?.message || "",
      customers: campaign?.customers || [],
      validity: campaign?.validity,
      budget: campaign?.budget,
      recurrence: campaign?.recurrence,
      start_date: campaign?.start_date,
      end_date: campaign?.end_date,
      days: campaign?.days,
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "Campaing created successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while creating campaign",
    });
  }
});

router.put("/update-status", async (req, res) => {
  try {
    const { is_active } = req.body;
    const { campaign_id } = req.query;
    if (!campaign_id) {
      return res.status(400).json({
        status: 400,
        success: false,
        message: "Campaign id missing",
      });
    }

    await Campaign.doc(campaign_id).update({
      is_active: is_active || false,
    });

    res.status(200).send({
      status: 200,
      success: true,
      message: "Campaing updated successfully",
    });
  } catch (error) {
    functions.logger.log(error);
    res.status(500).json({
      status: 500,
      success: false,
      message: "Error while updaing campaign",
    });
  }
});

module.exports = router;
