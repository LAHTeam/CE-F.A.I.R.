/**
 * ==============================================================================
 * ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน
 * Google Apps Script Backend (Code.gs)
 * ระบบ CE F.A.I.R. (Department of Civil Engineering, KKU)
 * ==============================================================================
 */

// ==========================================
// ORG AI API CONFIGURATION (KKU AI & LLM Engine)
// ==========================================
const ORG_API_BASE_URL = 'https://gen.ai.kku.ac.th/api/v1';
const ORG_API_URL      = ORG_API_BASE_URL + '/chat/completions';
const ORG_MODELS_URL   = ORG_API_BASE_URL + '/models';

const BRAND_PATTERNS = {
  "OpenAI":     /^(gpt|o1|o3|o4|chatgpt)/i,
  "Anthropic":  /^claude/i,
  "Google":     /^gemini/i,
  "DeepSeek":   /^deepseek/i,
  "Qwen":       /^qwen/i,
  "Mistral":    /^mistral/i,
  "xAI":        /^grok/i,
  "Meta":       /^llama/i,
  "Amazon":     /^nova/i,
  "MiniMax":    /^minimax/i,
  "MoonshotAI": /^kimi/i
};

const RANK_KEYWORDS = { "gpt": 4, "sonnet": 5, "max": 4, "large": 3, "pro": 2, "grok": 4.2, "gemini": 4 };

function getOrgApiKey() {
  // ห้าม hardcode API Key ในซอร์สโค้ด — ต้องตั้งค่าผ่าน Script Properties เท่านั้น
  // วิธีตั้งค่า: Apps Script Editor > Project Settings > Script Properties > เพิ่ม Key "ORG_API_KEY"
  // API key must never be stored in the Settings sheet or source code.
  var key = PropertiesService.getScriptProperties().getProperty('ORG_API_KEY');
  return key ? key.trim() : '';
}

function scoreModel(name) {
  if (!name) return 0;
  var tokens = name.match(/\d+\.?\d*[bB]?/g) || [];
  var validNumbers = tokens
    .filter(function(t) { return !/[bB]$/.test(t) && parseFloat(t) < 100; })
    .map(function(t) { return parseFloat(t); });
  var maxNum = validNumbers.length > 0 ? Math.max.apply(null, validNumbers) : 0;
  
  var lower = name.toLowerCase();
  var keywordScore = 0;
  for (var k in RANK_KEYWORDS) {
    if (lower.indexOf(k) !== -1) {
      keywordScore += RANK_KEYWORDS[k];
    }
  }
  return maxNum + keywordScore;
}

function selectBestModelsPerBrand() {
  var allModelIds = [];
  try {
    var key = getOrgApiKey();
    if (key) {
      var res = UrlFetchApp.fetch(ORG_MODELS_URL, {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      });
      var json = JSON.parse(res.getContentText());
      if (json && json.data && Array.isArray(json.data)) {
        allModelIds = json.data.map(function(m) { return m.id; });
      }
    }
  } catch (e) {
    allModelIds = [];
  }

  if (!allModelIds || allModelIds.length === 0) {
    allModelIds = [
      'claude-sonnet-5', 'deepseek-v4-pro', 'gemini-3.1-pro-preview',
      'llama-4-maverick', 'minimax-m3', 'mistral-large-2512',
      'kimi-k3', 'nova-pro-v1', 'gpt-5.6-terra', 'qwen3.7-max', 'grok-4.5'
    ];
  }

  var bestPerBrand = {};
  for (var i = 0; i < allModelIds.length; i++) {
    var mid = allModelIds[i];
    for (var brand in BRAND_PATTERNS) {
      if (BRAND_PATTERNS[brand].test(mid)) {
        if (!bestPerBrand[brand] || scoreModel(mid) > scoreModel(bestPerBrand[brand])) {
          bestPerBrand[brand] = mid;
        }
        break;
      }
    }
  }

  var result = [];
  for (var b in bestPerBrand) {
    result.push(bestPerBrand[b]);
  }
  return result;
}

function getBestModel() {
  var models = selectBestModelsPerBrand();
  if (!models || models.length === 0) return 'gpt-4o';
  models.sort(function(a, b) { return scoreModel(b) - scoreModel(a); });
  return models[0];
}

// ==========================================
// GAS Web App Entry Point & Fast Injection
// ==========================================

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};

  // Quick Actions from Email (One-click direct approve/reject)
  if (params.action && params.token && params.stage) {
    var action = params.action;
    var token = params.token;
    var stage = Number(params.stage);
    var note = params.note || (action === 'approve' ? 'อนุมัติผ่านอีเมล' : 'ปฏิเสธผ่านอีเมล');

    try {
      var verified = verifyToken(token, stage);
      var reqId = verified.requestData[0];
      var applicantName = verified.requestData[3];
      var roomName = verified.requestData[10];

      if (action === 'approve') {
        if (stage === 4) {
          // Stage 4 requires reviewing and confirming biometric appointment date in Web UI
          var template = HtmlService.createTemplateFromFile('Index');
          template.preloadedUserEmail = getCurrentUserEmail();
          template.serverParamsJson = JSON.stringify(params);
          return template.evaluate()
            .setTitle('ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน')
            .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
        }

        processApproval(reqId, stage, 'Approve', note, token, {});
        return renderActionResponseHtml('อนุมัติคำขอเรียบร้อยแล้ว', 'คำขอเลขที่ ' + reqId + ' (ผู้ขอ: ' + applicantName + ', ห้อง: ' + roomName + ') ได้รับการอนุมัติในขั้นตอนที่ ' + stage + ' เรียบร้อยแล้ว', '#10B981', '✓');
      } else if (action === 'reject') {
        processApproval(reqId, stage, 'Reject', note, token, {});
        return renderActionResponseHtml('ปฏิเสธคำขอเรียบร้อยแล้ว', 'คำขอเลขที่ ' + reqId + ' (ผู้ขอ: ' + applicantName + ', ห้อง: ' + roomName + ') ได้รับการบันทึกปฏิเสธคำขอเรียบร้อยแล้ว', '#EF4444', '✕');
      }
    } catch (err) {
      return renderActionResponseHtml('ไม่สามารถดำเนินการได้', err.message || 'Token ไม่ถูกต้องหรือหมดอายุแล้ว', '#F59E0B', '!');
    }
  }

  var template = HtmlService.createTemplateFromFile('Index');
  template.preloadedUserEmail = getCurrentUserEmail();
  template.serverParamsJson = JSON.stringify(params);

  return template.evaluate()
    .setTitle('ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderActionResponseHtml(title, message, color, icon) {
  var webAppUrl = ScriptApp.getService().getUrl();
  var html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">' +
    '<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">' +
    '<style>body{font-family:\'Sarabun\',sans-serif;background:#f8fafc;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:20px;}' +
    '.card{background:#fff;padding:35px 25px;border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.08);max-width:480px;width:100%;text-align:center;border-top:6px solid ' + color + ';}' +
    '.icon{width:56px;height:56px;border-radius:50%;background:' + color + '15;color:' + color + ';display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:bold;margin:0 auto 15px auto;}' +
    'h2{color:#1e293b;margin:0 0 10px 0;font-size:20px;font-weight:700;}' +
    'p{color:#64748b;font-size:14px;line-height:1.6;margin:0 0 25px 0;}' +
    '.btn{display:inline-block;padding:11px 26px;background:#661003;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;box-shadow:0 2px 5px rgba(0,0,0,0.15);}' +
    '</style></head><body>' +
    '<div class="card">' +
    '<div class="icon">' + icon + '</div>' +
    '<h2>' + title + '</h2>' +
    '<p>' + message + '</p>' +
    '<a href="' + webAppUrl + '#dashboard" class="btn">📊 ไปที่หน้าแดชบอร์ด</a>' +
    '</div></body></html>';
  return HtmlService.createHtmlOutput(html).setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getCurrentUserEmail() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email ? String(email).trim().toLowerCase() : '';
  } catch (err) {
    return '';
  }
}

/** Security helpers: every user-facing write/API action must use the session account. */
function requireAuthenticatedUser() {
  var email = getCurrentUserEmail();
  if (!email) throw new Error('กรุณาเข้าสู่ระบบด้วย Google Account ของหน่วยงานก่อนใช้งาน');
  return email;
}

function requireRole(requiredRole) {
  var email = requireAuthenticatedUser();
  if (!verifyUserRole(email, requiredRole)) {
    writeLog('SecurityAlert', 'AuthorizationDenied', 'Security', email, 'Required role: ' + requiredRole, 'Fail');
    throw new Error('บัญชี Google นี้ไม่มีสิทธิ์ดำเนินการดังกล่าว');
  }
  return email;
}

function getHeaderMap(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var name = String(headers[i] || '').trim();
    if (name) map[name] = i + 1;
  }
  return map;
}

function maskToken(token) {
  var value = String(token || '');
  return value.length > 8 ? value.substring(0, 4) + '...' + value.substring(value.length - 4) : '****';
}

function generateToken() {
  // UUIDs are generated by Apps Script's cryptographic random source.
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '').substring(0, 64);
}

function getTokenMetaColumns(stage) {
  return {
    usedAt: 'Stage' + stage + '_TokenUsedAt',
    failedAttempts: 'Stage' + stage + '_TokenFailedAttempts',
    lastFailedAt: 'Stage' + stage + '_TokenLastFailedAt'
  };
}

function recordTokenFailure(sheet, rowIndex, stage, reason) {
  var map = getHeaderMap(sheet);
  var meta = getTokenMetaColumns(stage);
  var countCol = map[meta.failedAttempts];
  if (countCol) {
    var current = Number(sheet.getRange(rowIndex, countCol).getValue()) || 0;
    sheet.getRange(rowIndex, countCol).setValue(current + 1);
  }
  if (map[meta.lastFailedAt]) sheet.getRange(rowIndex, map[meta.lastFailedAt]).setValue(new Date());
  writeLog('SecurityAlert', 'verifyToken', 'Requests', sheet.getRange(rowIndex, map.RequestID).getValue(), reason + ' token attempt recorded', 'Fail');
}

function assertNoDuplicateRequest(data, userEmail) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Requests');
  if (!sheet || sheet.getLastRow() < 2) return;
  var map = getHeaderMap(sheet);
  var rows = sheet.getDataRange().getValues();
  var start = new Date(data.startDate).getTime();
  var end = new Date(data.endDate || data.startDate).getTime();
  if (isNaN(start) || isNaN(end)) throw new Error('วันที่เริ่มต้นหรือสิ้นสุดไม่ถูกต้อง');
  var targetRoom = String(data.roomId).trim();
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var status = String(row[map.OverallStatus - 1] || '').trim();
    if (['Rejected', 'Expired'].indexOf(status) !== -1) continue;
    var sameUser = String(row[map.ApplicantEmail - 1] || '').trim().toLowerCase() === userEmail;
    var sameRoom = String(row[map.RoomID - 1] || '').trim() === targetRoom;
    var activeStatuses = ['Approved', 'Active', 'Pending', 'InReview'];
    if (sameUser && activeStatuses.indexOf(status) !== -1) {
      throw new Error('ผู้ใช้นี้มีคำขอที่ยังรอดำเนินการหรือยังใช้งานอยู่แล้ว');
    }
    var rowStart = new Date(row[map.StartDate - 1]).getTime();
    var rowEnd = new Date(row[map.EndDate - 1] || row[map.StartDate - 1]).getTime();
    if (isNaN(rowStart) || isNaN(rowEnd) || start > rowEnd || end < rowStart) continue;
    if (sameUser) throw new Error('ผู้ใช้นี้มีคำขอในช่วงวันที่ทับซ้อนกันอยู่แล้ว');
    if (sameRoom && activeStatuses.indexOf(status) !== -1) {
      throw new Error('ห้องปฏิบัติการนี้มีคำขอในช่วงวันที่ทับซ้อนกันอยู่แล้ว');
    }
  }
}

function assertAccessCodeAvailable(accessCode) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Users');
  if (!sheet || sheet.getLastRow() < 2) return;
  var map = getHeaderMap(sheet);
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (map.AccessCode && String(rows[i][map.AccessCode - 1] || '') === String(accessCode)) {
      var status = String(rows[i][map.Status - 1] || '').trim();
      if (status === 'Active') throw new Error('Access Code ซ้ำกับผู้ใช้ที่ยังใช้งานอยู่ กรุณาลองใหม่');
    }
  }
}

/**
 * เพิ่มเมนูใน Google Sheets สำหรับตั้งค่าการแจ้งเตือนวันหยุด/ปิดห้อง
 */
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('📢 ห้องปิด/วันหยุด')
      .addItem('ติดตั้งการแจ้งเตือนอีเมลอัตโนมัติ', 'setupRoomClosureEmailTrigger')
      .addItem('ส่งอีเมลรายการที่ยังไม่ได้ส่ง', 'sendPendingRoomClosureNotifications')
      .addToUi();
  } catch (e) {}
}

// ==============================================================================
// AGENT 1: Database Initialization, Settings, Running Numbers, AccessCode Logic
// ==============================================================================

function initDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('ไม่พบ Active Spreadsheet กรุณาผูก Script กับ Google Sheets หรือเปิดใช้งานในชีต');
  }

  // หมายเหตุความปลอดภัย: ห้าม hardcode ORG_API_KEY ในซอร์สโค้ด
  // กรุณาตั้งค่าด้วยตนเองผ่าน Apps Script Editor > Project Settings > Script Properties
  // หรือเรียกใช้ PropertiesService.getScriptProperties().setProperty('ORG_API_KEY', '<คีย์ของคุณ>');

  var schema = {
    'Users': [
      'UserID', 'FullName', 'Age', 'PersonType', 'StaffType', 'StudentID',
      'Phone', 'Email', 'Department', 'Faculty', 'Division', 'DegreeLevel',
      'ExternalOrg', 'ProjectTopic', 'Justification', 'AccessCode', 'PhotoURL', 'Status',
      'CreatedAt', 'ConsentDate'
    ],
    'Advisor': [
      'AdvisorID', 'FullName', 'Email', 'Division', 'Phone', 'Status'
    ],
    'DivisionStaff': [
      'StaffID', 'FullName', 'Email', 'Department', 'Division', 'Phone', 'Status'
    ],
    'LabHead': [
      'LabHeadID', 'FullName', 'Email', 'Department', 'ResponsibleRoomIDs', 'Phone', 'Status'
    ],
    'Admin': [
      'AdminID', 'FullName', 'Email', 'Phone', 'ResponsibleBuilding',
      'ResponsibleRoomIDs', 'Status'
    ],
    'Rooms': [
      'RoomID', 'RoomName', 'Building', 'Floor', 'Capacity', 'Facilities',
      'LabHeadEmail', 'ApproverEmail', 'ImageURL', 'Status'
    ],
    'Requests': [
      'RequestID', 'Timestamp', 'ApplicantID', 'ApplicantName', 'ApplicantEmail',
      'ApplicantType', 'SubmittedByRole', 'Department', 'Phone', 'RoomID',
      'RoomName', 'Purpose', 'StartDate', 'EndDate', 'AllowedTimeStart',
      'AllowedTimeEnd', 'ParticipantNames', 'EmergencyContact',
      // Stage 1: Advisor / Head of Civil Eng
      'Stage1_ApproverEmail', 'Stage1_Status', 'Stage1_Date', 'Stage1_Note', 'Stage1_Token', 'Stage1_ReminderSentAt',
      // Stage 2: Division Staff
      'Stage2_ApproverEmail', 'Stage2_Status', 'Stage2_Date', 'Stage2_Note', 'Stage2_Token', 'Stage2_ReminderSentAt',
      // Stage 3: Lab Head
      'Stage3_ApproverEmail', 'Stage3_Status', 'Stage3_Date', 'Stage3_Note', 'Stage3_Token', 'Stage3_ReminderSentAt',
      // Stage 4: Admin (Building Head)
      'Stage4_ApproverEmail', 'Stage4_Status', 'Stage4_Date', 'Stage4_Note', 'Stage4_Token', 'Stage4_ReminderSentAt',
      // Post-Approval & Flow Control
      'BiometricAppointmentDate', 'BiometricStatus', 'CurrentStage', 'OverallStatus',
      'SignatureData', 'PhotoURL', 'RequestToken',
      // Token security metadata (added at the end for backward compatibility)
      'Stage1_TokenUsedAt', 'Stage1_TokenFailedAttempts', 'Stage1_TokenLastFailedAt',
      'Stage2_TokenUsedAt', 'Stage2_TokenFailedAttempts', 'Stage2_TokenLastFailedAt',
      'Stage3_TokenUsedAt', 'Stage3_TokenFailedAttempts', 'Stage3_TokenLastFailedAt',
      'Stage4_TokenUsedAt', 'Stage4_TokenFailedAttempts', 'Stage4_TokenLastFailedAt'
    ],
    'RoomClosures': [
      'ClosureID', 'Title', 'Description', 'StartDate', 'EndDate',
      'AffectedRoomIDs', 'CreatedBy', 'CreatedAt', 'Status', 'NotifiedAt'
    ],
    'Settings': [
      'ConfigKey', 'ConfigValue', 'Description', 'DataType'
    ],
    'Logs': [
      'LogID', 'Timestamp', 'UserEmail', 'ActionType', 'Action',
      'TargetSheet', 'TargetRecordID', 'Details', 'Result'
    ]
  };

  var oldStaffSheet = ss.getSheetByName('DepartmentStaff') || ss.getSheetByName('HeadOfDivision');
  if (oldStaffSheet && !ss.getSheetByName('DivisionStaff')) {
    oldStaffSheet.setName('DivisionStaff');
  }

  for (var sheetName in schema) {
    var sheet = ss.getSheetByName(sheetName);
    var expectedHeaders = schema[sheetName];

    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      sheet.appendRow(expectedHeaders);
      sheet.getRange(1, 1, 1, expectedHeaders.length).setFontWeight('bold').setBackground('#F3F4F6');
      sheet.setFrozenRows(1);
    } else {
      var lastCol = sheet.getLastColumn();
      var currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
      var missingHeaders = [];

      for (var i = 0; i < expectedHeaders.length; i++) {
        if (currentHeaders.indexOf(expectedHeaders[i]) === -1) {
          missingHeaders.push(expectedHeaders[i]);
        }
      }

      if (missingHeaders.length > 0) {
        var startCol = lastCol + 1;
        sheet.getRange(1, startCol, 1, missingHeaders.length).setValues([missingHeaders]).setFontWeight('bold');
      }
    }
  }

  // Settings defaults
  var defaultSettings = [
    ['SYSTEM_NAME', 'ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน', 'ชื่อระบบ', 'String'],
    ['HEAD_OF_CIVIL_ENG_EMAIL', 'lareew@kku.ac.th', 'อีเมลหัวหน้าสาขาวิชาวิศวกรรมโยธา', 'String'],
    ['ADMIN_EMAIL', 'pacnim@kku.ac.th', 'อีเมลผู้ดูแลระบบ/หัวหน้าตึก', 'String'],
    ['SMTP_SENDER_NAME', 'ระบบ CE F.A.I.R.', 'ชื่อผู้ส่งอีเมล', 'String'],
    ['ACCESS_DURATION_MONTHS', '3', 'ระยะเวลาเข้าใช้งาน (เดือน)', 'Number'],
    ['TIMEZONE', 'Asia/Bangkok', 'โซนเวลา', 'String'],
    ['MAINTENANCE_MODE', 'FALSE', 'โหมดปิดปรับปรุง', 'Boolean'],
    ['REQUEST_ID_PREFIX', 'REQ-', 'คำนำหน้าเลขคำขอ', 'String'],
    ['TOKEN_EXPIRY_DAYS', '7', 'อายุ Token อนุมัติ (วัน)', 'Number'],
    ['APPROVAL_REMINDER_DAYS', '3', 'วันก่อนส่งเตือนซ้ำ', 'Number'],
    ['DATA_RETENTION_MONTHS', '12', 'ระยะเวลาเก็บรักษาข้อมูลก่อนลบ (เดือน)', 'Number'],
    ['ORG_API_KEY', '', 'API Key สำหรับ ORG AI (gen.ai.kku.ac.th) — ตั้งค่าผ่าน Script Properties เท่านั้น ห้ามใส่คีย์ในชีตนี้', 'String'],
    ['LAST_ACCESS_CODE_SEQ', '0500', 'Running Sequence สำหรับสร้าง Access Code (เริ่มต้นที่ 0500)', 'Number'],
    ['LAST_REQUEST_ID', '0', 'Running Number คำขอ', 'Number'],
    ['LAST_USER_ID', '0', 'Running Number ผู้ใช้', 'Number']
  ];

  var settingsSheet = ss.getSheetByName('Settings');
  var settingsData = settingsSheet.getDataRange().getValues();
  var existingKeys = {};
  for (var r = 1; r < settingsData.length; r++) {
    existingKeys[settingsData[r][0]] = true;
  }

  for (var s = 0; s < defaultSettings.length; s++) {
    var key = defaultSettings[s][0];
    if (!existingKeys[key]) {
      settingsSheet.appendRow(defaultSettings[s]);
    }
  }

  // ติดตั้ง Trigger แจ้งเตือนอีเมลวันหยุด (RoomClosures) อัตโนมัติ
  try {
    setupRoomClosureEmailTrigger();
  } catch (triggerErr) {
    writeLog('Warning', 'initDatabase', 'Settings', 'SYSTEM', 'ไม่สามารถติดตั้ง Trigger อัตโนมัติ: ' + triggerErr.toString(), 'Fail');
  }

  writeLog('AdminAction', 'initDatabase', 'Settings', 'SYSTEM', 'Database initialized successfully', 'Success');
  return { success: true, message: 'Database initialized successfully' };
}

function getSetting(key, defaultValue) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return defaultValue;

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        var val = data[i][1];
        var type = data[i][3];
        if (type === 'Number') return Number(val);
        if (type === 'Boolean') return String(val).toUpperCase() === 'TRUE';
        return String(val);
      }
    }
    return defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

function updateSetting(key, value) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Settings');
    if (!sheet) return false;

    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] === key) {
        sheet.getRange(i + 1, 2).setValue(String(value));
        return true;
      }
    }
    sheet.appendRow([key, String(value), '', 'String']);
    return true;
  } catch (err) {
    return false;
  }
}

function generateRequestId() {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(30000);
    if (!lock.hasLock()) throw new Error('ระบบกำลังประมวลผล กรุณาลองใหม่');

    var currentSeq = getSetting('LAST_REQUEST_ID', 0);
    var nextSeq = Number(currentSeq) + 1;
    updateSetting('LAST_REQUEST_ID', nextSeq);

    var prefix = getSetting('REQUEST_ID_PREFIX', 'REQ-');
    var padded = ('00000' + nextSeq).slice(-5);
    return prefix + padded;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function generateUserId() {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(30000);
    if (!lock.hasLock()) throw new Error('ระบบกำลังประมวลผล กรุณาลองใหม่');

    var currentSeq = getSetting('LAST_USER_ID', 0);
    var nextSeq = Number(currentSeq) + 1;
    updateSetting('LAST_USER_ID', nextSeq);

    var padded = ('00000' + nextSeq).slice(-5);
    return 'USR-' + padded;
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function generateAccessCode(personType, staffType, department, division, degreeLevel) {
  var pType = String(personType || '').trim();
  var sType = String(staffType || '').trim();
  var dLevel = String(degreeLevel || '').trim();
  var div = Number(division) || 0;

  var digitHundredThousand = 0;
  if (pType === 'Staff') {
    digitHundredThousand = (sType === 'Academic') ? 1 : 2;
  } else if (pType === 'Student') {
    if (dLevel === 'Bachelor') digitHundredThousand = 3;
    else if (dLevel === 'Master') digitHundredThousand = 4;
    else if (dLevel === 'Doctoral') digitHundredThousand = 5;
    else digitHundredThousand = 3;
  } else {
    digitHundredThousand = 6;
  }

  var digitTenThousand = 0;
  if (pType === 'Staff') {
    digitTenThousand = (sType === 'Academic') ? 1 : 2;
  } else if (pType === 'Student') {
    digitTenThousand = (div >= 1 && div <= 7) ? div : 0;
  } else {
    digitTenThousand = 0;
  }

  var lock = LockService.getScriptLock();
  var runningStr = '0501';
  try {
    lock.tryLock(30000);
    if (!lock.hasLock()) throw new Error('ระบบกำลังประมวลผล กรุณาลองใหม่อีกครั้ง');

    var currentSeq = Number(getSetting('LAST_ACCESS_CODE_SEQ', 500));
    if (isNaN(currentSeq) || currentSeq < 500) {
      currentSeq = 500;
    }
    var nextSeq = currentSeq + 1;
    if (nextSeq > 9999) {
      nextSeq = 501;
    }

    updateSetting('LAST_ACCESS_CODE_SEQ', nextSeq);
    runningStr = ('0000' + nextSeq).slice(-4);
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }

  return '' + digitHundredThousand + digitTenThousand + runningStr;
}

// ==============================================================================
// 🤖 ORG AI SUMMARY & RECOMMENDATION ENGINE
// ==============================================================================

function generateAISummary(data) {
  try {
    var apiKey = getOrgApiKey();
    if (!apiKey) {
      return generateRuleBasedSummary(data);
    }

    var selectedModel = getBestModel();

    var systemPrompt = "คุณคือผู้ช่วย AI ช่วยวิเคราะห์ย่อคำขอเข้าใช้ห้องฯ เพื่อให้ผู้อนุมัติ (อาจารย์ที่ปรึกษา / เจ้าหน้าที่ประจำแผนก / หัวหน้าห้องแล็บ / หัวหน้าตึก) ใช้ประกอบการพิจารณาอนุมัติอย่างรอบคอบและรวดเร็ว";
    var userPrompt = "ข้อมูลคำขอ:\n" +
      "- ผู้ขอ: " + (data.fullName || '-') + " (ประเภท: " + (data.personType || '-') + " ระดับ " + (data.degreeLevel || '-') + " สาขา: " + (data.department || '-') + " คณะ: " + (data.faculty || '-') + " แผนก: " + (data.division || '-') + ")\n" +
      "- ห้องที่ขอ: " + (data.roomName || data.roomId || '-') + "\n" +
      "- วันที่ขอใช้งาน: " + (data.startDate || '-') + " ถึง " + (data.endDate || '-') + "\n" +
      "- เวลาขอใช้งาน: " + (data.allowedTimeStart || '-') + " ถึง " + (data.allowedTimeEnd || '-') + "\n" +
      "- วันที่และเวลานัดหมายบันทึก Biometric: " + (data.biometricAppointmentDate || 'ไม่ระบุ') + "\n" +
      "- หัวข้อโครงงาน/วิจัย: " + (data.projectTopic || 'ไม่ระบุ') + "\n" +
      "- วัตถุประสงค์: " + (data.purpose || 'ไม่ระบุ') + "\n" +
      "- เหตุผลความจำเป็น: " + (data.justification || 'ไม่ระบุ') + "\n" +
      "- ผู้ร่วมใช้งาน: " + (data.participantNames || 'ไม่มี') + "\n" +
      "- ผู้ติดต่อฉุกเฉิน: " + (data.emergencyContact || 'ไม่ระบุ') + "\n\n" +
      "กรุณาตอบเป็นภาษาไทยเฉพาะข้อเสนอแนะ ความเห็น ข้อพึงระวัง เพื่อประกอบการพิจารณา กระชับ ชัดเจน (ไม่เกิน 4-5 บรรทัด):\n";

    var payload = {
      model: selectedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 350
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + apiKey
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch(ORG_API_URL, options);
    var json = JSON.parse(response.getContentText());

    if (json && json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) {
      var summaryText = json.choices[0].message.content.trim();
      return summaryText + '\n<small style="color:#64748b;display:block;margin-top:6px;">(วิเคราะห์โดย โมเดล: ' + selectedModel + ')</small>';
    } else {
      return generateRuleBasedSummary(data);
    }
  } catch (err) {
    writeLog('Error', 'generateAISummary', 'OrgAI_API', '', err.toString(), 'Fail');
    return generateRuleBasedSummary(data);
  }
}

function generateRuleBasedSummary(data) {
  var topic = data.projectTopic ? 'โครงงาน "' + data.projectTopic + '"' : 'การปฏิบัติงานตามวัตถุประสงค์';
  var timeNotice = (data.allowedTimeEnd && data.allowedTimeEnd > '20:00') ? '⚠️ มีการใช้งานหลัง 20:00 น. ควรเน้นย้ำความปลอดภัยในการปิดห้อง' : '✅ ช่วงเวลาใช้งานอยู่ในเกณฑ์ปกติ';
  var bioNotice = data.biometricAppointmentDate ? '📅 ขอนัดหมายบันทึก Biometric: ' + data.biometricAppointmentDate : '⚠️ ยังไม่ได้ระบุวันนัดหมาย Biometric';

  return "🎯 <b>สรุปเนื้องาน:</b> ขอเข้าใช้ห้อง " + (data.roomName || data.roomId) + " เพื่อ " + topic + " (" + (data.purpose || 'ไม่มีรายละเอียด') + ")\n" +
    "⚠️ <b>ข้อสังเกต:</b> " + timeNotice + " (เวลา " + (data.allowedTimeStart || '-') + " - " + (data.allowedTimeEnd || '-') + ") | " + bioNotice + "\n" +
    "💡 <b>ความเห็น AI:</b> ข้อมูลและวัตถุประสงค์ชัดเจน มีผู้ติดต่อฉุกเฉินครบถ้วน เหมาะสมแก่การพิจารณา";
}

// ==============================================================================
// AGENT 2: 4-Stage Sequential Approval, Role Determination & Special Stage 1 Logic
// ==============================================================================

function isCivilEngStudent(data) {
  if (!data) return false;
  var pType = String(data.personType || '').trim();
  if (pType !== 'Student') return false;

  var dept = String(data.department || '').trim().toLowerCase();
  var faculty = String(data.faculty || '').trim().toLowerCase();

  var isCivilDept = (dept.indexOf('โยธา') !== -1 || dept.indexOf('civil') !== -1);
  var isEngFaculty = (faculty === '' || faculty.indexOf('วิศว') !== -1 || faculty.indexOf('eng') !== -1);

  return isCivilDept && isEngFaculty;
}

function getHeadOfCivilEngEmail() {
  var email = getSetting('HEAD_OF_CIVIL_ENG_EMAIL', 'lareew@kku.ac.th');
  if (email && email.trim()) return email.trim();
  return 'lareew@kku.ac.th';
}

function determineSubmitterRole(email) {
  if (!email) return 'Applicant';
  var cleanEmail = String(email).trim().toLowerCase();
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Admin
  var adminSheet = ss.getSheetByName('Admin');
  if (adminSheet) {
    var adminData = adminSheet.getDataRange().getValues();
    for (var i = 1; i < adminData.length; i++) {
      if (String(adminData[i][2]).trim().toLowerCase() === cleanEmail && String(adminData[i][6]).trim() === 'Active') {
        return 'Admin';
      }
    }
  }
  if (cleanEmail === String(getSetting('ADMIN_EMAIL', 'pacnim@kku.ac.th')).trim().toLowerCase()) {
    return 'Admin';
  }

  // 2. LabHead
  var labSheet = ss.getSheetByName('LabHead');
  if (labSheet) {
    var labData = labSheet.getDataRange().getValues();
    for (var l = 1; l < labData.length; l++) {
      if (String(labData[l][2]).trim().toLowerCase() === cleanEmail && String(labData[l][6]).trim() === 'Active') {
        return 'LabHead';
      }
    }
  }

  // 3. DivisionStaff
  var staffSheet = ss.getSheetByName('DivisionStaff') || ss.getSheetByName('DepartmentStaff') || ss.getSheetByName('HeadOfDivision');
  if (staffSheet) {
    var staffData = staffSheet.getDataRange().getValues();
    for (var j = 1; j < staffData.length; j++) {
      if (String(staffData[j][2]).trim().toLowerCase() === cleanEmail && String(staffData[j][6] || staffData[j][5]).trim() === 'Active') {
        return 'DivisionStaff';
      }
    }
  }

  // 4. Advisor
  if (cleanEmail === String(getHeadOfCivilEngEmail()).trim().toLowerCase()) {
    return 'Advisor';
  }
  var advSheet = ss.getSheetByName('Advisor');
  if (advSheet) {
    var advData = advSheet.getDataRange().getValues();
    for (var k = 1; k < advData.length; k++) {
      if (String(advData[k][2]).trim().toLowerCase() === cleanEmail && String(advData[k][5]).trim() === 'Active') {
        return 'Advisor';
      }
    }
  }

  return 'Applicant';
}


function findStaffForDivision(department, division) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('DivisionStaff') || ss.getSheetByName('DepartmentStaff') || ss.getSheetByName('HeadOfDivision');
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    if (division) {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][4]).trim() === String(division).trim() && String(data[i][6] || data[i][5]).trim() === 'Active') {
          return data[i][2];
        }
      }
    }
    for (var j = 1; j < data.length; j++) {
      if (String(data[j][3]).trim().toLowerCase() === String(department).trim().toLowerCase() && String(data[j][6] || data[j][5]).trim() === 'Active') {
        return data[j][2];
      }
    }
  }
  return '';
}

