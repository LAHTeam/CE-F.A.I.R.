# ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน (ระบบ CE F.A.I.R.)
> ระบบบริหารจัดการและขออนุมัติเข้าใช้ห้องปฏิบัติการนอกเวลาราชการ สาขาวิชาวิศวกรรมโยธา คณะวิศวกรรมศาสตร์ มหาวิทยาลัยขอนแก่น  
> พัฒนาด้วย Google Apps Script V8 + Vue.js 3 + Pure Fast CSS

---

## 📌 จุดเด่นและการทำงานหลักของระบบ CE F.A.I.R.

1. **โครงสร้าง 2 แท็บหลัก (Clean 2-Tab Design)**:
   - 📝 **ยื่นคำขอ (Request Access)**: ฟอร์มยื่นคำขอแบบ Stepper 6 ขั้นตอน
   - 📊 **แดชบอร์ด (Dashboard)**: สถิติ KPI, กราฟ, ตรวจสอบและติดตามสถานะคำขอ (Status Tracker), รายการห้องแล็บ และประกาศปิดห้อง
2. **ระบบค้นหาอาจารย์ที่ปรึกษา (Searchable Advisor Combobox)**:
   - ในชีต `Advisor` คอลัมน์คือ **`Division (แผนก)`** เนื่องจากอาจารย์ทุกท่านสังกัดสาขาวิชาวิศวกรรมโยธา จึงจำแนกตามแผนกวิชาการ เช่น *แผนกวิศวกรรมโครงสร้าง, แผนกวิศวกรรมขนส่ง*
   - หน้าฟอร์มมีช่องค้นหาอาจารย์แบบ Real-time Search กรองได้ทั้งชื่อ-นามสกุล, แผนก และอีเมล
3. **การแยกความแตกต่างระหว่างการนัดหมาย Biometric กับ ลายเซ็นดิจิทัล**:
   - 🕒 **วันที่ และเวลาขอเข้ารับการบันทึก Biometric (ขั้นตอนที่ 3: Room, Time & Biometrics)**: วันและเวลาที่ผู้ขอสะดวกเดินทางมาสแกนลายนิ้วมือ/ใบหน้ากับ Admin ณ อาคารปฏิบัติการจริง ๆ
   - ✍️ **ลงลายมือชื่อดิจิทัล (ขั้นตอนที่ 6: ลงนามและยืนยัน)**: การลงลายมือชื่อบนหน้าจอ (HTML5 Canvas) เพื่อยินยอมในหนังสือขออนุมัติ
4. **การจัดเก็บรูปถ่ายและลายเซ็นดิจิทัล**:
   - 📷 **รูปถ่ายผู้ขอ (Applicant Photo)**: แปลงเป็นไฟล์ภาพ JPG อัปโหลดและบันทึกไว้ใน **Google Drive** ภายใต้โฟลเดอร์ `RoomAccess_Applicant_Photos` โดยอัตโนมัติ พร้อมบันทึก Shareable URL ลงชีต `Users` และชีต `Requests` (คอลัมน์ `PhotoURL`)
   - ✍️ **ลายมือชื่อดิจิทัล (Digital Signature)**: แปลงเป็น Base64 Data URL จาก Canvas และจัดเก็บลงชีต `Requests` (คอลัมน์ `SignatureData`)
5. **การดึงอีเมล Google Account อัตโนมัติ (Instant 0ms Email Preload)**:
   - ดึงอีเมลผู้ใช้จาก `Session.getActiveUser().getEmail()` และส่งผ่าน Server Template ทันทีที่เปิดหน้าเว็บ ช่วยให้กรอกอีเมลและค้นหาประวัติเดิมได้ทันทีโดยไม่ต้องรอดาวน์โหลด
6. **การจัดรูปแบบอัตโนมัติ (Auto-Formatting)**:
   - 🆔 **รหัสนักศึกษา**: บังคับกรอกเฉพาะตัวเลข และจัดรูปแบบเป็น `xxxxxxxxx-x` อัตโนมัติ
   - 📞 **เบอร์โทรศัพท์**: บังคับกรอกเฉพาะตัวเลข และจัดรูปแบบเป็น `xxx-xxx-xxxx` อัตโนมัติ
   - 🏢 **แผนก (Division)**: ตัดตัวเลขนำหน้าออก เหลือชื่อแผนกล้วน (เช่น *แผนกวิศวกรรมโครงสร้าง*)
   - 🚨 **ข้อมูลติดต่อฉุกเฉิน**: ระบุเป็น *"ชื่อ และเบอร์โทร. ผู้ติดต่อ กรณีฉุกเฉิน"*
