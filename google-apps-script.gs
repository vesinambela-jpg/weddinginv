/**
 * Google Apps Script for the Bastian & Vero RSVP form.
 *
 * SETUP (one time):
 * 1. Open the spreadsheet:
 *    https://docs.google.com/spreadsheets/d/1pgBfO1wzzEwrGjp_V7Dp0XEqnYob4JD5sDdEzbSs6E0/edit
 * 2. Extensions > Apps Script.
 * 3. Delete anything in the editor and paste this whole file in. Save.
 * 4. Click Deploy > New deployment.
 *    - Select type (gear icon): Web app
 *    - Execute as: Me
 *    - Who has access: Anyone   <-- must be "Anyone", not "Anyone with a
 *                                   Google account", or the site gets
 *                                   "Access denied" and nothing is saved.
 * 5. Click Deploy, authorize when prompted, then copy the "Web app URL"
 *    (it ends in /exec).
 * 6. Paste that URL into script.js as the value of GOOGLE_SHEET_SCRIPT_URL
 *    near the top of the file.
 *
 * If you edit this script later, use Deploy > Manage deployments > edit
 * (pencil) > Version: New version, so the URL stays the same.
 *
 * Every RSVP submission appends a row (Timestamp, Name, Attending, Guests,
 * Wishes) to the first tab of the sheet below. The site also calls this
 * script with a GET request to read all wishes back for the "Wishes from
 * loved ones" section, so every visitor sees every submitted wish.
 */

var SHEET_ID = '1pgBfO1wzzEwrGjp_V7Dp0XEqnYob4JD5sDdEzbSs6E0';
var HEADERS = ['Timestamp', 'Name', 'Attending', 'Guests', 'Wishes'];

function getSheet_() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Guest input that starts with = + - @ would otherwise be run as a
// spreadsheet formula; a leading apostrophe makes Sheets store it as text.
function clean_(value, maxLength) {
  var text = String(value == null ? '' : value).trim().slice(0, maxLength);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ status: 'error', message: 'Invalid data' });
  }
  if (!data.name || !data.attend) {
    return json_({ status: 'error', message: 'Missing name or attendance' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    getSheet_().appendRow([
      new Date(),
      clean_(data.name, 100),
      data.attend === 'yes' ? 'Yes' : 'No',
      clean_(data.guests, 3),
      clean_(data.message, 1000)
    ]);
  } finally {
    lock.releaseLock();
  }
  return json_({ status: 'ok' });
}

function doGet() {
  var sheet = getSheet_();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return json_([]);

  var rows = sheet.getRange(2, 1, lastRow - 1, 5).getDisplayValues();
  var wishes = rows
    .filter(function (row) { return row[1] && row[4]; })
    .map(function (row) {
      return {
        name: row[1].replace(/^'/, ''),
        attend: String(row[2]).toLowerCase() === 'yes' ? 'yes' : 'no',
        message: row[4].replace(/^'/, '')
      };
    })
    .reverse();
  return json_(wishes);
}
