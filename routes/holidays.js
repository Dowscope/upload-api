const express = require("express");
const axios = require('axios');

module.exports = function register({ pool_main }) {
  const router = express.Router();
  // *********************************
  // Finance - Get Ontario Holidays
  // *********************************
  router.get('/api/getHolidays', (req, res) => {
    const { year, active } = req.query;
    console.log(`Getting ${active ? 'ACTIVE' : 'INACTIVE'} Holidays for Year: ${year}`);
    if (!year) {
      return res.status(400).json({ success: false, reason: 'Year is required' });
    }

    const qry = "SELECT * FROM holidays WHERE YEAR(STR_TO_DATE(date, '%Y-%m-%d')) = ? and active = ?";
    pool_main.query(qry, [year, active], (err, results) => {
      if (err) {
        console.log('Error getting holidays: '.concat(err));
        return res.status(400).json({ success: false, reason: `Error getting holidays: ${err}` });
      }
      if (results.length > 0) {
        console.log('Holidays Found');
        return res.json({ success: true, holidays: results });
      }
      console.log('No Holidays Found');
      return res.json({ success: false, reason: 'No Holidays Found' });
    });
  });

  // *********************************
  // Finance - Remove Holiday
  // *********************************
  router.post('/api/removeHoliday', (req, res) => {
    const { date, active } = req.body;
    console.log(`Removing ${active} holiday for: ${date}`);
    if (!date) {
      return res.status(400).json({ success: false, reason: 'Date is required' });
    }

    const qry = "UPDATE holidays SET active = ? WHERE date = STR_TO_DATE(?, '%Y-%m-%d')";

    pool_main.query(qry, [active, date], (err, result) => {
      if (err) {
        const msg = 'Error removing holiday: '.concat(err);
        console.log(msg);
        return res.status(400).json({ success: false, reason: msg });
      }

      if (result.affectedRows === 0) {
        const msg = "Holiday removed failed";
        console.log(msg);
        return res.json({ success: false, reason: msg });
      }
      console.log('Holiday removed successfully');
      return res.json({ success: true });
    });
  });

  // *********************************
  // Finance - Add Holiday
  // *********************************
  router.post('/api/addHoliday', (req, res) => {
    const { date, name } = req.body;
    console.log(`Adding ${name} holiday for: ${date}`);
    if (!date || !name) {
      return res.status(400).json({ success: false, reason: 'Name and Date is required' });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!date || !name || typeof name !== 'string' || !dateRegex.test(date)) {
      return res.status(400).json({ success: false, reason: 'Invalid name or date format (expected YYYY-MM-DD)' });
    }
    const cleanName = name.trim();
    const qryAdd = "INSERT INTO holidays (date, name, active) VALUES (STR_TO_DATE(?, '%Y-%m-%d'), ?, 1)";

    pool_main.query(qryAdd, [date, cleanName], (err, result) => {
      if (err) {
        const msg = 'Error removing holiday: ';
        console.log(msg.concat(err));
        return res.status(400).json({ success: false, reason: msg });
      }

      if (result.affectedRows === 0) {
        const msg = "Holiday add failed";
        console.log(msg);
        return res.json({ success: false, reason: msg });
      }
      console.log('Holiday added successfully');
      return res.json({ success: true });
    });
  });

  // *********************************
  // Finance - Update Holidays
  // *********************************
  router.get('/api/updateHolidays', async (req, res) => {
    console.log("Updating Holidays");
    const { year } = req.query;
    if (!year) {
      return res.status(400).json({ success: false, reason: 'Year is required' });
    }
    const url = `https://date.nager.at/api/v3/publicHolidays/${year}/CA`;
    const qry = `SELECT * FROM holidays WHERE date = ?`;
    try {
      const rs = await axios.get(url);
      const ontarioHolidays = rs.data.filter(
        h => !h.counties || h.counties.includes('CA-ON')
      );
      if (ontarioHolidays.length > 0) {
        const qryCheck = "SELECT * FROM holidays WHERE date = STR_TO_DATE(?, '%Y-%m-%d')";
        const qryAdd = "INSERT INTO holidays (date, name, active) VALUES (STR_TO_DATE(?, '%Y-%m-%d'), ?, 1)";

        for (const holiday of ontarioHolidays) {
          const date = holiday.date;
          const name = holiday.localName;
          pool_main.query(qryCheck, [date], async (err, results) => {
            if (err) {
              const msg = 'Error checking holidays: '.concat(err);
              console.log(msg);
              return res.status(400).json({ success: false, reason: msg });
            }
            if (results.length === 0) {
              console.log('Adding Holiday: '.concat(date));
              pool_main.query(qryAdd, [date, name], (err, results) => {
                if (err) {
                  const msg = 'Error adding holiday: '.concat(err);
                  console.log(msg);
                  return res.status(400).json({ success: false, reason: msg });
                }
                console.log('Holiday added successfully');
              });
            }
          });
        }
        return res.json({ success: true, reason: "No Changes"});
      }
      console.log('No Holidays Found');
      return res.json({ success: false, reason: 'No Holidays Found' });
    } catch (error) {
      return res.json({ success: false, reason: error })
    }
  });
  return router;
};