7. **การปรับเปลี่ยนวันเริ่มใช้งานและวันนัดหมาย Biometric โดย Admin (Stage 4)**:
   - ใน **Stage 4 (Building Admin)** ผู้ดูแลสามารถตรวจสอบและปรับเปลี่ยน **วันที่เริ่มต้นใช้งาน** และ **วัน-เวลานัดหมายสแกน Biometric** ได้โดยตรงจากหน้าต่างพิจารณาคำขอ พร้อมส่งผลลัพธ์ที่ปรับปรุงแล้วไปยังอีเมลผู้ขอ
8. **ข้อความสถานะการโหลดแบบไดนามิก**:
   - เริ่มต้นด้วย `"กำลังประมวลผล..."` หากใช้เวลาเกิน 4 วินาที จะเปลี่ยนเป็น `"กรุณารอสักครู่..."` อัตโนมัติ

---

## 📋 ลำดับขั้นตอนการอนุมัติ 4 ลำดับขั้น (4-Stage Sequential Approval)

```
[ผู้ยื่นคำขอ] (แนบรูปถ่าย + Access Code 6 หลัก ลำดับ 0001-9999)
     │
     ▼
[Stage 1: ผู้อนุมัติขั้นที่ 1] ──(🤖 One-Click Approve / Reject ในอีเมล พร้อม AI Summary)─┐
  ├─ นศ. สาขาวิชาวิศวกรรมโยธา คณะวิศวะ ────────► อาจารย์ที่ปรึกษา (Advisor)             │
  └─ นศ. ต่างสาขา / ต่างคณะ / บุคลากร / ภายนอก ──► หัวหน้าสาขาวิชาวิศวกรรมโยธา           │
     │                                                                                   │
     ▼                                                                                   │
[Stage 2: เจ้าหน้าที่ประจำแผนก (Division Staff)] ──(ข้ามถ้าไม่มีในระบบ)────────────────┤
     │                                                                                   │
     ▼                                                                                   │
[Stage 3: หัวหน้าห้องปฏิบัติการ (Lab Head)] ─────────(ข้ามถ้าไม่มีในระบบ)────────────────┤
     │                                                                                   │
     ▼                                                                                   │
[Stage 4: หัวหน้าตึก / ผู้ดูแลระบบ (Building Admin)] ◄───────────────────────────────────┘
     │ (อนุมัติ + ยืนยัน/ปรับเปลี่ยนวันเริ่มใช้งานและวันนัดหมายสแกนชีวมิติ)
     ▼
[คำขอได้รับการอนุมัติสมบูรณ์ (Approved & Scheduled) — แจ้งอีเมลผู้ขอ]
```

---

## 📧 ระบบอีเมลแจ้งเตือนและการพิจารณา (One-Click Actions)

* **ปุ่มกดอนุมัติ/ปฏิเสธภายในอีเมล (Direct One-Click)**:
  - `✓ อนุมัติคำขอ` (สีเขียว)
  - `✕ ปฏิเสธ` (สีแดง)
  - `🔍 ดูรายละเอียดคำขอ` (เปิดหน้าต่าง Review Modal บนแดชบอร์ดโดยตรง)
* **บทวิเคราะห์และคำแนะนำจาก AI (ORG AI / KKU Gen AI)**:
  - สรุปย่อเนื้องาน ข้อสังเกตความปลอดภัย และคำแนะนำประกอบการตัดสินใจ
  - มีระบบ Fallback อัจฉริยะหาก API ขัดข้อง
* **ปุ่มกลับหน้าหลัก**:
  - ทุกลิงก์ยืนยันและปุ่มกลับสู่ระบบจะนำทางไปยัง **`#dashboard` (แดชบอร์ด)** เสมอ

---

## 📢 ระบบแจ้งเตือนวันหยุดและประกาศปิดห้องอัตโนมัติ (Room Closures Broadcast)