function findLabHeadForRoom(roomId) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var roomSheet = ss.getSheetByName('Rooms');
  if (roomSheet) {
    var rData = roomSheet.getDataRange().getValues();
    for (var r = 1; r < rData.length; r++) {
      if (String(rData[r][0]).trim() === String(roomId).trim()) {
        var labEmail = String(rData[r][6] || '').trim();
        if (labEmail) return labEmail;
      }
    }
  }

  var labSheet = ss.getSheetByName('LabHead');
  if (labSheet) {
    var lData = labSheet.getDataRange().getValues();
    for (var l = 1; l < lData.length; l++) {
      if (String(lData[l][6]).trim() === 'Active') {
        var rooms = String(lData[l][4] || '');
        if (rooms === 'ALL' || rooms.split(',').map(function(s){ return s.trim(); }).indexOf(String(roomId)) !== -1) {
          return lData[l][2];
        }
      }
    }
  }
  return '';
}

function findAdminForRoomOrBuilding(roomId, building) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Admin');
  if (sheet) {
    var data = sheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][6]).trim() === 'Active') {
        var rooms = String(data[i][5] || '');
        var bldg = String(data[i][4] || '');
        if (rooms === 'ALL' || rooms.split(',').map(function(s){ return s.trim(); }).indexOf(String(roomId)) !== -1 || (building && bldg === building)) {
          return data[i][2];
        }
      }
    }
  }
  return getSetting('ADMIN_EMAIL', 'pacnim@kku.ac.th');
}

/**
 * บันทึกรูปถ่ายลง Google Drive โฟลเดอร์ RoomAccess_Applicant_Photos
 * Security: validate real MIME type, limit size, random filename, restricted sharing.
 */
function saveApplicantPhoto(base64Data, applicantName, requestId) {
  if (!base64Data) return '';
  try {
    var folderName = 'RoomAccess_Applicant_Photos';
    var folders = DriveApp.getFoldersByName(folderName);
    var folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

    var contentType = 'image/jpeg';
    var cleanBase64 = base64Data;
    if (base64Data.indexOf(';base64,') !== -1) {
      var parts = base64Data.split(';base64,');
      contentType = String(parts[0]).replace('data:', '').trim().toLowerCase();
      cleanBase64 = parts[1];
    }

    // 1. ตรวจ MIME type จริงจาก data URI (อนุญาตเฉพาะรูปภาพ)
    var allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.indexOf(contentType) === -1) {
      writeLog('SecurityAlert', 'saveApplicantPhoto', 'Drive', requestId || '', 'Rejected MIME type: ' + contentType, 'Fail');
      throw new Error('ประเภทไฟล์รูปไม่ถูกต้อง (รองรับเฉพาะ JPEG/PNG/WebP)');
    }

    // 2. จำกัดขนาดรูปฝั่ง Backend (ไม่เกิน 5 MB หลัง decode)
    var decoded = Utilities.base64Decode(cleanBase64);
    var maxBytes = 5 * 1024 * 1024;
    if (decoded.length > maxBytes) {
      writeLog('SecurityAlert', 'saveApplicantPhoto', 'Drive', requestId || '', 'Photo too large: ' + decoded.length + ' bytes', 'Fail');
      throw new Error('ขนาดรูปเกิน 5 MB กรุณาลดขนาดไฟล์แล้วลองใหม่');
    }

    // 3. ตั้งชื่อไฟล์แบบสุ่ม ไม่เปิดเผยข้อมูลผู้ขอในชื่อไฟล์
    var extMap = { 'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
    var randomName = 'IMG_' + Utilities.getUuid().replace(/-/g, '') + (extMap[contentType] || '.jpg');
    var blob = Utilities.newBlob(decoded, contentType, randomName);
    var file = folder.createFile(blob);

    // 4. จำกัดสิทธิ์ไฟล์: เฉพาะบัญชีที่รัน Apps Script เข้าถึงได้ (ไม่เปิด Public Link)
    return file.getUrl();
  } catch (err) {
    writeLog('Error', 'saveApplicantPhoto', 'Drive', requestId || '', err.toString(), 'Fail');
    throw err;
  }
}

/**
 * Data Retention: ลบไฟล์รูปของคำขอที่ Expired/Rejected เกิน DATA_RETENTION_MONTHS
 * และเคลียร์ค่า PhotoURL ออกจากชีต (เก็บเฉพาะข้อมูลจำเป็นของระบบ)
 */
