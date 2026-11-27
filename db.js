const mysql = require('mysql2');

const validateSessionQuery = 'SELECT s.user_id, u.user_type_id FROM sessionstore s JOIN USERS u ON u.userid = s.user_id WHERE s.session = ? AND s.expire_date > CURDATE() AND s.status = 1 AND u.email = ?';

function createPools(config) {
  const connection = {
    host: config.database.host,
    user: config.database.user,
    password: config.database.password
  };

  return {
    rts: mysql.createPool({ ...connection, database: config.database.rtsDatabase }),
    main: mysql.createPool({ ...connection, database: config.database.mainDatabase }),
    music: mysql.createPool({ ...connection, database: config.database.musicDatabase })
  };
}

module.exports = { createPools, validateSessionQuery };