* **ส่งอีเมลแจ้งเตือนอัตโนมัติถึงทุกคนในระบบ**:
  - เมื่อผู้ดูแลระบบกรอกข้อมูลในแท็บชีต `RoomClosures` โดยระบุ `Title` และ `StartDate` หรือ `EndDate`
  - ระบบจะดึงรายชื่ออีเมลทั้งหมดที่มีอยู่ใน Google Sheet (Users, Advisor, DivisionStaff, LabHead, Admin, Rooms, Settings ฯลฯ) ตัดอีเมลซ้ำ และกระจายส่งอีเมลแจ้งเตือนอัตโนมัติ (BCC Batch ละ 40 เพื่อความเป็นส่วนตัวและรองรับข้อจำกัดของระบบ)
  - มีระบบบันทึก `NotifiedAt` เพื่อป้องกันการส่งอีเมลซ้ำซ้อน
  - มีเมนู **📢 ห้องปิด/วันหยุด** บนแถบเมนู Google Sheets สำหรับติดตั้ง Trigger และส่งอีเมลย้อนหลังสำหรับรายการที่ยังไม่ได้ส่งแบบแมนนวล

---

## ⚙️ ค่าตั้งค่าเริ่มต้นของระบบ (Default Settings)

| Config Key | Value | Description |
|---|---|---|
| `SYSTEM_NAME` | `ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน` | ชื่อระบบทางการ |
| `HEAD_OF_CIVIL_ENG_EMAIL` | `lareew@kku.ac.th` | อีเมลหัวหน้าสาขาวิชาวิศวกรรมโยธา |
| `ADMIN_EMAIL` | `pacnim@kku.ac.th` | อีเมลหัวหน้าตึก / ผู้ดูแลระบบ |
| `SMTP_SENDER_NAME` | `ระบบ CE F.A.I.R.` | ชื่อผู้ส่งอีเมลแจ้งเตือน (มีจุดหลัง R) |
| `ORG_API_KEY` | *(เก็บใน Script Properties เท่านั้น)* | KKU Gen AI API Key — ตั้งค่าด้วยตนเองผ่าน Apps Script Editor > Project Settings > Script Properties ห้ามใส่ค่าจริงในไฟล์ซอร์สโค้ดหรือเอกสารใด ๆ |
| `ACCESS_DURATION_MONTHS` | `3` | ระยะเวลาเริ่มต้นของสิทธิ์เข้าใช้งาน (เดือน) |
| `TIMEZONE` | `Asia/Bangkok` | โซนเวลาที่ใช้ประมวลผลวันเวลา |
| `MAINTENANCE_MODE` | `FALSE` | เปิด/ปิดโหมดปิดปรับปรุงระบบ |
| `TOKEN_EXPIRY_DAYS` | `7` | อายุ token สำหรับการอนุมัติ (วัน) |
| `APPROVAL_REMINDER_DAYS` | `3` | จำนวนวันก่อนส่งอีเมลเตือนซ้ำ |
| `LAST_ACCESS_CODE_SEQ` | `0500` | Running Sequence เริ่มที่ 0500; สร้างรหัสถัดไป 0501 และวนจาก 9999 กลับ 0501 |
| `LAST_REQUEST_ID` | `0` | Running Number ของ Request ID |
| `LAST_USER_ID` | `0` | Running Number ของ User ID |
| `DATA_RETENTION_MONTHS` | `12` | ระยะเวลาเก็บข้อมูลตามการตั้งค่าระบบ |

> `ORG_API_KEY` และ secret สำหรับ webhook ต้องเก็บใน **Script Properties เท่านั้น** ห้ามใส่ค่าจริงในชีต `Settings`, ซอร์สโค้ด หรือ commit ลง repository

---

## 📂 โครงสร้างไฟล์ในโปรเจกต์

1. **`Code.gs`**: Backend logic, 10 Sheets Database, One-Click Actions, ORG AI integration, Biometric & Date adjustments
2. **`Index.html`**: Web app container (2 main tabs: Request & Dashboard), preloaded user email injection
3. **`Stylesheet.html`**: Pure CSS สำหรับธีมวิศวกรรมโยธา (Dark Crimson `#661003` & Deep Navy Blue `#183666`) พร้อมสไตล์ Searchable Combobox และ Modal
4. **`JavaScript.html`**: Vue 3 Frontend, Searchable Advisor Dropdown, Auto-formatters, Review Modal, Signature Pad, 4s Dynamic Loading Text และ reusable components (`StatusBadge`, `RoomCard`, `ModalConfirm`, `TimelineStep`, `LoadingSpinner`)
5. **`ReviewModal.html`**: Modal สำหรับตรวจรายละเอียดคำขอและอนุมัติ/ปฏิเสธ โดยไม่แยกเป็น Approve View
6. **`appsscript.json`**: กำหนด runtime, Web App และ OAuth scopes ที่ backend ใช้งานจริง
7. **`.gitignore`**: ป้องกันไฟล์ local configuration, secret และไฟล์ generated ไม่ให้ถูก commit