function applyDataRetentionPolicy() {
  try {
    var months = Number(getSetting('DATA_RETENTION_MONTHS', 12));
    var cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Requests');
    if (!sheet || sheet.getLastRow() < 2) return { success: true, purged: 0 };
    var map = getHeaderMap(sheet);
    var rows = sheet.getDataRange().getValues();
    var purged = 0;

    for (var i = 1; i < rows.length; i++) {
      var status = String(rows[i][map.OverallStatus - 1] || '').trim();
      var ts = rows[i][map.Timestamp - 1];
      var photoUrl = String(rows[i][map.PhotoURL - 1] || '');
      if (['Expired', 'Rejected'].indexOf(status) === -1) continue;
      if (!(ts instanceof Date) || ts > cutoff || !photoUrl) continue;

      var m = photoUrl.match(/[-\w]{25,}/);
      if (m) {
        try {
          DriveApp.getFileById(m[0]).setTrashed(true);
          sheet.getRange(i + 1, map.PhotoURL).setValue('');
          purged++;
        } catch (fileErr) {
          writeLog('Warning', 'applyDataRetentionPolicy', 'Drive', rows[i][map.RequestID - 1], fileErr.toString(), 'Fail');
        }
      }
    }
    writeLog('AdminAction', 'applyDataRetentionPolicy', 'Requests', 'SYSTEM', 'Purged ' + purged + ' photo(s) older than ' + months + ' months', 'Success');
    return { success: true, purged: purged };
  } catch (err) {
    writeLog('Error', 'applyDataRetentionPolicy', 'Requests', '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}

function submitRequest(data) {
  try {
    if (getSetting('MAINTENANCE_MODE', false)) {
      throw new Error('ระบบปิดปรับปรุงชั่วคราว ไม่สามารถส่งคำขอได้ในขณะนี้');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sessionEmail = requireAuthenticatedUser();
    var userEmail = String(data.email || '').trim().toLowerCase();
    if (!userEmail) userEmail = sessionEmail;
    if (userEmail !== sessionEmail) throw new Error('อีเมลผู้ยื่นคำขอต้องตรงกับ Google Account ที่เข้าสู่ระบบ');
    if (!data.fullName) throw new Error('กรุณาระบุชื่อ-นามสกุล');
    if (!data.phone) throw new Error('กรุณาระบุเบอร์โทรศัพท์');
    if (!data.photoData) throw new Error('กรุณาอัปโหลดรูปถ่ายผู้ยื่นคำขอ');
    if (!data.roomId) throw new Error('กรุณาเลือกห้องปฏิบัติการ');
    if (!data.startDate) throw new Error('กรุณาระบุวันที่เริ่มต้นใช้งาน');
    if (!data.biometricAppointmentDate) throw new Error('กรุณาระบุวันที่และเวลาที่ขอเข้ารับการบันทึก Biometric');
    if (!data.emergencyContact) throw new Error('กรุณาระบุชื่อ และเบอร์โทร. ผู้ติดต่อ กรณีฉุกเฉิน');

    var duplicateEndDate = data.endDate ? new Date(data.endDate) : new Date(data.startDate);
    if (!data.endDate) duplicateEndDate.setMonth(duplicateEndDate.getMonth() + Number(getSetting('ACCESS_DURATION_MONTHS', 3)));
    assertNoDuplicateRequest({ roomId: data.roomId, startDate: data.startDate, endDate: duplicateEndDate }, userEmail);

    var submittedByRole = determineSubmitterRole(userEmail);
    var requestId = generateRequestId();
    var accessCode = generateAccessCode(data.personType, data.staffType, data.department, data.division, data.degreeLevel);
    assertAccessCodeAvailable(accessCode);
    var photoUrl = saveApplicantPhoto(data.photoData, data.fullName, requestId);

    var usersSheet = ss.getSheetByName('Users');
    var usersData = usersSheet.getDataRange().getValues();
    var existingUserRow = -1;
    var userId = '';

    for (var u = 1; u < usersData.length; u++) {
      if (String(usersData[u][7]).trim().toLowerCase() === userEmail) {
        existingUserRow = u + 1;
        userId = usersData[u][0];
        break;
      }
    }

    var now = new Date();
    if (existingUserRow === -1) {
      userId = generateUserId();
      var newUserRow = [
        userId, data.fullName, data.age || '', data.personType, data.staffType || '',
        data.studentId || '', data.phone, userEmail, data.department || '',
        data.faculty || 'วิศวกรรมศาสตร์', data.division || '', data.degreeLevel || '',
        data.externalOrg || '', data.projectTopic || '', data.justification || '',
        accessCode, photoUrl, 'Active', now, now
      ];
      usersSheet.appendRow(newUserRow);
    } else {
      usersSheet.getRange(existingUserRow, 2).setValue(data.fullName);
      usersSheet.getRange(existingUserRow, 7).setValue(data.phone);
      usersSheet.getRange(existingUserRow, 9).setValue(data.department || '');
      usersSheet.getRange(existingUserRow, 11).setValue(data.division || '');
      usersSheet.getRange(existingUserRow, 16).setValue(accessCode);
      if (photoUrl) usersSheet.getRange(existingUserRow, 17).setValue(photoUrl);
    }

    var durationMonths = Number(getSetting('ACCESS_DURATION_MONTHS', 3));
    var startDate = new Date(data.startDate);
    var endDate = new Date(startDate.getTime());
    endDate.setMonth(endDate.getMonth() + durationMonths);

    var roomsSheet = ss.getSheetByName('Rooms');
    var roomsData = roomsSheet.getDataRange().getValues();
    var roomName = data.roomId;
    var roomBuilding = '';
    for (var r = 1; r < roomsData.length; r++) {
      if (String(roomsData[r][0]) === String(data.roomId)) {
        roomName = roomsData[r][1];
        roomBuilding = roomsData[r][2];
        break;
      }
    }
    data.roomName = roomName;

    var requestToken = generateToken();

    var s1_email = '', s1_status = '', s1_date = '', s1_token = '';
    var s2_email = '', s2_status = '', s2_date = '', s2_token = '';
    var s3_email = '', s3_status = '', s3_date = '', s3_token = '';
    var s4_email = '', s4_status = '', s4_date = '', s4_token = '';
    var bioDate = data.biometricAppointmentDate ? new Date(data.biometricAppointmentDate) : '';
    var bioStatus = 'Requested';
    var currentStage = 1;
    var overallStatus = 'InReview';
    var stage1Title = 'อาจารย์ที่ปรึกษา';

    if (submittedByRole === 'Admin' || submittedByRole === 'LabHead' || submittedByRole === 'DivisionStaff' || submittedByRole === 'Advisor') {
      s1_status = 'Skipped'; s1_date = now;
      writeLog('AdminAction', 'SkipStage', 'Requests', requestId, 'Stage 1 Skipped automatically for submitter role ' + submittedByRole, 'Success');
    } else {
      if (isCivilEngStudent(data)) {
        stage1Title = 'อาจารย์ที่ปรึกษา';
        s1_email = data.advisorEmail || '';
        if (!s1_email) {
          s1_status = 'Skipped'; s1_date = now;
        } else {
          s1_status = 'Pending'; s1_token = generateToken(); s1_date = now;
        }
      } else {
        stage1Title = 'หัวหน้าสาขาวิชาวิศวกรรมโยธา';
        s1_email = getHeadOfCivilEngEmail();
        s1_status = 'Pending'; s1_token = generateToken(); s1_date = now;
      }
    }

    // Stage 2: Division Staff
    if (submittedByRole === 'Admin' || submittedByRole === 'LabHead' || submittedByRole === 'DivisionStaff') {
      s2_status = 'Skipped'; s2_date = now;
      writeLog('AdminAction', 'SkipStage', 'Requests', requestId, 'Stage 2 Skipped automatically for submitter role ' + submittedByRole, 'Success');
    } else {
      s2_email = findStaffForDivision(data.department, data.division);
      if (!s2_email) {
        s2_status = 'Skipped'; s2_date = now;
      } else if (s1_status === 'Skipped') {
        s2_status = 'Pending'; s2_token = generateToken(); s2_date = now;
      }
    }

    // Stage 3: Lab Head
    if (submittedByRole === 'Admin' || submittedByRole === 'LabHead') {
      s3_status = 'Skipped'; s3_date = now;
      writeLog('AdminAction', 'SkipStage', 'Requests', requestId, 'Stage 3 Skipped automatically for submitter role ' + submittedByRole, 'Success');
    } else {
      s3_email = findLabHeadForRoom(data.roomId);
      if (!s3_email) {
        s3_status = 'Skipped'; s3_date = now;
      } else if (s1_status === 'Skipped' && s2_status === 'Skipped') {
        s3_status = 'Pending'; s3_token = generateToken(); s3_date = now;
      }
    }

    // Stage 4: Building Head / Admin
    if (submittedByRole === 'Admin') {
      s4_status = 'Approved'; s4_date = now;
      overallStatus = 'Approved';
      currentStage = 4;
      bioDate = data.biometricAppointmentDate ? new Date(data.biometricAppointmentDate) : now;
      bioStatus = 'Scheduled';
      writeLog('AdminAction', 'AutoApproveAdminSubmit', 'Requests', requestId, 'Admin submitted: Auto-approved all stages, Biometric Scheduled', 'Success');
    } else {
      s4_email = findAdminForRoomOrBuilding(data.roomId, roomBuilding);
      if (s1_status === 'Skipped' && s2_status === 'Skipped' && s3_status === 'Skipped') {
        s4_status = 'Pending'; s4_token = generateToken(); s4_date = now;
        currentStage = 4;
      } else if (s1_status === 'Skipped' && s2_status === 'Skipped') {
        currentStage = 3;
      } else if (s1_status === 'Skipped') {
        currentStage = 2;
      } else {
        currentStage = 1;
      }
    }

    var requestsSheet = ss.getSheetByName('Requests');
    var requestRow = [
      requestId, now, userId, data.fullName, userEmail, data.personType,
      submittedByRole, data.department || '', data.phone, data.roomId,
      roomName, data.purpose || '', startDate, endDate, data.allowedTimeStart,
      data.allowedTimeEnd, data.participantNames || '', data.emergencyContact || '',
      s1_email, s1_status, s1_date, '', s1_token, '',
      s2_email, s2_status, s2_date, '', s2_token, '',
      s3_email, s3_status, s3_date, '', s3_token, '',
      s4_email, s4_status, s4_date, '', s4_token, '',
      bioDate, bioStatus, currentStage, overallStatus,
      data.signatureData || '', photoUrl, requestToken
    ];
    requestsSheet.appendRow(requestRow);

    var aiSummaryText = generateAISummary(data);

    // Email to Applicant
    sendNotification('submit_confirmation', {
      to: userEmail,
      requestId: requestId,
      applicantName: data.fullName,
      roomName: roomName,
      requestToken: requestToken,
      accessCode: accessCode,
      overallStatus: overallStatus,
      startDate: Utilities.formatDate(startDate, 'Asia/Bangkok', 'dd/MM/yyyy'),
      endDate: Utilities.formatDate(endDate, 'Asia/Bangkok', 'dd/MM/yyyy'),
      allowedTimeStart: data.allowedTimeStart,
      allowedTimeEnd: data.allowedTimeEnd,
      biometricAppointmentDate: data.biometricAppointmentDate,
      aiSummary: aiSummaryText
    });

    // Email to Current Approver
    if (overallStatus !== 'Approved') {
      var currentApproverEmail = '', currentToken = '', currentStageTitle = '';
      if (currentStage === 1 && s1_email && s1_token) {
        currentApproverEmail = s1_email; currentToken = s1_token; currentStageTitle = stage1Title;
      } else if (currentStage === 2 && s2_email && s2_token) {
        currentApproverEmail = s2_email; currentToken = s2_token; currentStageTitle = 'เจ้าหน้าที่ประจำแผนก (Division Staff)';
      } else if (currentStage === 3 && s3_email && s3_token) {
        currentApproverEmail = s3_email; currentToken = s3_token; currentStageTitle = 'หัวหน้าห้องปฏิบัติการ (Lab Head)';
      } else if (currentStage === 4 && s4_email && s4_token) {
        currentApproverEmail = s4_email; currentToken = s4_token; currentStageTitle = 'หัวหน้าตึก/ผู้ดูแลระบบ (Building Admin)';
      }

      if (currentApproverEmail && currentToken) {
        sendNotification('approve_request', {
          to: currentApproverEmail,
          stage: currentStage,
          stageName: currentStageTitle,
          requestId: requestId,
          applicantName: data.fullName,
          studentId: data.studentId || '-',
          department: data.department || '-',
          phone: data.phone,
          roomName: roomName,
          startDate: Utilities.formatDate(startDate, 'Asia/Bangkok', 'dd/MM/yyyy'),
          endDate: Utilities.formatDate(endDate, 'Asia/Bangkok', 'dd/MM/yyyy'),
          allowedTimeStart: data.allowedTimeStart,
          allowedTimeEnd: data.allowedTimeEnd,
          biometricAppointmentDate: data.biometricAppointmentDate,
          purpose: data.purpose,
          token: currentToken,
          aiSummary: aiSummaryText,
          requestData: data
        });
      }
    }

    writeLog('DataChange', 'CreateRequest', 'Requests', requestId, 'Submitted by ' + submittedByRole + ' (Stage ' + currentStage + ') AccessCode: ' + accessCode, 'Success');

    return {
      success: true,
      requestId: requestId,
      requestToken: requestToken,
      accessCode: accessCode,
      overallStatus: overallStatus,
      currentStage: currentStage
    };
  } catch (err) {
    writeLog('Error', 'submitRequest', 'Requests', '', err.toString(), 'Fail');
    throw err;
  }
}

function routeToNextStage(requestId, currentCompletedStage) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Requests');
  var data = sheet.getDataRange().getValues();
  var rowIdx = -1;

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(requestId)) {
      rowIdx = i + 1;
      break;
    }
  }
  if (rowIdx === -1) return false;

  var row = data[rowIdx - 1];
  var department = row[7];
  var division = row[8] || '';
  var roomId = row[9];
  var applicantName = row[3];
  var roomName = row[10];
  var now = new Date();

  var nextStage = Number(currentCompletedStage) + 1;

  while (nextStage <= 4) {
    if (nextStage === 2) {
      var staffEmail = findStaffForDivision(department, division);
      if (staffEmail) {
        var token2 = generateToken();
        sheet.getRange(rowIdx, 25).setValue(staffEmail);
        sheet.getRange(rowIdx, 26).setValue('Pending');
        sheet.getRange(rowIdx, 27).setValue(now);
        sheet.getRange(rowIdx, 29).setValue(token2);
        sheet.getRange(rowIdx, 45).setValue(2);
        sendNotification('approve_request', {
          to: staffEmail,
          stage: 2,
          stageName: 'เจ้าหน้าที่ประจำแผนก (Division Staff)',
          requestId: requestId,
          applicantName: applicantName,
          studentId: row[5] || '-',
          department: department,
          phone: row[8],
          roomName: roomName,
          token: token2
        });
        writeLog('AutoRoute', 'RouteToDivisionStaff', 'Requests', requestId, 'Routed to ' + staffEmail, 'Success');
        return true;
      } else {
        sheet.getRange(rowIdx, 26).setValue('Skipped');
        sheet.getRange(rowIdx, 27).setValue(now);
        nextStage++;
      }
    } else if (nextStage === 3) {
      var labHeadEmail = findLabHeadForRoom(roomId);
      if (labHeadEmail) {
        var token3 = generateToken();
        sheet.getRange(rowIdx, 31).setValue(labHeadEmail);
        sheet.getRange(rowIdx, 32).setValue('Pending');
        sheet.getRange(rowIdx, 33).setValue(now);
        sheet.getRange(rowIdx, 35).setValue(token3);
        sheet.getRange(rowIdx, 45).setValue(3);
        sendNotification('approve_request', {
          to: labHeadEmail,
          stage: 3,
          stageName: 'หัวหน้าห้องปฏิบัติการ (Lab Head)',
          requestId: requestId,
          applicantName: applicantName,
          studentId: row[5] || '-',
          department: department,
          phone: row[8],
          roomName: roomName,
          token: token3
        });
        writeLog('AutoRoute', 'RouteToLabHead', 'Requests', requestId, 'Routed to ' + labHeadEmail, 'Success');
        return true;
      } else {
        sheet.getRange(rowIdx, 32).setValue('Skipped');
        sheet.getRange(rowIdx, 33).setValue(now);
        nextStage++;
      }
    } else if (nextStage === 4) {
      var adminEmail = findAdminForRoomOrBuilding(roomId);
      var token4 = generateToken();
      sheet.getRange(rowIdx, 37).setValue(adminEmail);
      sheet.getRange(rowIdx, 38).setValue('Pending');
      sheet.getRange(rowIdx, 39).setValue(now);
      sheet.getRange(rowIdx, 41).setValue(token4);
      sheet.getRange(rowIdx, 45).setValue(4);
      sendNotification('approve_request', {
        to: adminEmail,
        stage: 4,
        stageName: 'หัวหน้าตึก/ผู้ดูแลระบบ (Building Admin)',
        requestId: requestId,
        applicantName: applicantName,
        studentId: row[5] || '-',
        department: department,
        phone: row[8],
        roomName: roomName,
        token: token4
      });
      writeLog('AutoRoute', 'RouteToAdmin', 'Requests', requestId, 'Routed to ' + adminEmail, 'Success');
      return true;
    }
  }

  return true;
}

function verifyToken(token, expectedStage) {
  var cleanToken = String(token || '').trim();
  if (!cleanToken) throw new Error('Token ไม่ถูกต้อง');
  var actorEmail = requireAuthenticatedUser();
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Requests');
  if (!sheet) throw new Error('ไม่พบชีต Requests');
  var map = getHeaderMap(sheet);
  var data = sheet.getDataRange().getValues();
  var maxFailures = 5;

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var tokenStage = null;
    var tokenDate = null;
    var stageStatus = '';
    var approverEmail = '';
    for (var current = 1; current <= 4; current++) {
      var tokenCol = map['Stage' + current + '_Token'];
      if (tokenCol && String(row[tokenCol - 1] || '').trim() === cleanToken) {
        tokenStage = current;
        tokenDate = new Date(row[map['Stage' + current + '_Date'] - 1]);
        stageStatus = String(row[map['Stage' + current + '_Status'] - 1] || '').trim();
        approverEmail = String(row[map['Stage' + current + '_ApproverEmail'] - 1] || '').trim().toLowerCase();
        break;
      }
    }
    if (!tokenStage && map.RequestToken && String(row[map.RequestToken - 1] || '').trim() === cleanToken) {
      tokenStage = 'Request';
      tokenDate = new Date(row[map.Timestamp - 1]);
      stageStatus = 'Valid';
    }
    if (!tokenStage) continue;

    var isAdmin = verifyUserRole(actorEmail, 'Admin');
    var applicantEmail = String(row[map.ApplicantEmail - 1] || '').trim().toLowerCase();
    var meta = tokenStage === 'Request' ? null : getTokenMetaColumns(tokenStage);
    var failed = meta && map[meta.failedAttempts] ? Number(row[map[meta.failedAttempts] - 1]) || 0 : 0;
    if (failed >= maxFailures) throw new Error('Token ถูกระงับชั่วคราวเนื่องจากมีการเรียกใช้ผิดหลายครั้ง');
    if (meta && map[meta.usedAt] && row[map[meta.usedAt] - 1]) {
      throw new Error('Token นี้ถูกใช้งานไปแล้ว');
    }
    if (tokenStage === 'Request') {
      if (!isAdmin && actorEmail !== applicantEmail) throw new Error('บัญชี Google นี้ไม่มีสิทธิ์ดูคำขอนี้');
    } else if (!isAdmin && actorEmail !== approverEmail) {
      recordTokenFailure(sheet, i + 1, tokenStage, 'Approver mismatch');
      throw new Error('Token นี้ไม่ตรงกับผู้อนุมัติของขั้นตอน');
    }
    if (tokenStage !== 'Request' && stageStatus !== 'Pending') {
      recordTokenFailure(sheet, i + 1, tokenStage, 'Token already used or status=' + stageStatus);
      throw new Error('Token นี้ได้รับการดำเนินการไปแล้ว (' + stageStatus + ')');
    }
    var requestStage = Number(row[map.CurrentStage - 1]);
    if (tokenStage !== 'Request' && requestStage !== tokenStage) {
      recordTokenFailure(sheet, i + 1, tokenStage, 'Stage mismatch');
      throw new Error('Token ไม่ตรงกับขั้นตอนปัจจุบันของคำขอนี้');
    }
    if (expectedStage && tokenStage !== 'Request' && Number(expectedStage) !== tokenStage) {
      recordTokenFailure(sheet, i + 1, tokenStage, 'Expected stage mismatch');
      throw new Error('Token ไม่ตรงกับระดับสิทธิ์ที่ระบุ');
    }
    var expiryDays = Number(getSetting('TOKEN_EXPIRY_DAYS', 7));
    var diffDays = (new Date().getTime() - tokenDate.getTime()) / 86400000;
    if (tokenStage !== 'Request' && (isNaN(tokenDate.getTime()) || diffDays > expiryDays)) {
      recordTokenFailure(sheet, i + 1, tokenStage, 'Token expired');
      throw new Error('Token หมดอายุแล้ว กรุณาติดต่อผู้ดูแลระบบ');
    }
    return { requestData: row, detectedStage: tokenStage, rowIndex: i + 1, actorEmail: actorEmail };
  }
  writeLog('SecurityAlert', 'verifyToken', 'Requests', '', 'Token not found: ' + maskToken(cleanToken), 'Fail');
  throw new Error('Token ไม่ถูกต้องหรือไม่พบคำขอที่เกี่ยวข้อง');
}

/**
 * ประมวลผลการอนุมัติ/ปฏิเสธคำขอในแต่ละขั้นตอน (Stage 1-4)
 * @param {string} requestId
 * @param {number} stage      1-4
 * @param {string} decision   'Approve' | 'Reject'
 * @param {string} note
 * @param {string} token
 * @param {Object} extra      { startDate, biometricAppointmentDate } — ใช้เฉพาะ Stage 4 ตอนอนุมัติ
 */
