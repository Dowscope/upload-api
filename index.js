const express  = require('express');
const multer = require('multer');
const bp = require('body-parser');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2');
const bcrypt = require('bcrypt');

const app = express();


const pool = mysql.createPool({
  host: '192.168.0.235',
  user: 'dbuser',
  password: 'Qwerty2017',
  database: 'RTS'
});

async function hashPassword(plainPassword) {
  const saltRounds = 10; // Number of salt rounds (higher is more secure but slower)
  const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
  console.log("Hashed Password:", hashedPassword);
  return hashedPassword;
}

async function verifyPassword(plainPassword, hashedPassword) {
  const match = await bcrypt.compare(plainPassword, hashedPassword);
  console.log("Hete: ",match);
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
  origin: ['http://localhost:55000', 'http://dowscopemedia.ca'],
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

const upload = multer({storage: storage});

app.post('/uploads', upload.single('file'), (req, res) => {
  const timestamp = new Date(Date.now());
  const estOptions = { timeZone: 'America/New_York' };
  const estTimeString = timestamp.toLocaleString('en-US', estOptions);
  console.log(estTimeString + ': ' + req.file.filename + ' File Being Uploaded');
  const fileEntry = {
    fileName: req.file.filename,
    uploaded: estTimeString,
    timestamp: timestamp,
    downloaded: false,
  }
  fs.readFile(__dirname + '/fileList.json', (readErr, data) => {
    if (readErr) {
      console.log('JSON File not found... creating now');
      const obj = [
        fileEntry,
      ]
      const jsonStr = JSON.stringify(obj);
      fs.writeFile(__dirname + '/fileList.json', jsonStr, (wriErr) => {
        if (wriErr) {
          console.log('Error creating JSON File');
          res.send(wriErr);
          return;
        } else {
          console.log('JSON File created successfully');
        }
      });
    } else {
      var list = JSON.parse(data);
      list.push(fileEntry);
      const jsonStr = JSON.stringify(list);
      fs.writeFile(__dirname + '/fileList.json', jsonStr, (wriErr) => {
        if (wriErr) {
          console.log('Error writing to JSON File');
          res.send(wriErr);
          return;
        } else {
          console.log('File added successfully');
        }
      });
    }
    console.log('Upload Complete');
  });
  res.json({ file: req.file});
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

app.get('/list_music', function(req, res) {
  const dirPath = '/store/Music/Records/';
  fs.readdir(dirPath, (readErr, files) => {
    if (readErr) {
      console.log("LIST MUSIC ERROR: " + readErr);
      res.send(readErr);
      return;
    }

    const fileList = [];

    files.forEach(file => {
      if (file[0] != '.'){
        const filePath = path.join(dirPath, file);
        const data = fs.statSync(filePath)
        fileList.push({
          fileName: file,
          uploaded: data.mtime,
          timestamp: null,
          downloaded: null,
        });
      }
    });

    const fileListJSON = JSON.stringify(fileList);
    console.log("LIST MUSIC requested");
    res.send(fileListJSON);
  })
});

app.use(bp.json());

const sanitizeEmail = (email) => email.trim().toLowerCase();

app.post('/checkUser', async function(req, res) {
  const { email, password } = req.body;
  console.log(email, password)

  if (!email || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  //const hash_password = await hashPassword(password);

  const query = 'SELECT password FROM USERS WHERE email = ?';

  pool.query(query, [email], async (err, results) => {
    if (err) {
      console.error("Query Error: ", err);
      return res.status(500).json({ error: 'Query Failed' });
    }

    console.log('Results: ', results);
    if (results.length > 0) {
      const isSuccess = await verifyPassword(password, results[0].password);
      console.log('Success: ', isSuccess);
      if (isSuccess) {
        res.json({ success: true });
      } else {
        res.status(401).json({ error: 'Invalid credentials first' });
      }
    } else {
      res.status(401).json({ error: 'Invalid credentials second' });
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