### ขอบเขต Frontend ที่ยืนยันแล้ว
ระบบคง **Clean 2-Tab Design** เดิม ได้แก่ `ยื่นคำขอ` และ `แดชบอร์ด` ไม่มีการเปลี่ยนเป็น 5 views หรือเพิ่ม hash routing ใหม่ ส่วนการอนุมัติและติดตามสถานะยังใช้ `ReviewModal` ภายในแดชบอร์ด และลิงก์จากอีเมลจะเปิดแดชบอร์ด/โมดัลตามพารามิเตอร์ที่ backend ส่งมา

### การติดตั้งและตรวจสอบ
1. รัน `initDatabase()` หลัง deploy เพื่อสร้าง/เติม headers และค่า Settings ที่ขาด
   - ฟังก์ชันนี้จะเติม metadata columns สำหรับ token security ต่อท้ายชีต `Requests` แบบ backward-compatible
2. ตรวจสอบ Script Properties อย่างน้อย `ORG_API_KEY` หากเปิดใช้ AI (ห้ามใส่ค่าจริงในไฟล์ซอร์สโค้ด)
3. ตั้งค่า `BIOMETRIC_API_URL` และ `BIOMETRIC_WEBHOOK_SECRET` ใน Script Properties เมื่อเชื่อมต่ออุปกรณ์จริง (หากไม่มี secret ระบบจะไม่ส่ง webhook) โดยห้ามเก็บ secret ในชีต `Settings`
4. รัน `setupDailyTriggers()` เพื่อติดตั้ง trigger อัปเดตสถานะ แจ้งเตือน approval และ `applyDataRetentionPolicy()` (ลบรูปของคำขอ Expired/Rejected เกิน `DATA_RETENTION_MONTHS`)
5. หลังแก้ `appsscript.json` ให้ redeploy และยอมรับ OAuth consent ตาม scope ที่ร้องขอ

### Pre-Deploy Validation
รัน `npm run validate` (Node.js) เพื่อตรวจก่อน deploy ทุกครั้ง — ตรวจไฟล์, JSON syntax, Web App access = DOMAIN, ไม่มี secret/public pattern, Q&A = 50, component 5 ตัว, ฟังก์ชันสำคัญ, brace balance และ token metadata headers

### Production Smoke Test Checklist (ก่อน deploy Version จริง)
1. Deploy เวอร์ชันทดสอบ (Test Deployment) ก่อน
2. รัน `initDatabase()` และตรวจ header ครบ
3. ทดสอบส่งอีเมล (ดู Logs sheet)
4. ทดสอบ Calendar integration (Biometric appointment)
5. ทดสอบ Drive upload (`saveApplicantPhoto` — whitelist MIME, จำกัด 5 MB, ชื่อไฟล์สุ่ม)
6. ทดสอบ Webhook (Biometric API)
7. ตรวจ OAuth consent screen ให้ตรง scope ใน `appsscript.json`
8. ตรวจ execution logs ที่ Apps Script Editor แล้วค่อย deploy Version ใหม่

### Data Retention
ฟังก์ชัน `applyDataRetentionPolicy()` ทำงานทุกวันเวลา 02:00 (ผ่าน `setupDailyTriggers()`) ลบไฟล์รูป Drive ของคำขอที่ Expired/Rejected เกิน `DATA_RETENTION_MONTHS` และเคลียร์คอลัมน์ PhotoURL ตามนโยบายเก็บข้อมูล

### Version Control
โครงการนี้ใช้ Git ติดตามการแก้ไข — commit ก่อน/หลังปรับปรุงแต่ละรอบ แยกกิ่ง `development`/`production`, `.gitignore` กัน secret, `.claspignore` แยกไฟล์ docs/test ไม่ให้ถูก push ขึ้น Apps Script (ถ้าเคย commit secret แล้ว ต้อง rotate/revoke ค่านั้นเสมอ)