function processApproval(requestId, stage, decision, note, token, extra) {
  try {
    var verified = verifyToken(token, Number(stage));
    var rowIdx = verified.rowIndex;
    var row = verified.requestData;

    if (String(row[0]) !== String(requestId)) {
      throw new Error('Token ไม่ตรงกับคำขอเลขที่ ' + requestId);
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Requests');
    var now = new Date();
    stage = Number(stage);
    extra = extra || {};

    // คอลัมน์ (1-based) ของแต่ละขั้นตอน: [ApproverEmail, Status, Date, Note, Token]
    var stageCols = {
      1: { status: 20, date: 21, note: 22 },
      2: { status: 26, date: 27, note: 28 },
      3: { status: 32, date: 33, note: 34 },
      4: { status: 38, date: 39, note: 40 }
    };
    var cols = stageCols[stage];
    if (!cols) throw new Error('ขั้นตอนไม่ถูกต้อง: ' + stage);

    var applicantName = row[3];
    var applicantEmail = row[4];
    var roomName = row[10];

    if (decision === 'Reject') {
      sheet.getRange(rowIdx, cols.status).setValue('Rejected');
      sheet.getRange(rowIdx, cols.date).setValue(now);
      sheet.getRange(rowIdx, cols.note).setValue(note || '');
      sheet.getRange(rowIdx, 46).setValue('Rejected'); // OverallStatus

      sendNotification('reject_notification', {
        to: applicantEmail,
        requestId: requestId,
        applicantName: applicantName,
        roomName: roomName,
        stage: stage,
        note: note
      });

      var rejectMap = getHeaderMap(sheet);
      var rejectMeta = getTokenMetaColumns(stage);
      if (rejectMap[rejectMeta.usedAt]) sheet.getRange(rowIdx, rejectMap[rejectMeta.usedAt]).setValue(now);
      writeLog('Approval', 'processApproval', 'Requests', requestId, 'Rejected at stage ' + stage, 'Success');
      return { success: true, requestId: requestId, decision: 'Reject' };
    }

    // decision === 'Approve'
    sheet.getRange(rowIdx, cols.status).setValue('Approved');
    sheet.getRange(rowIdx, cols.date).setValue(now);
    sheet.getRange(rowIdx, cols.note).setValue(note || '');

    // Mark the one-time approval token as used before any terminal return.
    var usedMap = getHeaderMap(sheet);
    var usedMeta = getTokenMetaColumns(stage);
    if (usedMap[usedMeta.usedAt]) sheet.getRange(rowIdx, usedMap[usedMeta.usedAt]).setValue(now);

    if (stage === 4) {
      var finalStartDate = row[12];
      var finalEndDate = row[13];
      var finalBioDate = row[42];

      if (extra.startDate) {
        finalStartDate = new Date(extra.startDate);
        var durationMonths = Number(getSetting('ACCESS_DURATION_MONTHS', 3));
        finalEndDate = new Date(finalStartDate.getTime());
        finalEndDate.setMonth(finalEndDate.getMonth() + durationMonths);
        sheet.getRange(rowIdx, 13).setValue(finalStartDate);
        sheet.getRange(rowIdx, 14).setValue(finalEndDate);
      }
      if (extra.biometricAppointmentDate) {
        finalBioDate = new Date(extra.biometricAppointmentDate);
        sheet.getRange(rowIdx, 43).setValue(finalBioDate);
      }

      sheet.getRange(rowIdx, 44).setValue('Scheduled'); // BiometricStatus
      sheet.getRange(rowIdx, 45).setValue(4);            // CurrentStage
      sheet.getRange(rowIdx, 46).setValue('Approved');   // OverallStatus

      // 1. Google Calendar Integration: สร้างนัดหมายเฉพาะวันนัดแสกน Biometric ในปฏิทิน Admin
      try {
        if (finalBioDate) {
          createAdminBiometricCalendarEvent({
            requestId: requestId,
            applicantName: applicantName,
            applicantEmail: applicantEmail,
            roomName: roomName,
            biometricDate: finalBioDate,
            accessCode: row[17] || row[16] || ''
          });
        }
      } catch (calErr) {
        writeLog('Warning', 'CalendarIntegration', 'GoogleCalendar', requestId, calErr.toString(), 'Fail');
      }

      // 2. Hardware Sync: ส่ง Webhook ไปยังเครื่องสแกน Biometric ทันทีเมื่ออนุมัติเสร็จสมบูรณ์
      try {
        syncUserToBiometricDevice({
          requestId: requestId,
          accessCode: row[17] || row[16] || '',
          fullName: applicantName,
          studentId: row[5] || '',
          startDate: finalStartDate,
          endDate: finalEndDate,
          roomId: row[9] || ''
        });
      } catch (bioErr) {
        writeLog('Warning', 'BiometricSync', 'HardwareWebhook', requestId, bioErr.toString(), 'Fail');
      }

      var finalUsedMap = getHeaderMap(sheet);
      var finalUsedMeta = getTokenMetaColumns(stage);
      if (finalUsedMap[finalUsedMeta.usedAt]) sheet.getRange(rowIdx, finalUsedMap[finalUsedMeta.usedAt]).setValue(now);

      sendNotification('status_update', {
        to: applicantEmail,
        requestId: requestId,
        applicantName: applicantName,
        roomName: roomName,
        startDate: finalStartDate instanceof Date ? Utilities.formatDate(finalStartDate, 'Asia/Bangkok', 'dd/MM/yyyy') : finalStartDate,
        endDate: finalEndDate instanceof Date ? Utilities.formatDate(finalEndDate, 'Asia/Bangkok', 'dd/MM/yyyy') : finalEndDate,
        biometricAppointmentDate: finalBioDate instanceof Date ? Utilities.formatDate(finalBioDate, 'Asia/Bangkok', 'dd/MM/yyyy HH:mm') : finalBioDate,
        note: note
      });

      writeLog('Approval', 'processApproval', 'Requests', requestId, 'Approved at final stage 4', 'Success');
      return { success: true, requestId: requestId, decision: 'Approve', overallStatus: 'Approved' };
    }

    // Stage 1-3 Approved → route to next applicable stage
    routeToNextStage(requestId, stage);
    writeLog('Approval', 'processApproval', 'Requests', requestId, 'Approved at stage ' + stage + ', routed to next stage', 'Success');
    return { success: true, requestId: requestId, decision: 'Approve' };
  } catch (err) {
    writeLog('Error', 'processApproval', 'Requests', requestId, err.toString(), 'Fail');
    throw err;
  }
}

// ==============================================================================
// AGENT 3: Notification & Email Actions
// ==============================================================================

function sendNotification(type, payload) {
  try {
    var senderName = getSetting('SMTP_SENDER_NAME', 'ระบบ CE F.A.I.R.');
    var webAppUrl = ScriptApp.getService().getUrl();
    var to = payload.to;
    if (!to) return false;

    var subject = '';
    var bodyHtml = '';

    if (type === 'submit_confirmation') {
      subject = '[' + senderName + '] ยืนยันการรับคำขอเข้าใช้ห้องปฏิบัติการ - ' + payload.requestId;
      var statusUrl = webAppUrl + '?token=' + payload.requestToken + '&view=status#dashboard';

      var aiCard = '';
      if (payload.aiSummary) {
        aiCard = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;padding:14px;border-radius:6px;margin:15px 0;">' +
          '<div style="font-weight:bold;color:#065f46;font-size:13px;margin-bottom:6px;">🤖 บทวิเคราะห์และสรุปย่อจาก AI (ระบบ CE F.A.I.R.)</div>' +
          '<div style="font-size:13px;color:#1e293b;line-height:1.5;">' + payload.aiSummary.replace(/\n/g, '<br>') + '</div>' +
          '</div>';
      }

      bodyHtml = '<div style="font-family:\'Sarabun\',sans-serif,Arial;line-height:1.6;color:#333;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">' +
        '<div style="border-bottom:2px solid #661003;padding-bottom:12px;margin-bottom:18px;">' +
        '<h2 style="color:#661003;margin:0;font-size:20px;">ยืนยันการรับคำขอเข้าใช้ห้องปฏิบัติการ</h2>' +
        '<p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">สาขาวิชาวิศวกรรมโยธา คณะวิศวกรรมศาสตร์ มหาวิทยาลัยขอนแก่น — ' + senderName + '</p>' +
        '</div>' +
        '<p>เรียนคุณ <b>' + payload.applicantName + '</b>,</p>' +
        '<p>ระบบได้รับคำขอเข้าใช้ห้อง <b>' + payload.roomName + '</b> (เลขที่คำขอ: <b>' + payload.requestId + '</b>) เรียบร้อยแล้ว</p>' +
        '<div style="background:#f8fafc;padding:16px;border-radius:8px;margin:15px 0;border-left:4px solid #183666;font-size:13px;line-height:1.7;">' +
        '<p style="margin:0;"><b>Access Code ประจำคำขอ:</b> <span style="font-size:20px;color:#183666;font-weight:bold;">' + (payload.accessCode || '-') + '</span></p>' +
        '<p style="margin:0;"><b>ช่วงวันที่ขอใช้งาน:</b> ' + (payload.startDate || '-') + ' ถึง ' + (payload.endDate || '-') + '</p>' +
        '<p style="margin:0;"><b>เวลาที่ขอใช้งาน:</b> ' + (payload.allowedTimeStart || '-') + ' - ' + (payload.allowedTimeEnd || '-') + '</p>' +
        '<p style="margin:0;"><b>วัน-เวลาขอเข้ารับการบันทึก Biometric:</b> ' + (payload.biometricAppointmentDate || '-') + '</p>' +
        '<p style="margin:0;"><b>สถานะปัจจุบัน:</b> <span style="color:#f59e0b;font-weight:bold;">' + payload.overallStatus + '</span></p>' +
        '</div>' +
        aiCard +
        '<div style="text-align:center;margin:22px 0;">' +
        '<a href="' + statusUrl + '" style="display:inline-block;padding:12px 28px;background:#183666;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">' +
        '📊 คลิกเพื่อตรวจสอบและติดตามสถานะคำขอ' +
        '</a>' +
        '</div>' +
        '<hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;">' +
        '<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">ส่งโดย ' + senderName + '</p>' +
        '</div>';

    } else if (type === 'approve_request') {
      subject = '[' + senderName + '] มีคำขอรอการพิจารณา (' + payload.stageName + ') - ' + payload.requestId;

      var approveUrl = (payload.stage === 4)
        ? (webAppUrl + '?token=' + payload.token + '&stage=' + payload.stage + '&view=approver#dashboard')
        : (webAppUrl + '?action=approve&token=' + payload.token + '&stage=' + payload.stage);

      var rejectUrl = (payload.stage === 4)
        ? (webAppUrl + '?token=' + payload.token + '&stage=' + payload.stage + '&view=approver#dashboard')
        : (webAppUrl + '?action=reject&token=' + payload.token + '&stage=' + payload.stage);

      var detailUrl = webAppUrl + '?token=' + payload.token + '&stage=' + payload.stage + '&view=approver#dashboard';

      var aiCard = '';
      if (payload.aiSummary) {
        aiCard = '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #10b981;padding:14px;border-radius:6px;margin:15px 0;">' +
          '<div style="font-weight:bold;color:#065f46;font-size:13px;margin-bottom:6px;">🤖 บทวิเคราะห์และคำแนะนำจาก AI เพื่อประกอบการพิจารณา</div>' +
          '<div style="font-size:13px;color:#1e293b;line-height:1.5;">' + payload.aiSummary.replace(/\n/g, '<br>') + '</div>' +
          '</div>';
      }

      bodyHtml = '<div style="font-family:\'Sarabun\',sans-serif,Arial;line-height:1.6;color:#333;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">' +
        '<div style="border-bottom:2px solid #183666;padding-bottom:12px;margin-bottom:18px;">' +
        '<h2 style="color:#183666;margin:0;font-size:20px;">มีคำขอเข้าใช้ห้องปฏิบัติการนอกเวลารอการพิจารณา</h2>' +
        '<p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">ขั้นตอนที่ ' + payload.stage + ': ' + payload.stageName + '</p>' +
        '</div>' +
        '<p>เรียน <b>' + payload.stageName + '</b>,</p>' +
        '<p>มีคำขอยื่นโดย <b>' + payload.applicantName + '</b> (รหัสนักศึกษา: ' + (payload.studentId || '-') + ', ภาค/สาขา: ' + (payload.department || '-') + ', โทร: ' + (payload.phone || '-') + ')</p>' +
        '<div style="background:#f8fafc;padding:14px;border-radius:6px;margin:15px 0;font-size:13px;line-height:1.6;border:1px solid #e2e8f0;">' +
        '<p style="margin:0;"><b>ห้องที่ขอ:</b> ' + payload.roomName + ' (เลขที่คำขอ: <b>' + payload.requestId + '</b>)</p>' +
        '<p style="margin:0;"><b>ช่วงเวลาที่ขอ:</b> ' + (payload.startDate || '-') + ' ถึง ' + (payload.endDate || '-') + ' (' + (payload.allowedTimeStart || '-') + ' - ' + (payload.allowedTimeEnd || '-') + ')</p>' +
        '<p style="margin:0;"><b>วัน-เวลาขอรับการบันทึก Biometric:</b> ' + (payload.biometricAppointmentDate || '-') + '</p>' +
        '<p style="margin:0;"><b>วัตถุประสงค์:</b> ' + (payload.purpose || '-') + '</p>' +
        '</div>' +
        aiCard +
        '<p style="margin-top:20px;font-weight:600;color:#1e293b;">กรุณาเลือกดำเนินการพิจารณาคำขอ:</p>' +
        '<div style="display:flex;gap:10px;margin:20px 0;justify-content:center;text-align:center;">' +
        '<a href="' + approveUrl + '" style="display:inline-block;padding:11px 24px;background:#10b981;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin-right:8px;">' +
        '✓ อนุมัติคำขอ' +
        '</a>' +
        '<a href="' + rejectUrl + '" style="display:inline-block;padding:11px 24px;background:#ef4444;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;margin-right:8px;">' +
        '✕ ปฏิเสธ' +
        '</a>' +
        '<a href="' + detailUrl + '" style="display:inline-block;padding:11px 20px;background:#f1f5f9;color:#334155;text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;border:1px solid #cbd5e1;">' +
        '🔍 ดูรายละเอียดคำขอ' +
        '</a>' +
        '</div>' +
        '<hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;">' +
        '<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">ส่งโดย ' + senderName + '</p>' +
        '</div>';

    } else if (type === 'reject_notification') {
      subject = '[' + senderName + '] คำขอเลขที่ ' + payload.requestId + ' ไม่ได้รับการอนุมัติ';
      bodyHtml = '<div style="font-family:\'Sarabun\',sans-serif,Arial;line-height:1.6;color:#333;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">' +
        '<h2 style="color:#dc2626;margin-top:0;">คำขอเข้าใช้ห้องปฏิบัติการไม่ได้รับการอนุมัติ</h2>' +
        '<p>เรียนคุณ <b>' + payload.applicantName + '</b>,</p>' +
        '<p>คำขอเลขที่ <b>' + payload.requestId + '</b> (ห้อง: ' + payload.roomName + ') ได้รับการปฏิเสธในขั้นตอนที่ ' + payload.stage + '</p>' +
        '<div style="background:#fef2f2;padding:14px;border-radius:6px;border-left:4px solid #dc2626;margin:18px 0;">' +
        '<p style="margin:0;font-size:13px;color:#991b1b;"><b>เหตุผล / หมายเหตุ:</b> ' + (payload.note || 'ไม่มีการระบุเหตุผล') + '</p>' +
        '</div>' +
        '<hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;">' +
        '<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">ส่งโดย ' + senderName + '</p>' +
        '</div>';

    } else if (type === 'status_update') {
      subject = '[' + senderName + '] ผลการอนุมัติคำขอเลขที่ ' + payload.requestId + ' (อนุมัติสมบูรณ์)';
      bodyHtml = '<div style="font-family:\'Sarabun\',sans-serif,Arial;line-height:1.6;color:#333;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">' +
        '<h2 style="color:#10b981;margin-top:0;">คำขอของคุณได้รับการอนุมัติครบทุกขั้นตอนแล้ว</h2>' +
        '<p>เรียนคุณ <b>' + payload.applicantName + '</b>,</p>' +
        '<p>คำขอเลขที่ <b>' + payload.requestId + '</b> (ห้อง: ' + payload.roomName + ') ได้รับการอนุมัติครบทั้ง 4 ขั้นตอนเรียบร้อยแล้ว</p>' +
        '<div style="background:#ecfdf5;padding:16px;border-radius:6px;border-left:4px solid #10b981;margin:18px 0;font-size:13px;line-height:1.8;">' +
        '<p style="margin:0;color:#065f46;"><b>📅 ช่วงวันที่ได้รับอนุมัติใช้งาน:</b> ' + (payload.startDate || '-') + ' ถึง ' + (payload.endDate || '-') + '</p>' +
        '<p style="margin:0;color:#065f46;"><b>🕒 กำหนดวันและเวลานัดหมายมาบันทึก Biometric กับ Admin ที่ตึก:</b> <span style="font-size:15px;font-weight:bold;">' + (payload.biometricAppointmentDate || 'โปรดติดต่อเจ้าหน้าที่') + '</span></p>' +
        (payload.note ? '<p style="margin:0;color:#065f46;"><b>หมายเหตุจากผู้ดูแล:</b> ' + payload.note + '</p>' : '') +
        '</div>' +
        '<hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;">' +
        '<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">ส่งโดย ' + senderName + '</p>' +
        '</div>';
    }

    MailApp.sendEmail({
      to: to,
      subject: subject,
      htmlBody: bodyHtml,
      name: senderName
    });
    return true;
  } catch (err) {
    writeLog('Error', 'sendNotification', 'Email', payload ? payload.to : '', err.toString(), 'Fail');
    return false;
  }
}

function writeLog(actionType, action, targetSheet, targetRecordID, details, result) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Logs');
    if (!sheet) return;

    var logId = 'LOG-' + new Date().getTime();
    var userEmail = getCurrentUserEmail() || 'SYSTEM';
    var now = new Date();

    sheet.appendRow([
      logId, now, userEmail, actionType, action,
      targetSheet, targetRecordID, details, result || 'Success'
    ]);
  } catch (err) {}
}

