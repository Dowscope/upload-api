const express = require("express");
const crypto = require('crypto');

module.exports = function register({ pool, pool_main, validateSessionQuery, hashPassword, verifyPassword, isValidEmail }) {
  const router = express.Router();
  // *********************************
  // Add User
  // *********************************
  router.post('/adduser', (req, res) => {
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

    pool.query(validateSessionQuery, [session_id, useremail], async (err, results) => {
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
  router.post('/sessioncheck', function (req, res) {
    const { session_id, cat } = req.body;
    if (!session_id){
      return res.json({ valid: false })
    }
    if (!cat) {
      return res.status(400).json({ valid: false, error: 'Category is required' });
    }

    let db = pool_main;
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
  router.post('/checkUser', async function(req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    let db = pool_main;

    console.log('Checking User: ', email);

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
                console.error("Active Session Error:", activeErr);
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
  router.post('/validate', async function(req, res) {
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

    pool.query(validateSessionQuery, [session_id, email], async (err, results) => {
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
  router.post('/updateuser', async function(req, res) {
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
    pool.query(validateSessionQuery, [session_id, email], async (err, results) => {
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
                const changedRows = upd_result.changedRows;
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
  return router;
};
