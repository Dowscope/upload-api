const express = require("express");
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');

module.exports = function register({ config, pool, validateSessionQuery, upload, createEntry, verifySession }) {
  const router = express.Router();
  // *********************************
  // RTS SERVER - Status
  // *********************************
  router.post('/rtsstatus', (req, res) => {
    const {session_id, email} = req.body;
    if (!session_id){
      return res.json({ valid: false })
    }
    if (!email) {
      return res.status(400).json({ error: 'Logged in user email required' });
    }
    pool.query(validateSessionQuery, [session_id, email], async (err, results) => {
      if (err) {
        console.log('rts_ststus error: '.concat(err));
        return res.status(400).json({error: "Error getting rts status"});
      }

      if (results.length > 0) {
        console.log('User requesting rts status: '.concat(results[0].user_id));
        try {
          const url = `http://${config.servers.rts}/status`;
          const rs = await axios.get(url);
          console.log(rs.data);
          res.json({status: rs.data.status});
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch data' });
        }
      }
    });
  });

  // *********************************
  // RTS SERVER - Reboot
  // *********************************
  router.post('/rtsreboot', (req, res) => {
    const {session_id, email} = req.body;
    if (!session_id){
      return res.json({ valid: false })
    }
    if (!email) {
      return res.status(400).json({ error: 'Logged in user email required' });
    }
    pool.query(validateSessionQuery, [session_id, email], async (err, results) => {
      if (err) {
        console.log('rts_ststus error: '.concat(err));
        return res.status(400).json({error: "Error getting rts status"});
      }

      if (results.length > 0) {
        console.log('User requesting rts reboot: '.concat(results[0].user_id));
        try {
          const url = `http://${config.servers.rts}/reboot`;
          const rs = await axios.post(url);
          console.log(rs);
          res.json({status: rs.data.status});
        } catch (error) {
            res.status(500).json({ error: `Failed to fetch data ${error}` });
        }
      }
    });
  });

  // *********************************
  // RTS SERVER - Upload RuleSet
  // *********************************
  router.post('/rtsuploadruleset', upload, (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const {session_id, email} = req.body;
    console.log(req.body);

    if (!session_id){
      return res.json({ valid: false, reason: 'No User logged in' })
    }
    if (!email) {
      return res.status(400).json({ error: 'Logged in user email required' });
    }

    pool.query(validateSessionQuery, [session_id, email], async (err, results) => {
      if (err) {
        console.log('rts_ststus error: '.concat(err));
        return res.status(400).json({error: "Error uploading ruleset"});
      }
      console.log(results);
      if (results.length > 0) {
        console.log('User requesting rts upload ruleset: '.concat(results[0].user_id));

        const formdata = new FormData();
        formdata.append('file', fs.createReadStream(config.files.uploadDir + '/' + req.file.originalname), req.file.originalname);

        var resdata = '';
        try {
          const url = `http://${config.servers.rts}/upload_ruleset`;
          const rs = await axios.post(url, formdata, {
              headers: {
                  ...formdata.getHeaders()
                }
          });
          resdata = rs.data;
        } catch (error) {
          resdata = error;
          res.status(500).json({ error: `Failed to fetch data ${error}` });
        }

        const result = await createEntry(req.file.originalname);

        console.log('Upload Result: ', result);
        res.json({ success: result.success, reason: result.reason, file: req.file, resdata: resdata });
      }
    });
  });

  // *********************************
  // RTS SERVER - Download RuleSet
  // *********************************
  router.post('/api/rtsdownloadruleset', async (req, res) => {
    const {session_id, email, filename} = req.body;
    console.log(`${email} | Downloading Ruleset: ${filename}`);

    var result = await verifySession(session_id, email);
    console.log('Validation Results: '.concat(result.success));

    if (result == undefined){
      return res.json({ success: false, reason: "No Results" })
    }else if (!result.success){
      return res.json({ success: false, reason: result.reason })
    }

    try {
      const url = `http://${config.servers.rts}/ruleset/${filename}`;
      const rs = await axios.get(url);
      return res.json({ success: true, filedata: rs.data.file });
    } catch (error) {
      return res.json({ success: false, reason: error })
    }
  });

  // *********************************
  // RTS SERVER - Get Log File
  // *********************************
  router.post('/api/rtsgetlogfile', async (req, res) => {
    const {session_id, email, filename} = req.body;
    console.log(`${email} | Getting Log File: ${filename}`);

    var result = await verifySession(session_id, email);
    console.log('Validation Results: '.concat(result.success));

    if (result == undefined){
      return res.json({ success: false, reason: "No Results" })
    }else if (!result.success){
      return res.json({ success: false, reason: result.reason })
    }

    try {
      const url = `http://${config.servers.rts}/logfile/${filename}`;
      const rs = await axios.get(url);
      return res.json({ success: true, filedata: rs.data });
    } catch (error) {
      return res.json({ success: false, reason: error })
    }
  });

  // *********************************
  // RTS SERVER - Get RuleSets
  // *********************************
  router.post('/api/rtsgetrulesets', async (req, res) => {
    const {session_id, email } = req.body;
    console.log(`${email} | Getting Rulesets`);

    var result = await verifySession(session_id, email);
    console.log('Validation Results: '.concat(result.success));

    if (result == undefined){
      return res.json({ success: false, reason: "No Results" })
    }else if (!result.success){
      return res.json({ success: false, reason: result.reason })
    }

    try {
      const url = `http://${config.servers.rts}/rulesets`;
      const rs = await axios.get(url);
      return res.json({ success: true, filedata: rs.data });
    } catch (error) {
      return res.json({ success: false, reason: error })
    }
  });
  return router;
};