function getDashboardStats() {
  try {
    requireAuthenticatedUser();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var reqSheet = ss.getSheetByName('Requests');
    var data = reqSheet ? reqSheet.getDataRange().getValues() : [];

    var stats = {
      totalRequests: 0,
      activeRequests: 0,
      pendingRequests: 0,
      expiredRequests: 0,
      rejectedRequests: 0,
      skippedCount: 0,
      statusStats: {},
      personTypeStats: {},
      degreeLevelStats: {},
      divisionStats: {},
      outsideFacultyStats: { civil: 0, nonCivil: 0, external: 0 },
      advisorStats: {},
      monthlyStats: {},
      roomUsageStats: {}
    };

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var requestId = String(row[0] || '');
      if (!requestId) continue;

      var timestamp = row[1];
      var applicantName = String(row[3] || '');
      var applicantEmail = String(row[4] || '');
      var applicantType = String(row[5] || 'Student'); // Student, Staff, External
      var dept = String(row[7] || '').trim();
      var roomName = String(row[10] || 'ไม่ระบุ');
      var status = String(row[45] || 'Pending');

      // Stage 1 Approver Email (used for advisor stats if Student is Civil)
      var stage1Email = String(row[18] || '').trim();

      stats.totalRequests++;
      if (status === 'Active') stats.activeRequests++;
      else if (status === 'Pending' || status === 'InReview') stats.pendingRequests++;
      else if (status === 'Expired') stats.expiredRequests++;
      else if (status === 'Rejected') stats.rejectedRequests++;

      if (row[19] === 'Skipped' || row[25] === 'Skipped' || row[31] === 'Skipped' || row[37] === 'Skipped') {
        stats.skippedCount++;
      }

      // 1. Status Stats
      stats.statusStats[status] = (stats.statusStats[status] || 0) + 1;

      // 2. Person Type Stats
      stats.personTypeStats[applicantType] = (stats.personTypeStats[applicantType] || 0) + 1;

      // Since the request doesn't directly store degreeLevel or division in the main Requests sheet columns 
      // (but it might store them under other columns or we can lookup the user, or let's inspect the User row fields, 
      // or check where the form fields map to the sheet rows)
    }

    // Let's do a cross-reference lookup with Users table to get detailed student division/degree info
    var userSheet = ss.getSheetByName('Users');
    var userData = userSheet ? userSheet.getDataRange().getValues() : [];
    var userMap = {};
    for (var u = 1; u < userData.length; u++) {
      var uRow = userData[u];
      var uEmail = String(uRow[7] || '').trim().toLowerCase();
      if (uEmail) {
        userMap[uEmail] = {
          personType: String(uRow[3] || ''),
          division: String(uRow[10] || ''),
          degreeLevel: String(uRow[11] || ''),
          faculty: String(uRow[9] || ''),
          department: String(uRow[8] || '')
        };
      }
    }

    // Re-verify the loop with Users mapping to populate detailed charts
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var requestId = String(row[0] || '');
      if (!requestId) continue;

      var email = String(row[4] || '').trim().toLowerCase();
      var uInfo = userMap[email] || {};

      var pType = String(row[5] || uInfo.personType || 'Student').trim();
      var dept = String(row[7] || uInfo.department || '').trim();
      var faculty = String(uInfo.faculty || '').trim();
      var division = String(uInfo.division || 'ต่างสาขา / ต่างคณะ / ไม่มีแผนก').trim();
      var degree = String(uInfo.degreeLevel || 'Bachelor').trim();
      var roomName = String(row[10] || 'ไม่ระบุ').trim();

      // Degree Level (Only for Students)
      if (pType === 'Student') {
        stats.degreeLevelStats[degree] = (stats.degreeLevelStats[degree] || 0) + 1;
      }

      // Division Stats
      if (division) {
        stats.divisionStats[division] = (stats.divisionStats[division] || 0) + 1;
      }

      // Outside Faculty Stats: civil (โยธา), nonCivil (ต่างสาขา/คณะ), external (บุคคลภายนอก)
      if (pType === 'External') {
        stats.outsideFacultyStats.external++;
      } else {
        var isCivilDept = (dept.indexOf('โยธา') !== -1 || dept.indexOf('civil') !== -1);
        var isEngFaculty = (faculty === '' || faculty.indexOf('วิศว') !== -1 || faculty.indexOf('eng') !== -1);
        if (isCivilDept && isEngFaculty) {
          stats.outsideFacultyStats.civil++;
        } else {
          stats.outsideFacultyStats.nonCivil++;
        }
      }

      // Advisor Stats (Stage 1 Approver if they are Civil Student and have advisor email)
      var isCivil = (dept.indexOf('โยธา') !== -1 || dept.indexOf('civil') !== -1);
      var stage1Email = String(row[18] || '').trim();
      if (pType === 'Student' && isCivil && stage1Email && stage1Email.indexOf('lareew@') === -1) {
        // Find advisor's name from Advisor sheet if possible
        stats.advisorStats[stage1Email] = (stats.advisorStats[stage1Email] || 0) + 1;
      }

      // Monthly Frequency Stats
      var timestamp = row[1];
      if (timestamp instanceof Date) {
        var yearMonth = Utilities.formatDate(timestamp, 'Asia/Bangkok', 'yyyy-MM');
        stats.monthlyStats[yearMonth] = (stats.monthlyStats[yearMonth] || 0) + 1;
      }

      // Room Usage Stats
      if (roomName) {
        stats.roomUsageStats[roomName] = (stats.roomUsageStats[roomName] || 0) + 1;
      }
    }

    // Convert advisor emails to Names using Advisor sheet
    var advSheet = ss.getSheetByName('Advisor');
    if (advSheet && Object.keys(stats.advisorStats).length > 0) {
      var advData = advSheet.getDataRange().getValues();
      var advMap = {};
      for (var a = 1; a < advData.length; a++) {
        var aEmail = String(advData[a][2] || '').trim().toLowerCase();
        var aName = String(advData[a][1] || '').trim();
        if (aEmail && aName) {
          advMap[aEmail] = aName;
        }
      }
      var newAdvisorStats = {};
      for (var emailKey in stats.advisorStats) {
        var name = advMap[emailKey.toLowerCase()] || emailKey;
        newAdvisorStats[name] = stats.advisorStats[emailKey];
      }
      stats.advisorStats = newAdvisorStats;
    }

    return stats;
  } catch (err) {
    return { error: err.toString() };
  }
}

