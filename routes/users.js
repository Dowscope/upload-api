const express = require("express");
const crypto = require('crypto');

module.exports = function register({ pool, pool_main, config, validateSessionQuery, hashPassword, verifyPassword, isValidEmail, verifyAdminSession }) {
  const router = express.Router();

  router.post('/api/getUsers', async (req, res) => {
    const { session_id, email } = req.body || {};
    if (!session_id || !email) {
      return res.status(401).json({ error: 'A valid user session is required' });
    }

    try {
      const auth = await verifyAdminSession(session_id, email);
      if (!auth || !auth.success) {
        return res.status(401).json({ error: 'Invalid or expired user session' });
      }
      if (!auth.isAdmin) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const [users] = await pool_main.promise().query(
        'SELECT userid, email, first_name, last_name, user_type_id FROM USERS ORDER BY first_name, last_name, email'
      );
      return res.json({ success: true, users });
    } catch (error) {
      console.error('Failed to retrieve users:', error.message);
      return res.status(500).json({ error: 'Failed to retrieve users' });
    }
  });

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

    console.log('Checking User: ', email);

    // Validate email format
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    try {
      const db = pool_main.promise();
      const [users] = await db.query(
        'SELECT password, userid, first_name, last_name, user_type_id FROM USERS WHERE email = ?',
        [email]
      );

      if (users.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = users[0];
      if (!(await verifyPassword(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const sessionId = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + config.security.sessionLengthDays);

      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();
        await connection.query(
          'UPDATE sessionstore SET status = 0 WHERE user_id = ? AND status = 1 AND expire_date > CURDATE()',
          [user.userid]
        );
        await connection.query(
          'INSERT INTO sessionstore (user_id, session, expire_date, status) VALUES (?, ?, ?, ?)',
          [user.userid, sessionId, expiresAt, 1]
        );
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }

      await db.query(
        'UPDATE USERS SET last_login_date = CURRENT_TIMESTAMP WHERE userid = ?',
        [user.userid]
      );
      const [groups] = await db.query(
        'SELECT group_id FROM user_groups WHERE user_id = ?',
        [user.userid]
      );

      return res.json({
        success: true,
        sessionId,
        firstname: user.first_name,
        lastname: user.last_name,
        type: user.user_type_id,
        groups: groups.map(group => group.group_id)
      });
    } catch (error) {
      console.error('Sign-in failed:', error);
      return res.status(500).json({ error: 'Sign-in failed' });
    }
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
