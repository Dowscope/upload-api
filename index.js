const express  = require('express');
const multer = require('multer');
const bp = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const axios = require('axios');
const FormData = require('form-data');

const app = express();

const qryValidateSession = "SELECT s.user_id FROM sessionstore s JOIN USERS u ON u.userid = s.user_id WHERE s.session = ? AND s.expire_date > CURDATE() AND s.status = 1 AND u.email = ?";


const pool = mysql.createPool({
  host: '192.168.0.235',
  user: 'dbuser',
  password: 'Qwerty2017',
  database: 'RTS'
});

const pool_main = mysql.createPool({
  host: '192.168.0.235',
  user: 'dbuser',
  password: 'Qwerty2017',
  database: 'MAINSITE'
});

async function hashPassword(plainPassword) {
  const saltRounds = 10; // Number of salt rounds (higher is more secure but slower)
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  console.log("Hashed Password:", hashedPassword);
  return hashedPassword;
}

async function verifyPassword(plainPassword, hashedPassword) {
  const match = await bcrypt.compare(plainPassword, hashedPassword);
  console.log("Verify: ",match);
  if (match) {
      console.log("Password is correct!");
      return true;
  } else {
      console.log("Password is incorrect!");
      return false;
  }
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

app.use(cors({
  origin: ['http://localhost:55000', 'http://dowscopemedia.ca', 'http://localhost:8080'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

const fileFilter = function(req, file, cb){
  const allowedTypes = ["application/zip", "application/octet-stream", "text/markdown"];
  if (!allowedTypes.includes(file.mimetype)
  || file.name.slice(-3) === 'crp') {
    const error = new Error("Wrong file type");
    error.code = "LIMIT_FILE_TYPES";
    return cb(error, false);
  }
  cb(null, true);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads');
  },
  filename: function ( req, file, cb ){
    cb(null, file.originalname);
  },
  fileFilter
});

const upload = multer({storage: storage}).single('file');

async function createEntry(filename) {
  const timestamp = new Date(Date.now());
  const estOptions = { timeZone: 'America/New_York' };
  const estTimeString = timestamp.toLocaleString('en-US', estOptions);
  console.log(estTimeString + ': ' + filename + ' File Being Uploaded');
  const fileEntry = {
    fileName: filename,
    uploaded: estTimeString,
    timestamp: timestamp,
    downloaded: false,
  }
  
  try {
    var filelist = fs.readFileSync(__dirname + '/fileList.json');
    
    var list = JSON.parse(data);
    list.push(fileEntry);
    const jsonStr = JSON.stringify(list);
  
    fs.writeFileSync(__dirname + '/fileList.json', jsonStr);
    
    var msg = 'File added successfully';
    console.log(msg);
    return { success: true, reason: msg };
  } catch (error) {
    console.log('JSON File not found... creating now');
    const obj = [
      fileEntry,
    ]
    const jsonStr = JSON.stringify(obj);
    fs.writeFileSync(__dirname + '/fileList.json', jsonStr);
    var msg = 'JSON File created';
    console.log(msg);
    return { success: true, reason: msg };
  }
  
}

function verifySession(session_id, email) {
  return new Promise((resolve, reject) => {
    if (!session_id){
      return resolve({success: false, reason: `Session ID Required`});
    }
    if (!email) {
      return resolve({success: false, reason: `Email Required`});
    }

    pool_main.query(qryValidateSession, [session_id, email], (err, results) => {
      if (err) {
        const msg = 'Error getting session id: '.concat(err);
        console.log(msg);
        return reject({success: false, reason: msg});
      }
      
      if (results.length > 0) {
        const msg = 'User Validated';
        console.log(msg);

        const qryGetGroups = "SELECT group_id FROM user_groups WHERE user_id = ?";
        pool_main.query(qryGetGroups, [results[0].user_id], (err, results) => {
          if (err) {
            const msg = 'Error getting user groups: '.concat(err);
            console.log(msg);
            return reject({success: false, reason: msg});
          }
          const groups = results.map(row => row.group_id);
          return resolve({success: true, reason: msg, groups: groups});
        });
        return resolve({success: false, reason: "User does not have permission"});
      }
      const msg = 'Session ID or email Invalid';
      console.log(msg);
      return resolve({success: false, reason: msg});
    });
  });
}

app.post('/uploads', upload, (req, res) => {
  const result = createEntry(req.file.originalname);
  res.json({ success: result.success, reason: result.reason, file: req.file});
});

app.get('/list', function(req, res) {
  fs.readFile(__dirname + '/fileList.json', (readErr, data) => {
    if (readErr) {
      console.log("LIST ERROR: " + readErr);
      res.send(readErr);
      return;
    } else {
      var list = JSON.parse(data);
      const jsonLst = JSON.stringify(list);
      console.log("LIST requested");
      res.send(jsonLst);
    }
  })
});

app.use(bp.json());

app.get('/api/list_music', async (req, res) => {
  const url = 'http://192.168.0.101/list';
  const rs = await axios.get(url);
  // console.log(rs);
  res.json(rs.data);
});

app.get('/api/getMusicFile', async (req, res) => {
  const { filename } = req.query;
  console.log(`Getting Music File: ${filename}`);
  const url = 'http://192.168.0.101/file';
  const rs = await axios.get(url, {
    params: {
      filename: filename,
    },
  });
  console.log(rs.headers);
  res.send(rs.data);
});

const sanitizeEmail = (email) => email.trim().toLowerCase();

// *********************************
// RTS SERVER - Status
// *********************************
app.post('/rtsstatus', (req, res) => {
  const {session_id, email} = req.body;
  if (!session_id){
    return res.json({ valid: false })
  }
  if (!email) {
    return res.status(400).json({ error: 'Logged in user email required' });
  }
  pool.query(qryValidateSession, [session_id, email], async (err, results) => {
    if (err) {
      console.log('rts_ststus error: '.concat(err));
      return res.status(400).json({error: "Error getting rts status"});
    }
    
    if (results.length > 0) {
      console.log('User requesting rts status: '.concat(results[0].user_id));
      try {
        const url = 'http://192.168.0.113/status';
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
app.post('/rtsreboot', (req, res) => {
  const {session_id, email} = req.body;
  if (!session_id){
    return res.json({ valid: false })
  }
  if (!email) {
    return res.status(400).json({ error: 'Logged in user email required' });
  }
  pool.query(qryValidateSession, [session_id, email], async (err, results) => {
    if (err) {
      console.log('rts_ststus error: '.concat(err));
      return res.status(400).json({error: "Error getting rts status"});
    }
    
    if (results.length > 0) {
      console.log('User requesting rts reboot: '.concat(results[0].user_id));
      try {
        const url = 'http://192.168.0.113/reboot';
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
app.post('/rtsuploadruleset', upload, (req, res) => {
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

  pool.query(qryValidateSession, [session_id, email], async (err, results) => {
    if (err) {
      console.log('rts_ststus error: '.concat(err));
      return res.status(400).json({error: "Error uploading ruleset"});
    }
    console.log(results);
    if (results.length > 0) {
      console.log('User requesting rts upload ruleset: '.concat(results[0].user_id));
  
      const formdata = new FormData();
      formdata.append('file', fs.createReadStream(__dirname + '/uploads/' + req.file.originalname), req.file.originalname);
  
      var resdata = '';
      try {
        const url = 'http://192.168.0.113/upload_ruleset';
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
  
      const result = createEntry(req.file.originalname);
      
      console.log('Upload Result: ', result);
      res.json({ success: result.success, reason: result.reason, file: req.file, resdata: resdata });
    }
  });
});

// *********************************
// RTS SERVER - Download RuleSet
// *********************************
app.post('/api/rtsdownloadruleset', async (req, res) => {
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
    const url = 'http://192.168.0.113/ruleset/'.concat(filename);
    const rs = await axios.get(url);
    return res.json({ success: true, filedata: rs.data.file });
  } catch (error) {
    return res.json({ success: false, reason: error })
  }
});

// *********************************
// RTS SERVER - Get Log File
// *********************************
app.post('/api/rtsgetlogfile', async (req, res) => {
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
    const url = 'http://192.168.0.113/logfile/'.concat(filename);
    const rs = await axios.get(url);
    return res.json({ success: true, filedata: rs.data });
  } catch (error) {
    return res.json({ success: false, reason: error })
  }
});

// *********************************
// RTS SERVER - Get RuleSets
// *********************************
app.post('/api/rtsgetrulesets', async (req, res) => {
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
    const url = 'http://192.168.0.113/rulesets';
    const rs = await axios.get(url);
    return res.json({ success: true, filedata: rs.data });
  } catch (error) {
    return res.json({ success: false, reason: error })
  }
});

// *********************************
// Finance - Get Ontario Holidays
// *********************************
app.get('/api/getHolidays', (req, res) => {
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
app.post('/api/removeHoliday', (req, res) => {
  const { date, active } = req.body;
  console.log(`Removing holiday for: ${date}`);
  if (!date) {
    return res.status(400).json({ success: false, reason: 'Date is required' });
  }

  const qry = "UPDATE holidays SET active = ? WHERE date = STR_TO_DATE(?, '%Y-%m-%d')";
  pool_main.query(qry, [date, active], (err, results) => {
    if (err) {
      const msg = 'Error removing holiday: '.concat(err);
      console.log(msg);
      return res.status(400).json({ success: false, reason: msg });
    }
    return res.json({ success: true });
  });
});

// *********************************
// Finance - Update Holidays
// *********************************
app.get('/api/updateHolidays', async (req, res) => {
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

      for (holiday of ontarioHolidays) {
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

// *********************************
// Add User
// *********************************
app.post('/adduser', (req, res) => {
  const { session_id, useremail, user } = req.body;
  const { email, firstname, lastname, password, type } = user;

  console.log(`${session_id} | Adding New User: ${email}` );

  if (!session_id){
    return res.json({ success: false, reason: 'No User logged in' })
  }

  if (!useremail) {
    return res.status(400).json({ error: 'Logged in user email required' });
  }

  if (!user || email === '' || firstname === '' || lastname === '' || password === '' || type === ''){
    console.log(`Missing Information: ${user}`);
    return res.json({ success: false, reason: 'Missing Information' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  pool.query(qryValidateSession, [session_id, useremail], async (err, results) => {
    if (err) {
      console.log('Error getting session id: '.concat(err));
      return res.status(400).json({success: false, reason: `Error getting session id: ${err}`});
    }
    
    console.log(results);
    if (results.length > 0) {
      console.log('User adding new user: '.concat(results[0].user_id));
      const hash_passwd = await hashPassword(password);
      try {
        const qry = 'INSERT INTO USERS (email, first_name, last_name, last_modified_date, password, user_type_id) VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, ?)';
        pool.query(qry, [email, firstname, lastname, hash_passwd, type], (ins_err, ins_result) => {
          if (ins_err) {
            console.log('Error inserting user: '.concat(ins_err.message));
            return res.status(400).json({success: false, reason: `Error inserting user: ${ins_err.message}`});
          }
          res.json({ success: true })
        })
      } catch (error) {
          res.status(500).json({ error: `Failed to insert data ${error}` });
      }
    }
  });
});

// *********************************
// Check Session Valid
// Updated for RTS and Main Servers
// *********************************
app.post('/sessioncheck', function (req, res) {
  const { session_id, cat } = req.body;
  if (!session_id){
    return res.json({ valid: false })
  }
  if (!cat) {
    return res.status(400).json({ valid: false, error: 'Category is required' });
  }

  db = pool_main;
  if (cat === 'rts') {
    db = pool;
  } else if (cat === 'main') {
    db = pool_main;
  } else {
    return res.status(400).json({ error: 'Invalid category' });
  }

  const query = "SELECT u.email, u.first_name, u.last_name, u.user_type_id FROM sessionstore s JOIN USERS u ON u.userid = s.user_id WHERE s.session = ? AND s.expire_date > CURDATE()";
  db.query(query, [session_id], (err, results) => {
    if (err) {
      console.log('Error: '.concat(err));
      return res.status(400).json({error: "Error getting session"});
    }
    if (results.length > 0){
      return res.json({valid: true, email: results[0].email, firstname: results[0].first_name, lastname: results[0].last_name, type: results[0].user_type_id});
    }
    else {
      return res.json({valid: false});
    }
  });
});

// *********************************
// Check User
// Updated for RTS and Main Servers
// *********************************
app.post('/checkUser', async function(req, res) {
  const { email, password, cat } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  if (!cat) {
    return res.status(400).json({ error: 'Category is required' });
  }

  db = pool_main;
  if (cat === 'rts') {
    db = pool;
  } else if (cat === 'main') {
    db = pool_main;
  } else {
    return res.status(400).json({ error: 'Invalid category' });
  }
  console.log(`Checking User: ${email} | Category: ${cat}`);

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const query = 'SELECT password, userid, first_name, last_name, user_type_id FROM USERS WHERE email = ?';


  db.query(query, [email], async (err, results) => {
    if (err) {
      console.error("Query Error: ", err);
      return res.status(500).json({ error: 'Query Failed' });
    }

    if (results.length > 0) {
      const isSuccess = await verifyPassword(password, results[0].password);
      if (isSuccess) {
        try {
          const sessionId = crypto.randomUUID();
          const userId = results[0].userid;
          const currentDate = new Date(); // Get the current date
          const futureDate = new Date();
          futureDate.setDate(currentDate.getDate() + 7);

          const activeSession = "SELECT session_id, session, expire_date FROM sessionstore WHERE user_id = ? AND status = 1 AND expire_date > CURDATE()";
          db.query(activeSession, [userId], (activeErr, activeResults) => {
            if (activeErr) {
              console.error("Active Session Error:", sessionErr);
              return res.status(500).json({ error: "Failed to get active session" });
            }
            activeResults.forEach(result => {
              const ar_query = `UPDATE sessionstore SET status = 0 WHERE session_id = ?`;
              db.query(ar_query, [result.session_id], (error, results) => {
                if (error) {
                  console.error('Error updating status:', error);
                } else {
                  console.log(`Row with ID ${result.session_id} updated`);
                }
              });
            })
          });

          const insertSessionQuery = "INSERT INTO sessionstore (user_id, session, expire_date, status) VALUES (?, ?, ?, ?)";
          
          db.query(insertSessionQuery, [userId, sessionId, futureDate, 1], (sessionErr, sessionResults) => {
              if (sessionErr) {
                  console.error("Session Insert Error:", sessionErr);
                  return res.status(500).json({ error: "Failed to create session" });
              }
          });
          
          const updateLoginInfo = "UPDATE USERS SET last_login_date = CURRENT_TIMESTAMP WHERE userid = ?";
          db.query(updateLoginInfo, [userId], (updateErr, updateResults) => {
            if (updateErr) {
              console.error("Error updating last login date:", updateErr);
            }
            console.log("Last login date updated successfully");
          });

          let groups = [];
          const getUserGroups = "SELECT group_id FROM user_groups WHERE user_id = ?";
          db.query(getUserGroups, [userId], (groupErr, groupResults) => {
            if (groupErr) {
              console.error("Error getting user groups:", groupErr);
              return res.status(500).json({ error: "Failed to get user groups" });
            }
            console.log("User groups retrieved successfully");
            groups = groupResults.map(group => group.group_id);
          });

          return res.json({ success: true, sessionId: sessionId, firstname: results[0].first_name, lastname: results[0].last_name, type: results[0].user_type_id, groups: groups });
        } catch (error) {
            console.error("Unexpected Error:", error);
            return res.status(500).json({ error: "Internal Server Error" });
        }
      } else {
        return res.status(401).json({ error: 'Invalid credentials first' });
      }
    } else {
      return res.status(401).json({ error: 'Invalid credentials second' });
    }
  });
});

// *********************************
// Validate User
// *********************************
app.post('/validate', async function(req, res) {
  const { session_id, email, password } = req.body;
  console.log(`${session_id} | Validating User: ${email}`);

  if (!session_id){
    return res.json({ success: false, reason: 'No User logged in' })
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  pool.query(qryValidateSession, [session_id, email], async (err, results) => {
    if (err) {
      console.log('Error getting session id: '.concat(err));
      return res.status(400).json({success: false, reason: `Error getting session id: ${err}`});
    }
    
    if (results.length > 0) {
      try {
        const qry = 'SELECT password FROM USERS WHERE userid = ?';
        pool.query(qry, [results[0].user_id], async (val_err, val_result) => {
          if (val_err) {
            console.log('Error inserting user: '.concat(val_err.message));
            return res.status(400).json({success: false, reason: `Error inserting user: ${val_err.message}`});
          }
          console.log(val_result);
          if (val_result.length > 0) {
            const isSuccess = await verifyPassword(password, val_result[0].password);
            if (isSuccess) {
              res.json({ success: isSuccess });
            } else {
              res.json({ success: isSuccess, reason: 'Old Password Incorrect' });
            }
          } else {
            res.json({ success: false, reason: 'User or Password not found' });
          }
        })
      } catch (error) {
          res.status(500).json({ error: `Failed to validate ${error}` });
      }
    }
  });
});

// *********************************
// Update User Password
// *********************************
app.post('/updateuser', async function(req, res) {
  const { session_id, email, password } = req.body;
  console.log(`${session_id} | Validating User: ${email}`);

  if (!session_id){
    return res.json({ success: false, reason: 'No User logged in' })
  }

  if (!email || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  console.log('Values: ', session_id, email, password);
  pool.query(qryValidateSession, [session_id, email], async (err, results) => {
    if (err) {
      console.log('Error getting session id: '.concat(err));
      return res.status(400).json({success: false, reason: `Error getting session id: ${err}`});
    }
    
    if (results.length > 0) {
      try {
        const qry = 'SELECT password FROM USERS WHERE userid = ?';
        pool.query(qry, [results[0].user_id], async (val_err, val_result) => {
          if (val_err) {
            console.log('Error inserting user: '.concat(val_err.message));
            return res.status(400).json({success: false, reason: `Error inserting user: ${val_err.message}`});
          }
          console.log(val_result);
          if (val_result.length > 0) {
            console.log(`${session_id} | Updating User: ${email}`);
            const newPass = await hashPassword(password);
            const updateQry = 'UPDATE USERS SET password = ?, last_modified_date = CURRENT_TIMESTAMP WHERE userid = ?';
            pool.query(updateQry, [newPass, results[0].user_id], (upd_err, upd_result) => {
              if (upd_err) {
                console.log('Error updating password: '.concat(upd_err));
                return res.status(400).json({success: false, reason: `Error updating password: ${upd_err}`});
              }
              const changedRows = upd_result.ResultSetHeader.changedRows;
              console.log('Password Updated | ChangedRows: ', changedRows);
              if (changedRows > 0) {
                res.json({ success: true });
              } else {
                res.json({ success: false, reason: 'Password not updated' });
              }
            });
          }
        })
      } catch (error) {
          res.status(500).json({ error: `Failed to validate ${error}` });
      }
    }
  });
});

app.post('/download', (req, res) => {
  fileName = req.body['fileName'];
  dl_type = req.body['dl_type'];
  filepath = ""
  console.log('dltype: ' + dl_type);
  if (dl_type === 'music'){
    filePath = '/store/Music/Records/' + fileName;
  } else {
    filePath = __dirname + '/uploads/' + fileName;
  }
  console.log('Trying to download ' + filePath);
  fs.stat(filePath, function(err, stat) {
    if (err){
      console.log('File not found: ' + filePath);
      res.send(err);
      return;
    } 
    if (dl_type != 'music') {
      fs.readFile(__dirname + '/fileList.json', (readErr, data) => {
        if (readErr) {
          res.send(readErr);
          return;
        } else {
          var list = JSON.parse(data)
          var fileFound = list.filter( (item) => {
            return item.fileName == fileName;
          });
          const index = list.indexOf(fileFound[0]);
          delete list[index];
          var tempArry = [];
          for (let i of list) {
            i && tempArry.push(i);
          }
          list = tempArry;

          fileFound[0].downloaded = true;
          list.push(fileFound[0]);

          console.log(list);

          const jsonStr = JSON.stringify(list);
          fs.writeFile(__dirname + '/fileList.json', jsonStr, (wriErr) => {
            if (wriErr) {
              console.log(wriErr);
              res.send(wriErr);
              return;
            } else {
              console.log('File added successfully');
            }
          });
        }
      });
    }
    const data = fs.readFileSync(filePath);
    res.send(data.toString('base64'));
  });
});

app.post('/remove', (req, res) => {
  const filename = req.body['filename'];

  fs.readFile(__dirname + '/fileList.json', (readErr, data) => {
    if (readErr) {
      console.log ("REMOVE: " + readErr);
      res.send(readErr);
      return;
    }
    var list = JSON.parse(data)
    var fileFound = list.filter( (item) => {
      return item.fileName != filename;
    });
    list = fileFound;

    const jsonStr = JSON.stringify(list);
    fs.writeFile(__dirname + '/fileList.json', jsonStr, (wriErr) => {
      if (wriErr) {
        console.log("REMOVED: " + wriErr);
        res.send(wriErr);
        return;
      } else {
        console.log('File Removed successfully');
      }
    });
    res.send(filename + " Removed");
  });
});

app.use(function(err, req, res, next) {
  if (err.code === "LIMIT_FILE_TYPES"){
    res.status(422).json({ error: "Only game files are allowed" })
    return;
  }
});

app.listen(55000, () => console.log("Running on port: 55000"));
