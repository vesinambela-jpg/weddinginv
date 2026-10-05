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
 * PERSONAL INVITATION LINKS (one time):
 * 7. In the Apps Script editor, pick "setupLinkSecret" in the function
 *    dropdown at the top and click Run. This creates a private key, stored
 *    in this project's Script Properties (never in this file, so it stays
 *    secret even though the code is on GitHub).
 * 8. In the "List undangan" tab, put this in B2 to fill the whole URL
 *    column from the names in column A:
 *        =GUEST_URL(A2:A)
 *    Each link carries the guest's name plus a code made from it with the
 *    private key. The site asks this script to check the code, so a link
 *    only works if it came from this column: editing the name breaks it,
 *    and removing a guest from column A switches their link off.
 * 9. Running setupLinkSecret again makes a new key and invalidates every
 *    link already sent, so only do that if links have leaked.
 *
 * Every RSVP submission appends a row (Timestamp, Name, Attending, Guests,
 * Wishes) to the first tab of the sheet below. The site also calls this
 * script with a GET request to read all wishes back for the "Wishes from
 * loved ones" section, so every visitor sees every submitted wish.
 */

var SHEET_ID = '1pgBfO1wzzEwrGjp_V7Dp0XEqnYob4JD5sDdEzbSs6E0';
var HEADERS = ['Timestamp', 'Name', 'Attending', 'Guests', 'Wishes'];
var SITE_URL = 'https://www.bastianvero.online/';
var GUEST_TAB = 'List undangan'; // guest names in column A, from row 2
var SECRET_KEY = 'LINK_SECRET';

/** Run once from the editor to create the private key for guest links. */
function setupLinkSecret() {
  var secret = Utilities.getUuid() + Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty(SECRET_KEY, secret);
  Logger.log('Link key created. Fill the URL column with =GUEST_URL(A2:A).');
}

function linkCode_(name) {
  var secret = PropertiesService.getScriptProperties().getProperty(SECRET_KEY);
  if (!secret) throw new Error('Run setupLinkSecret first.');
  var sig = Utilities.computeHmacSha256Signature(String(name).trim(), secret);
  return Utilities.base64EncodeWebSafe(sig).replace(/=+$/, '').slice(0, 12);
}

/**
 * Personal invitation link(s) for guest name(s).
 * Use =GUEST_URL(A2) for one row, or =GUEST_URL(A2:A) to fill a column.
 * @customfunction
 */
function GUEST_URL(names) {
  function one(name) {
    name = String(name == null ? '' : name).trim();
    if (!name) return '';
    return SITE_URL + '?to=' + encodeURIComponent(name) + '&k=' + linkCode_(name);
  }
  if (Array.isArray(names)) {
    return names.map(function (row) { return [one(row[0])]; });
  }
  return one(names);
}

function isOnGuestList_(name) {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(GUEST_TAB);
  if (!sheet || sheet.getLastRow() < 2) return false;
  var names = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  return names.some(function (row) { return String(row[0]).trim() === name; });
}

// GET ?action=verify&to=<name>&k=<code>: is this a link from the URL column?
function verifyGuest_(params) {
  var name = String(params.to || '').trim();
  var code = String(params.k || '');
  if (!name || !code) return { ok: false };
  try {
    if (code !== linkCode_(name) || !isOnGuestList_(name)) return { ok: false };
  } catch (err) {
    return { ok: false };
  }
  return { ok: true, name: name };
}

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

function doGet(e) {
  var params = (e && e.parameter) || {};
  if (params.action === 'verify') return json_(verifyGuest_(params));

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
