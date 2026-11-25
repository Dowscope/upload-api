const bcrypt = require('bcrypt');

function createAuthServices({ pool, saltRounds, validateSessionQuery }) {
  async function hashPassword(plainPassword) {
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    console.log('Hashed Password:', hashedPassword);
    return hashedPassword;
  }

  async function verifyPassword(plainPassword, hashedPassword) {
    const match = await bcrypt.compare(plainPassword, hashedPassword);
    console.log('Verify: ', match);
    console.log(match ? 'Password is correct!' : 'Password is incorrect!');
    return match;
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function verifySession(sessionId, email) {
    return new Promise((resolve, reject) => {
      if (!sessionId) return resolve({ success: false, reason: 'Session ID Required' });
      if (!email) return resolve({ success: false, reason: 'Email Required' });

      pool.query(validateSessionQuery, [sessionId, email], (err, results) => {
        if (err) {
          const msg = 'Error getting session id: '.concat(err);
          console.log(msg);
          return reject({ success: false, reason: msg });
        }
        if (results.length === 0) {
          const msg = 'Session ID or email Invalid';
          console.log(msg);
          return resolve({ success: false, reason: msg });
        }

        const msg = 'User Validated';
        console.log(msg);
        pool.query('SELECT group_id FROM user_groups WHERE user_id = ?', [results[0].user_id], (groupErr, groupResults) => {
          if (groupErr) {
            const groupMsg = 'Error getting user groups: '.concat(groupErr);
            console.log(groupMsg);
            return reject({ success: false, reason: groupMsg });
          }
          return resolve({ success: true, reason: msg, groups: groupResults.map(row => row.group_id) });
        });
      });
    });
  }

  return { hashPassword, verifyPassword, isValidEmail, verifySession };
}

module.exports = createAuthServices;