function exportRequestsToCSV(filterCriteria) {
  try {
    requireRole('Admin');
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Requests');
    if (!sheet) return '';

    var data = sheet.getDataRange().getValues();
    if (data.length <= 1) return '';

    var csvRows = [];
    csvRows.push(data[0].map(function(cell) { return '"' + String(cell).replace(/"/g, '""') + '"'; }).join(','));

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var formattedRow = row.map(function(cell) {
        if (cell instanceof Date) {
          return '"' + Utilities.formatDate(cell, 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss') + '"';
        }
        return '"' + String(cell || '').replace(/"/g, '""') + '"';
      });
      csvRows.push(formattedRow.join(','));
    }

    writeLog('Export', 'exportRequestsToCSV', 'Requests', '', 'CSV Exported', 'Success');
    return csvRows.join('\r\n');
  } catch (err) {
    return '';
  }
}

function getRoomList() {
  try {
    requireAuthenticatedUser();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Rooms');
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    var rooms = [];
    for (var i = 1; i < data.length; i++) {
      rooms.push({
        roomId: data[i][0],
        roomName: data[i][1],
        building: data[i][2],
        floor: data[i][3],
        capacity: data[i][4],
        facilities: data[i][5],
        labHeadEmail: data[i][6],
        approverEmail: data[i][7],
        imageUrl: data[i][8],
        status: data[i][9]
      });
    }
    return rooms;
  } catch (e) {
    return [];
  }
}

function getAdvisorList() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Advisor');
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      if (String(data[i][5]).trim() === 'Active') {
        list.push({
          advisorId: data[i][0],
          fullName: data[i][1],
          email: data[i][2],
          division: data[i][3] || 'วิศวกรรมโยธา',
          phone: data[i][4]
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

function getRoomClosureList() {
  try {
    requireAuthenticatedUser();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('RoomClosures');
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    var list = [];
    for (var i = 1; i < data.length; i++) {
      list.push({
        closureId: data[i][0],
        title: data[i][1],
        description: data[i][2],
        startDate: data[i][3] instanceof Date ? Utilities.formatDate(data[i][3], 'Asia/Bangkok', 'yyyy-MM-dd') : data[i][3],
        endDate: data[i][4] instanceof Date ? Utilities.formatDate(data[i][4], 'Asia/Bangkok', 'yyyy-MM-dd') : data[i][4],
        affectedRoomIds: data[i][5],
        createdBy: data[i][6],
        createdAt: data[i][7],
        status: data[i][8]
      });
    }
    return list;
  } catch (e) {
    return [];
  }
}

// ==============================================================================
// ROOM CLOSURE / HOLIDAY EMAIL BROADCAST
// ส่งอีเมลแจ้งวันหยุด/ปิดห้อง ไปยังทุกอีเมลที่ปรากฏใน Google Sheet ทั้งหมด
// ==============================================================================

/**
 * รวบรวมอีเมลทุกฉบับที่ปรากฏในชีตทั้งหมดของ Spreadsheet (ตัดซ้ำอัตโนมัติ)
 */
function collectAllEmailsInSpreadsheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  var emailMap = {};
  var emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if (lastRow < 1 || lastCol < 1) continue;

    var data = sheet.getDataRange().getValues();
    for (var r = 0; r < data.length; r++) {
      for (var c = 0; c < data[r].length; c++) {
        var val = String(data[r][c] || '').trim();
        if (val && emailRegex.test(val)) {
          emailMap[val.toLowerCase()] = val;
        }
      }
    }
  }

  return Object.keys(emailMap).map(function (key) { return emailMap[key]; });
}

/**
 * จัดรูปแบบวันที่สำหรับแสดงในอีเมล
 */
function formatClosureDate(value) {
  if (!value) return '';
  if (value instanceof Date) return Utilities.formatDate(value, 'Asia/Bangkok', 'dd/MM/yyyy');
  return String(value);
}

/**
 * สร้างเนื้อหา HTML สำหรับอีเมลแจ้งวันหยุด/ปิดห้อง
 */
function buildClosureEmailHtml(title, description, startDate, endDate, affectedRoomIds, senderName) {
  return '<div style="font-family:Sarabun,Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:10px;background:#fff;">' +
    '<div style="border-bottom:2px solid #661003;padding-bottom:12px;margin-bottom:18px;">' +
    '<h2 style="color:#661003;margin:0;font-size:20px;">📢 ' + (title || '') + '</h2>' +
    '<p style="margin:4px 0 0 0;color:#64748b;font-size:13px;">ประกาศปิดห้องปฏิบัติการ / วันหยุด</p>' +
    '</div>' +
    '<p>เรียน ผู้เกี่ยวข้องทุกท่าน,</p>' +
    '<div style="background:#f8fafc;padding:14px;border-radius:6px;margin:15px 0;font-size:13px;line-height:1.6;border:1px solid #e2e8f0;">' +
    (startDate ? '<p style="margin:0;"><b>📅 ช่วงวันที่ปิด:</b> ' + startDate + ' - ' + endDate + '</p>' : '') +
    (affectedRoomIds ? '<p style="margin:0;"><b>🚪 ห้องที่ได้รับผลกระทบ:</b> ' + affectedRoomIds + '</p>' : '') +
    (description ? '<p style="margin:6px 0 0 0;"><b>รายละเอียด:</b> ' + description + '</p>' : '') +
    '</div>' +
    '<p style="font-size:13px;color:#475569;">กรุณาวางแผนการใช้งานห้องปฏิบัติการให้สอดคล้องกับช่วงเวลาดังกล่าวด้วย ขออภัยในความไม่สะดวก</p>' +
    '<hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0;">' +
    '<p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;">ส่งโดย ' + senderName + '</p>' +
    '</div>';
}

/**
 * ส่งอีเมลแจ้งวันหยุด/ปิดห้อง ไปยังทุกอีเมลที่ปรากฏในชีต (BCC แบ่งเป็นกลุ่ม)
 */
function sendRoomClosureNotification(closureData) {
  try {
    var senderName = getSetting('SMTP_SENDER_NAME', 'ระบบ CE F.A.I.R.');
    var adminEmail = getSetting('ADMIN_EMAIL', 'pacnim@kku.ac.th');
    var recipients = collectAllEmailsInSpreadsheet();
    if (!recipients.length) {
      writeLog('Warning', 'sendRoomClosureNotification', 'Email', closureData.closureId || '', 'ไม่พบอีเมลในชีต', 'Fail');
      return { success: false, sentTo: 0, message: 'ไม่พบอีเมลในชีต' };
    }

    var title = closureData.title || 'ปิดห้องปฏิบัติการ';
    var startDate = formatClosureDate(closureData.startDate);
    var endDate = formatClosureDate(closureData.endDate);
    var subject = '[' + senderName + '] 📢 ' + title + (startDate ? ' (' + startDate + ' - ' + endDate + ')' : '');
    var bodyHtml = buildClosureEmailHtml(title, closureData.description, startDate, endDate, closureData.affectedRoomIds, senderName);

    // ส่งแบบ BCC เพื่อให้ถึงทุกคนในครั้งเดียว (แบ่งกลุ่มละ 40 เพื่อกัน header ยาวเกิน)
    var chunkSize = 40;
    var sent = 0;
    for (var i = 0; i < recipients.length; i += chunkSize) {
      var chunk = recipients.slice(i, i + chunkSize).join(',');
      MailApp.sendEmail({
        to: adminEmail,
        bcc: chunk,
        subject: subject,
        htmlBody: bodyHtml,
        name: senderName
      });
      sent += Math.min(chunkSize, recipients.length - i);
    }

    writeLog('Notification', 'sendRoomClosureNotification', 'RoomClosures', closureData.closureId || '', 'ส่งอีเมลแจ้งวันหยุดไปยัง ' + sent + ' อีเมล', 'Success');
    return { success: true, sentTo: sent };
  } catch (err) {
    writeLog('Error', 'sendRoomClosureNotification', 'RoomClosures', closureData ? closureData.closureId : '', err.toString(), 'Fail');
    return { success: false, sentTo: 0, message: err.toString() };
  }
}

/**
 * Installable onEdit: ตรวจจับการกรอกข้อมูลในชีต RoomClosures แล้วส่งอีเมลอัตโนมัติ
 */
function onRoomClosuresEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    if (sheet.getName() !== 'RoomClosures') return;

    var startRow = Math.max(2, e.range.getRow());
    var endRow = e.range.getLastRow();
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    for (var h = 0; h < headers.length; h++) {
      colMap[String(headers[h]).trim()] = h;
    }

    var hasRequiredCols = colMap['Title'] !== undefined && colMap['StartDate'] !== undefined && colMap['EndDate'] !== undefined;
    if (!hasRequiredCols) return;

    var notifiedIdx = colMap['NotifiedAt'] !== undefined ? colMap['NotifiedAt'] : -1;

    for (var row = startRow; row <= endRow; row++) {
      var values = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0];
      var title = String(values[colMap['Title']] || '').trim();
      var startDate = values[colMap['StartDate']] || '';
      var endDate = values[colMap['EndDate']] || '';
      var alreadyNotified = notifiedIdx >= 0 ? String(values[notifiedIdx] || '').trim() : '';

      // ส่งเฉพาะเมื่อกรอก Title และวันที่ครบ และยังไม่เคยส่ง
      if (title && (startDate || endDate) && !alreadyNotified) {
        var result = sendRoomClosureNotification({
          closureId: String(values[colMap['ClosureID']] || '').trim(),
          title: title,
          description: String(values[colMap['Description']] || '').trim(),
          startDate: startDate,
          endDate: endDate,
          affectedRoomIds: String(values[colMap['AffectedRoomIDs']] || '').trim()
        });

        if (result.success && notifiedIdx >= 0) {
          sheet.getRange(row, notifiedIdx + 1).setValue(new Date());
        }
      }
    }
  } catch (err) {
    writeLog('Error', 'onRoomClosuresEdit', 'RoomClosures', '', err.toString(), 'Fail');
  }
}

/**
 * ติดตั้ง Installable onEdit Trigger สำหรับการแจ้งเตือนอีเมลวันหยุด
 */
function setupRoomClosureEmailTrigger() {
  var existing = ScriptApp.getProjectTriggers();
  for (var i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'onRoomClosuresEdit') {
      ScriptApp.deleteTrigger(existing[i]);
    }
  }
  ScriptApp.newTrigger('onRoomClosuresEdit')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  writeLog('AdminAction', 'setupRoomClosureEmailTrigger', 'RoomClosures', 'SYSTEM', 'ติดตั้ง Trigger แจ้งเตือนอีเมลวันหยุดเรียบร้อยแล้ว', 'Success');
  return { success: true, message: 'ติดตั้ง Trigger แจ้งเตือนอีเมลวันหยุดเรียบร้อยแล้ว กรอกวันหยุดในชีต RoomClosures แล้วระบบจะส่งเมลอัตโนมัติ' };
}

/**
 * ส่งอีเมลแจ้งเตือนสำหรับรายการวันหยุดที่ยังไม่ได้ส่ง (Fallback / Manual)
 */
function sendPendingRoomClosureNotifications() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('RoomClosures');
    if (!sheet) return { success: false, message: 'ไม่พบชีต RoomClosures' };

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    var colMap = {};
    for (var h = 0; h < headers.length; h++) colMap[String(headers[h]).trim()] = h;

    var data = sheet.getDataRange().getValues();
    var sentCount = 0;
    var skippedCount = 0;

    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      var title = String(row[colMap['Title']] || '').trim();
      var startDate = row[colMap['StartDate']] || '';
      var endDate = row[colMap['EndDate']] || '';
      var alreadyNotified = String(row[colMap['NotifiedAt']] || '').trim();

      if (title && (startDate || endDate) && !alreadyNotified) {
        var res = sendRoomClosureNotification({
          closureId: String(row[colMap['ClosureID']] || '').trim(),
          title: title,
          description: String(row[colMap['Description']] || '').trim(),
          startDate: startDate,
          endDate: endDate,
          affectedRoomIds: String(row[colMap['AffectedRoomIDs']] || '').trim()
        });
        if (res.success) {
          sheet.getRange(r + 1, colMap['NotifiedAt'] + 1).setValue(new Date());
          sentCount++;
        }
      } else if (title && (startDate || endDate) && alreadyNotified) {
        skippedCount++;
      }
    }

    writeLog('AdminAction', 'sendPendingRoomClosureNotifications', 'RoomClosures', 'SYSTEM', 'ส่งแล้ว ' + sentCount + ' รายการ (ข้ามไปแล้ว ' + skippedCount + ' รายการ)', 'Success');
    return { success: true, sentCount: sentCount, skippedCount: skippedCount, message: 'ส่งอีเมลแจ้งเตือนแล้ว ' + sentCount + ' รายการ' };
  } catch (err) {
    writeLog('Error', 'sendPendingRoomClosureNotifications', 'RoomClosures', '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}

function getUserByEmail(email) {
  try {
    if (!email) return null;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    var cleanEmail = String(email).trim().toLowerCase();

    for (var i = 1; i < data.length; i++) {
      if (String(data[i][7]).trim().toLowerCase() === cleanEmail) {
        return {
          userId: data[i][0],
          fullName: data[i][1],
          age: data[i][2],
          personType: data[i][3],
          staffType: data[i][4],
          studentId: data[i][5],
          phone: data[i][6],
          email: data[i][7],
          department: data[i][8],
          faculty: data[i][9],
          division: data[i][10],
          degreeLevel: data[i][11],
          externalOrg: data[i][12],
          accessCode: data[i][15],
          photoUrl: data[i][16]
        };
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function getRequestByTokenOrSearch(query) {
  try {
    var actorEmail = requireAuthenticatedUser();
    if (!query) return null;
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Requests');
    if (!sheet) return null;

    var data = sheet.getDataRange().getValues();
    var cleanQuery = String(query).trim().toLowerCase();
    var results = [];

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rowApplicantEmail = String(row[4] || '').trim().toLowerCase();
      if (!verifyUserRole(actorEmail, 'Admin') && rowApplicantEmail !== actorEmail) continue;
      var rId = String(row[0]).trim().toLowerCase();
      var rEmail = String(row[4]).trim().toLowerCase();
      var rPhone = String(row[8]).trim().toLowerCase().replace(/-/g, '');
      var rToken = String(row[48] || row[47]).trim().toLowerCase();
      var s1Token = String(row[22]).trim().toLowerCase();
      var s2Token = String(row[28]).trim().toLowerCase();
      var s3Token = String(row[34]).trim().toLowerCase();
      var s4Token = String(row[40]).trim().toLowerCase();
      var queryDigits = cleanQuery.replace(/-/g, '');

      if (rId === cleanQuery || rToken === cleanQuery || s1Token === cleanQuery || s2Token === cleanQuery || s3Token === cleanQuery || s4Token === cleanQuery || rEmail === cleanQuery || rPhone === queryDigits || String(row[8]).trim().toLowerCase() === cleanQuery) {
        results.push({
          requestId: row[0],
          timestamp: row[1] instanceof Date ? Utilities.formatDate(row[1], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[1],
          applicantName: row[3],
          applicantEmail: row[4],
          applicantType: row[5],
          submittedByRole: row[6],
          department: row[7],
          phone: row[8],
          roomId: row[9],
          roomName: row[10],
          purpose: row[11],
          startDate: row[12] instanceof Date ? Utilities.formatDate(row[12], 'Asia/Bangkok', 'yyyy-MM-dd') : row[12],
          endDate: row[13] instanceof Date ? Utilities.formatDate(row[13], 'Asia/Bangkok', 'yyyy-MM-dd') : row[13],
          allowedTimeStart: row[14],
          allowedTimeEnd: row[15],
          participantNames: row[16],
          emergencyContact: row[17],
          stage1: { email: row[18], status: row[19], date: row[20], note: row[21] },
          stage2: { email: row[24], status: row[25], date: row[26], note: row[27] },
          stage3: { email: row[30], status: row[31], date: row[32], note: row[33] },
          stage4: { email: row[36], status: row[37], date: row[38], note: row[39] },
          biometricAppointmentDate: row[42] instanceof Date ? Utilities.formatDate(row[42], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[42],
          biometricStatus: row[43],
          currentStage: row[44],
          overallStatus: row[45],
          photoUrl: row[47],
          requestToken: row[48] || row[47]
        });
      }
    }
    return results;
  } catch (e) {
    return [];
  }
}

function getApprovalRequestByToken(token, stage) {
  try {
    var verified = verifyToken(token, stage ? Number(stage) : null);
    var row = verified.requestData;
    var currentStage = verified.detectedStage === 'Request' ? row[44] : verified.detectedStage;

    return {
      success: true,
      requestId: row[0],
      timestamp: row[1] instanceof Date ? Utilities.formatDate(row[1], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[1],
      applicantName: row[3],
      applicantEmail: row[4],
      applicantType: row[5],
      submittedByRole: row[6],
      department: row[7],
      phone: row[8],
      roomId: row[9],
      roomName: row[10],
      purpose: row[11],
      startDate: row[12] instanceof Date ? Utilities.formatDate(row[12], 'Asia/Bangkok', 'yyyy-MM-dd') : row[12],
      endDate: row[13] instanceof Date ? Utilities.formatDate(row[13], 'Asia/Bangkok', 'yyyy-MM-dd') : row[13],
      allowedTimeStart: row[14],
      allowedTimeEnd: row[15],
      participantNames: row[16],
      emergencyContact: row[17],
      biometricAppointmentDate: row[42] instanceof Date ? Utilities.formatDate(row[42], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[42],
      currentStage: currentStage || row[44],
      overallStatus: row[45],
      signatureData: row[46],
      photoUrl: row[47],
      accessCode: row[17] || row[16] || '',
      requestToken: row[48] || row[47] || token,
      stages: [
        { number: 1, title: 'อาจารย์ที่ปรึกษา (Advisor)', email: row[18], status: row[19], date: row[20] instanceof Date ? Utilities.formatDate(row[20], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[20], note: row[21] },
        { number: 2, title: 'เจ้าหน้าที่ประจำแผนก (Division Staff)', email: row[24], status: row[25], date: row[26] instanceof Date ? Utilities.formatDate(row[26], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[26], note: row[27] },
        { number: 3, title: 'หัวหน้าห้องปฏิบัติการ (Lab Head)', email: row[30], status: row[31], date: row[32] instanceof Date ? Utilities.formatDate(row[32], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[32], note: row[33] },
        { number: 4, title: 'หัวหน้าตึก/ผู้ดูแลระบบ (Building Admin)', email: row[36], status: row[37], date: row[38] instanceof Date ? Utilities.formatDate(row[38], 'Asia/Bangkok', 'yyyy-MM-dd HH:mm') : row[38], note: row[39] }
      ]
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

// ==============================================================================
// AGENT 6: Integrations - Google Calendar, Biometric Sync & Webhook API
// ==============================================================================

/**
 * สร้าง Calendar Event ลงในปฏิทินของ Admin "เฉพาะวันนัดแสกน Biometric"
 */
function createAdminBiometricCalendarEvent(eventData) {
  try {
    var adminEmail = getSetting('ADMIN_EMAIL', 'pacnim@kku.ac.th');
    var cal = CalendarApp.getCalendarById(adminEmail) || CalendarApp.getDefaultCalendar();
    if (!cal) {
      writeLog('Warning', 'CalendarIntegration', 'GoogleCalendar', eventData.requestId, 'Cannot find target calendar: ' + adminEmail, 'Fail');
      return false;
    }

    var bioDate = new Date(eventData.biometricDate);
    if (isNaN(bioDate.getTime())) return false;

    var startTime = new Date(bioDate.getTime());
    var endTime = new Date(startTime.getTime() + (30 * 60 * 1000)); // ช่วงละ 30 นาที

    var title = '📌 [นัดสแกน Biometric] ' + eventData.applicantName + ' (คำขอ ' + eventData.requestId + ')';
    var description = 'นัดหมายบันทึกข้อมูลชีวมิติ (ลายนิ้วมือ/ใบหน้า) สำหรับเข้าใช้ห้องปฏิบัติการ\n\n' +
      '• ผู้ขอ: ' + eventData.applicantName + '\n' +
      '• อีเมล: ' + eventData.applicantEmail + '\n' +
      '• เลขที่คำขอ: ' + eventData.requestId + '\n' +
      '• Access Code: ' + (eventData.accessCode || '-') + '\n' +
      '• ห้องปฏิบัติการ: ' + eventData.roomName + '\n' +
      '• สถานที่นัดหมาย: สำนักงานธุรการอาคารวิศวกรรมโยธา';

    var options = {
      description: description,
      location: 'สำนักงานธุรการอาคารวิศวกรรมโยธา',
      guests: eventData.applicantEmail,
      sendInvites: true
    };

    var event = cal.createEvent(title, startTime, endTime, options);
    writeLog('Calendar', 'createAdminBiometricCalendarEvent', 'GoogleCalendar', eventData.requestId, 'Event Created ID: ' + event.getId(), 'Success');
    return true;
  } catch (err) {
    writeLog('Error', 'createAdminBiometricCalendarEvent', 'GoogleCalendar', eventData.requestId, err.toString(), 'Fail');
    return false;
  }
}

/**
 * ส่ง Webhook แจ้งข้อมูลผู้ที่ได้รับอนุมัติไปยังเซิร์ฟเวอร์/เกตเวย์เครื่องสแกน Biometric
 */
function syncUserToBiometricDevice(userData) {
  try {
    var webhookUrl = getSetting('BIOMETRIC_API_URL', '');
    if (!webhookUrl) {
      writeLog('Info', 'syncUserToBiometricDevice', 'HardwareSync', userData.requestId, 'No BIOMETRIC_API_URL configured. Skipped push.', 'Success');
      return false;
    }
    var webhookSecret = PropertiesService.getScriptProperties().getProperty('BIOMETRIC_WEBHOOK_SECRET');
    if (!webhookSecret) {
      writeLog('SecurityAlert', 'syncUserToBiometricDevice', 'HardwareSync', userData.requestId, 'Webhook URL configured but BIOMETRIC_WEBHOOK_SECRET is missing.', 'Fail');
      throw new Error('ยังไม่ได้ตั้งค่า webhook secret ใน Script Properties');
    }

    var payload = {
      event: 'USER_APPROVED',
      requestId: userData.requestId,
      accessCode: userData.accessCode,
      fullName: userData.fullName,
      studentId: userData.studentId,
      startDate: userData.startDate instanceof Date ? Utilities.formatDate(userData.startDate, 'Asia/Bangkok', 'yyyy-MM-dd') : userData.startDate,
      endDate: userData.endDate instanceof Date ? Utilities.formatDate(userData.endDate, 'Asia/Bangkok', 'yyyy-MM-dd') : userData.endDate,
      roomId: userData.roomId,
      secretToken: webhookSecret
    };

    var options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var res = UrlFetchApp.fetch(webhookUrl, options);
    writeLog('HardwareSync', 'syncUserToBiometricDevice', 'BiometricDevice', userData.requestId, 'Response code: ' + res.getResponseCode(), 'Success');
    return true;
  } catch (err) {
    writeLog('Warning', 'syncUserToBiometricDevice', 'BiometricDevice', userData.requestId, err.toString(), 'Fail');
    return false;
  }
}

/**
 * HTTP POST Endpoint: รับ Webhook ขาเข้าจากเครื่องสแกน (เช่น เมื่อมีการสแกนผ่านประตู หรือ Sync สถานะ)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No payload' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    var expectedSecret = PropertiesService.getScriptProperties().getProperty('BIOMETRIC_WEBHOOK_SECRET');
    if (!expectedSecret || data.secretToken !== expectedSecret) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Unauthorized' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 1. รับบันทึก Log การสแกนผ่านประตู (Door Access Log)
    if (data.event === 'DOOR_ACCESS_LOG') {
      writeLog('BiometricScan', 'DoorAccess', 'AccessLogs', data.accessCode || data.userId,
        'Room: ' + (data.roomId || '-') + ' | Status: ' + (data.accessResult || 'Granted') + ' | Device: ' + (data.deviceId || '-'), 'Success');

      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Log recorded' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 2. อัปเดตสถานะการบันทึกชีวมิติเสร็จสมบูรณ์ (Biometric Enrolled)
    if (data.event === 'BIOMETRIC_ENROLLED') {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName('Requests');
      if (sheet) {
        var sheetData = sheet.getDataRange().getValues();
        for (var i = 1; i < sheetData.length; i++) {
          if (String(sheetData[i][0]) === String(data.requestId)) {
            sheet.getRange(i + 1, 44).setValue('Completed'); // BiometricStatus
            break;
          }
        }
      }
      writeLog('BiometricScan', 'BiometricEnrolled', 'Requests', data.requestId, 'Biometric enrollment completed by device', 'Success');
      return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Enrollment updated' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Event received' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    writeLog('Error', 'doPost', 'Webhook', '', err.toString(), 'Fail');
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ==============================================================================
// AGENT 7: Time-Driven Triggers & Data Management APIs
// ==============================================================================

/**
 * 1. Time-driven Daily Background Job: อัปเดตสถานะคำขออัตโนมัติ
 * - Approved ➔ Active (เมื่อถึง StartDate)
 * - Active ➔ Expired (เมื่อเลย EndDate)
 */
function updateExpiredRequests() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Requests');
    if (!sheet) return { success: false, message: 'ไม่พบชีต Requests' };

    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var todayStr = Utilities.formatDate(now, 'Asia/Bangkok', 'yyyy-MM-dd');
    var updatedCount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var requestId = row[0];
      if (!requestId) continue;

      var overallStatus = String(row[45] || '').trim();
      var startDate = row[12];
      var endDate = row[13];

      if (startDate && startDate instanceof Date) {
        var startStr = Utilities.formatDate(startDate, 'Asia/Bangkok', 'yyyy-MM-dd');
        // Approved ➔ Active
        if (overallStatus === 'Approved' && todayStr >= startStr) {
          sheet.getRange(i + 1, 46).setValue('Active');
          writeLog('SystemAction', 'updateExpiredRequests', 'Requests', requestId, 'Status updated: Approved -> Active', 'Success');
          updatedCount++;
          overallStatus = 'Active';
        }
      }

      if (endDate && endDate instanceof Date) {
        var endStr = Utilities.formatDate(endDate, 'Asia/Bangkok', 'yyyy-MM-dd');
        // Active/Approved ➔ Expired
        if ((overallStatus === 'Active' || overallStatus === 'Approved') && todayStr > endStr) {
          sheet.getRange(i + 1, 46).setValue('Expired');
          writeLog('SystemAction', 'updateExpiredRequests', 'Requests', requestId, 'Status updated: ' + overallStatus + ' -> Expired', 'Success');
          updatedCount++;
        }
      }
    }

    return { success: true, updatedCount: updatedCount };
  } catch (err) {
    writeLog('Error', 'updateExpiredRequests', 'Requests', '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}

/**
 * 2. Time-driven Daily Background Job: ส่งอีเมลเตือนผู้อนุมัติซ้ำทุกๆ APPROVAL_REMINDER_DAYS
 */
function sendPendingApprovalReminders() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Requests');
    if (!sheet) return { success: false, message: 'ไม่พบชีต Requests' };

    var reminderDays = Number(getSetting('APPROVAL_REMINDER_DAYS', 3));
    var data = sheet.getDataRange().getValues();
    var now = new Date();
    var sentCount = 0;

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var requestId = row[0];
      if (!requestId) continue;

      var overallStatus = String(row[45] || '').trim();
      if (overallStatus !== 'Pending' && overallStatus !== 'InReview') continue;

      var currentStage = Number(row[44]);
      var approverEmail = '';
      var token = '';
      var stageTitle = '';
      var lastSentDate = null;
      var reminderCol = -1;

      if (currentStage === 1 && String(row[19]).trim() === 'Pending') {
        approverEmail = row[18];
        token = row[22];
        stageTitle = 'อาจารย์ที่ปรึกษา / หัวหน้าสาขา';
        lastSentDate = row[23] ? new Date(row[23]) : new Date(row[20]);
        reminderCol = 24;
      } else if (currentStage === 2 && String(row[25]).trim() === 'Pending') {
        approverEmail = row[24];
        token = row[28];
        stageTitle = 'เจ้าหน้าที่ประจำแผนก (Division Staff)';
        lastSentDate = row[29] ? new Date(row[29]) : new Date(row[26]);
        reminderCol = 30;
      } else if (currentStage === 3 && String(row[31]).trim() === 'Pending') {
        approverEmail = row[30];
        token = row[34];
        stageTitle = 'หัวหน้าห้องปฏิบัติการ (Lab Head)';
        lastSentDate = row[35] ? new Date(row[35]) : new Date(row[32]);
        reminderCol = 36;
      } else if (currentStage === 4 && String(row[37]).trim() === 'Pending') {
        approverEmail = row[36];
        token = row[40];
        stageTitle = 'หัวหน้าตึก/Admin ผู้ดูแลระบบ';
        lastSentDate = row[41] ? new Date(row[41]) : new Date(row[38]);
        reminderCol = 42;
      }

      if (approverEmail && token && lastSentDate && !isNaN(lastSentDate.getTime())) {
        var diffDays = (now.getTime() - lastSentDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays >= reminderDays) {
          sendNotification('approve_request', {
            to: approverEmail,
            stage: currentStage,
            stageName: stageTitle + ' [🔔 แจ้งเตือนพิจารณาคำขอค้าง]',
            requestId: requestId,
            applicantName: row[3],
            studentId: row[5] || '-',
            department: row[7] || '-',
            phone: row[8],
            roomName: row[10],
            token: token
          });

          if (reminderCol > 0) {
            sheet.getRange(i + 1, reminderCol).setValue(now);
          }
          writeLog('Notification', 'sendPendingApprovalReminders', 'Requests', requestId, 'Sent reminder to ' + approverEmail + ' for stage ' + currentStage, 'Success');
          sentCount++;
        }
      }
    }

    return { success: true, sentCount: sentCount };
  } catch (err) {
    writeLog('Error', 'sendPendingApprovalReminders', 'Requests', '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}


/**
 * ติดตั้ง Trigger อัตโนมัติสำหรับ Background Jobs รายวัน
 */
function setupDailyTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var funcsToSetup = ['updateExpiredRequests', 'sendPendingApprovalReminders', 'applyDataRetentionPolicy'];

  for (var i = 0; i < triggers.length; i++) {
    var hName = triggers[i].getHandlerFunction();
    if (funcsToSetup.indexOf(hName) !== -1) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // รัน updateExpiredRequests ทุกวันเวลา 01:00
  ScriptApp.newTrigger('updateExpiredRequests')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();

  // รัน sendPendingApprovalReminders ทุกวันเวลา 08:00
  ScriptApp.newTrigger('sendPendingApprovalReminders')
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();

  // รัน applyDataRetentionPolicy ทุกวันเวลา 02:00 (ลบรูปของคำขอเกิน DATA_RETENTION_MONTHS)
  ScriptApp.newTrigger('applyDataRetentionPolicy')
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  writeLog('AdminAction', 'setupDailyTriggers', 'Settings', 'SYSTEM', 'Installed daily time-driven triggers', 'Success');
  return { success: true, message: 'ติดตั้ง Trigger รายวันเรียบร้อยแล้ว' };
}

/**
 * ตรวจสอบความถูกต้องและสิทธิ์ผู้ใช้งาน (Role Guard)
 */
function verifyUserRole(email, requiredRole) {
  var role = determineSubmitterRole(email);
  if (role === 'Admin') return true;
  if (requiredRole === 'DivisionStaff' && (role === 'DivisionStaff' || role === 'LabHead')) return true;
  if (requiredRole === 'LabHead' && role === 'LabHead') return true;
  if (requiredRole === 'Advisor' && role === 'Advisor') return true;
  return role === requiredRole;
}

/**
 * ตรวจสอบความขัดแย้งของเวลาการใช้ห้อง (Time Conflict Check)
 */
function checkTimeConflict(roomId, startDate, endDate, allowedTimeStart, allowedTimeEnd) {
  try {
    requireAuthenticatedUser();
    if (!roomId || !startDate) return { hasConflict: false };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Requests');
    if (!sheet) return { hasConflict: false };

    var data = sheet.getDataRange().getValues();
    var targetStart = new Date(startDate).getTime();
    var targetEnd = endDate ? new Date(endDate).getTime() : targetStart;

    var conflicts = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var rId = String(row[9] || '');
      var status = String(row[45] || '');

      if (rId === String(roomId) && (status === 'Approved' || status === 'Active')) {
        var sDate = row[12] instanceof Date ? row[12].getTime() : new Date(row[12]).getTime();
        var eDate = row[13] instanceof Date ? row[13].getTime() : new Date(row[13]).getTime();

        // ตรวจสอบช่วงวันที่ทับซ้อนกัน
        if (targetStart <= eDate && targetEnd >= sDate) {
          conflicts.push({
            requestId: row[0],
            applicantName: row[3],
            startDate: Utilities.formatDate(new Date(sDate), 'Asia/Bangkok', 'yyyy-MM-dd'),
            endDate: Utilities.formatDate(new Date(eDate), 'Asia/Bangkok', 'yyyy-MM-dd'),
            time: (row[14] || '') + ' - ' + (row[15] || '')
          });
        }
      }
    }

    return { hasConflict: conflicts.length > 0, conflicts: conflicts };
  } catch (err) {
    return { hasConflict: false, error: err.toString() };
  }
}

/**
 * ตรวจสอบว่าห้องปิดตามวันหยุดหรือประกาศปิดห้องหรือไม่
 */
function checkRoomClosure(roomId, date) {
  try {
    requireAuthenticatedUser();
    if (!date) return { isClosed: false };
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('RoomClosures');
    if (!sheet) return { isClosed: false };

    var data = sheet.getDataRange().getValues();
    var checkTime = new Date(date).getTime();

    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      var affected = String(row[5] || '').trim();
      var sDate = row[3] instanceof Date ? row[3].getTime() : new Date(row[3]).getTime();
      var eDate = row[4] instanceof Date ? row[4].getTime() : (row[4] ? new Date(row[4]).getTime() : sDate);

      var isRoomMatch = affected === 'ALL' || !roomId || affected.split(',').map(function(s){ return s.trim(); }).indexOf(String(roomId)) !== -1;
      if (isRoomMatch && checkTime >= sDate && checkTime <= eDate) {
        return {
          isClosed: true,
          title: row[1],
          description: row[2],
          startDate: Utilities.formatDate(new Date(sDate), 'Asia/Bangkok', 'yyyy-MM-dd'),
          endDate: Utilities.formatDate(new Date(eDate), 'Asia/Bangkok', 'yyyy-MM-dd')
        };
      }
    }

    return { isClosed: false };
  } catch (err) {
    return { isClosed: false, error: err.toString() };
  }
}


/**
 * ฟังก์ชันจัดการข้อมูลผู้ใช้ (CRUD Users)
 */
function manageUser(action, userData, callerEmail) {
  try {
    var actorEmail = requireRole('Admin');
    if (!verifyUserRole(actorEmail, 'Admin')) {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการข้อมูลผู้ใช้ได้');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Users');
    if (!sheet) throw new Error('ไม่พบชีต Users');

    var data = sheet.getDataRange().getValues();

    if (action === 'get') {
      var users = [];
      for (var i = 1; i < data.length; i++) {
        users.push({
          userId: data[i][0],
          fullName: data[i][1],
          personType: data[i][3],
          email: data[i][7],
          phone: data[i][6],
          department: data[i][8],
          division: data[i][10],
          accessCode: data[i][15],
          status: data[i][17]
        });
      }
      return { success: true, users: users };
    } else if (action === 'update') {
      for (var j = 1; j < data.length; j++) {
        if (String(data[j][0]) === String(userData.userId)) {
          if (userData.fullName) sheet.getRange(j + 1, 2).setValue(userData.fullName);
          if (userData.phone) sheet.getRange(j + 1, 7).setValue(userData.phone);
          if (userData.department) sheet.getRange(j + 1, 9).setValue(userData.department);
          if (userData.division) sheet.getRange(j + 1, 11).setValue(userData.division);
          if (userData.status) sheet.getRange(j + 1, 18).setValue(userData.status);
          writeLog('AdminAction', 'updateUser', 'Users', userData.userId, 'Updated user info', 'Success');
          return { success: true, message: 'บันทึกข้อมูลผู้ใช้เรียบร้อยแล้ว' };
        }
      }
      throw new Error('ไม่พบผู้ใช้งานรหัส ' + userData.userId);
    } else if (action === 'delete') {
      for (var k = 1; k < data.length; k++) {
        if (String(data[k][0]) === String(userData.userId)) {
          sheet.deleteRow(k + 1);
          writeLog('AdminAction', 'deleteUser', 'Users', userData.userId, 'Deleted user', 'Success');
          return { success: true, message: 'ลบข้อมูลผู้ใช้เรียบร้อยแล้ว' };
        }
      }
      throw new Error('ไม่พบผู้ใช้งานรหัส ' + userData.userId);
    }

    throw new Error('Action ไม่ถูกต้อง');
  } catch (err) {
    writeLog('Error', 'manageUser', 'Users', userData ? userData.userId : '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}

/**
 * ฟังก์ชันจัดการข้อมูลห้อง (CRUD Rooms)
 */
function manageRoom(action, roomData, callerEmail) {
  try {
    var actorEmail = requireRole('Admin');
    if (!verifyUserRole(actorEmail, 'Admin')) {
      throw new Error('เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถจัดการข้อมูลห้องได้');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Rooms');
    if (!sheet) throw new Error('ไม่พบชีต Rooms');

    var data = sheet.getDataRange().getValues();

    if (action === 'create') {
      sheet.appendRow([
        roomData.roomId, roomData.roomName, roomData.building || '', roomData.floor || '',
        roomData.capacity || '', roomData.facilities || '', roomData.labHeadEmail || '',
        roomData.approverEmail || '', roomData.imageUrl || '', roomData.status || 'Active'
      ]);
      writeLog('AdminAction', 'createRoom', 'Rooms', roomData.roomId, 'Created room', 'Success');
      return { success: true, message: 'เพิ่มห้องปฏิบัติการเรียบร้อยแล้ว' };
    } else if (action === 'update') {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(roomData.roomId)) {
          if (roomData.roomName) sheet.getRange(i + 1, 2).setValue(roomData.roomName);
          if (roomData.building) sheet.getRange(i + 1, 3).setValue(roomData.building);
          if (roomData.floor) sheet.getRange(i + 1, 4).setValue(roomData.floor);
          if (roomData.capacity) sheet.getRange(i + 1, 5).setValue(roomData.capacity);
          if (roomData.facilities) sheet.getRange(i + 1, 6).setValue(roomData.facilities);
          if (roomData.labHeadEmail) sheet.getRange(i + 1, 7).setValue(roomData.labHeadEmail);
          if (roomData.approverEmail) sheet.getRange(i + 1, 8).setValue(roomData.approverEmail);
          if (roomData.imageUrl) sheet.getRange(i + 1, 9).setValue(roomData.imageUrl);
          if (roomData.status) sheet.getRange(i + 1, 10).setValue(roomData.status);
          writeLog('AdminAction', 'updateRoom', 'Rooms', roomData.roomId, 'Updated room info', 'Success');
          return { success: true, message: 'บันทึกข้อมูลห้องเรียบร้อยแล้ว' };
        }
      }
      throw new Error('ไม่พบห้องรหัส ' + roomData.roomId);
    } else if (action === 'delete') {
      for (var j = 1; j < data.length; j++) {
        if (String(data[j][0]) === String(roomData.roomId)) {
          sheet.deleteRow(j + 1);
          writeLog('AdminAction', 'deleteRoom', 'Rooms', roomData.roomId, 'Deleted room', 'Success');
          return { success: true, message: 'ลบข้อมูลห้องเรียบร้อยแล้ว' };
        }
      }
      throw new Error('ไม่พบห้องรหัส ' + roomData.roomId);
    }

    throw new Error('Action ไม่ถูกต้อง');
  } catch (err) {
    writeLog('Error', 'manageRoom', 'Rooms', roomData ? roomData.roomId : '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}

/**
 * ฟังก์ชันจัดการประกาศปิดห้อง / วันหยุด (CRUD RoomClosures)
 */
function manageRoomClosure(action, closureData, callerEmail) {
  try {
    var actorEmail = requireAuthenticatedUser();
    var role = determineSubmitterRole(actorEmail);
    if (role !== 'Admin' && role !== 'DivisionStaff') {
      throw new Error('เฉพาะ Admin หรือ เจ้าหน้าที่ประจำแผนก (Division Staff) เท่านั้นที่มีสิทธิ์จัดการประกาศปิดห้อง');
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('RoomClosures');
    if (!sheet) throw new Error('ไม่พบชีต RoomClosures');

    var data = sheet.getDataRange().getValues();

    if (action === 'create') {
      var closureId = 'CLS-' + new Date().getTime();
      var now = new Date();
      sheet.appendRow([
        closureId, closureData.title, closureData.description || '',
        new Date(closureData.startDate), new Date(closureData.endDate),
        closureData.affectedRoomIds || 'ALL', actorEmail, now, 'Active', ''
      ]);

      // ส่งอีเมล Broadcast อัตโนมัติ
      sendRoomClosureNotification({
        closureId: closureId,
        title: closureData.title,
        description: closureData.description || '',
        startDate: closureData.startDate,
        endDate: closureData.endDate,
        affectedRoomIds: closureData.affectedRoomIds || 'ALL'
      });

      writeLog('AdminAction', 'createRoomClosure', 'RoomClosures', closureId, 'Created and broadcasted closure: ' + closureData.title, 'Success');
      return { success: true, closureId: closureId, message: 'สร้างและส่งประกาศปิดห้องเรียบร้อยแล้ว' };
    } else if (action === 'delete') {
      for (var i = 1; i < data.length; i++) {
        if (String(data[i][0]) === String(closureData.closureId)) {
          sheet.deleteRow(i + 1);
          writeLog('AdminAction', 'deleteRoomClosure', 'RoomClosures', closureData.closureId, 'Deleted closure', 'Success');
          return { success: true, message: 'ลบประกาศเรียบร้อยแล้ว' };
        }
      }
      throw new Error('ไม่พบประกาศรหัส ' + closureData.closureId);
    }

    throw new Error('Action ไม่ถูกต้อง');
  } catch (err) {
    writeLog('Error', 'manageRoomClosure', 'RoomClosures', closureData ? closureData.closureId : '', err.toString(), 'Fail');
    return { success: false, message: err.toString() };
  }
}



