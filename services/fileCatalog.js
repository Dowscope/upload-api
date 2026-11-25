const fs = require('fs');

function createFileCatalog(config) {
  async function createEntry(filename) {
    const timestamp = new Date(Date.now());
    const estOptions = { timeZone: 'America/New_York' };
    const estTimeString = timestamp.toLocaleString('en-US', estOptions);
    console.log(estTimeString + ': ' + filename + ' File Being Uploaded');

    const fileEntry = {
      fileName: filename,
      uploaded: estTimeString,
      timestamp,
      downloaded: false
    };

    try {
      let list = [];
      if (fs.existsSync(config.files.fileList)) {
        const filelist = fs.readFileSync(config.files.fileList);
        list = JSON.parse(filelist);
      }
      list.push(fileEntry);
      fs.writeFileSync(config.files.fileList, JSON.stringify(list, null, 2));
      console.log('File added successfully');
      return { success: true, reason: 'File added successfully' };
    } catch (error) {
      const msg = 'Error updating file list: '.concat(error);
      console.log(msg);
      return { success: false, reason: msg };
    }
  }

  return { createEntry };
}

module.exports = createFileCatalog;
