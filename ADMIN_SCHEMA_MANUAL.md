# 🏛️ คู่มือผู้ดูแลระบบและเอกสารสถาปัตยกรรมข้อมูล (Administrator & Data Schema Manual)
## ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน (CE F.A.I.R.: Civil Engineering Flow Access Instant Registration)

---

## 📑 สารบัญ
1. [ภาพรวมของระบบและบทบาทผู้ใช้ (System Overview & Roles)](#1-ภาพรวมของระบบและบทบาทผู้ใช้)
2. [ขั้นตอนการอนุมัติ 4 ลำดับขั้น (4-Stage Sequential Approval Flow)](#2-ขั้นตอนการอนุมัติ-4-ลำดับขั้น)
3. [โครงสร้างฐานข้อมูลแบบละเอียดทุกชีตและทุกคอลัมน์ (Detailed Data Schema)](#3-โครงสร้างฐานข้อมูลแบบละเอียดทุกชีตและทุกคอลัมน์)
4. [การทำงานร่วมกับปฏิทิน Google Calendar (เฉพาะวันนัดแสกน Biometric)](#4-การทำงานร่วมกับปฏิทิน-google-calendar)
5. [การเชื่อมต่อ API / Webhook กับเครื่องสแกนชีวมิติ (Biometric Hardware Integration)](#5-การเชื่อมต่อ-api--webhook-กับเครื่องสแกนชีวมิติ)
6. [ขั้นตอนการคัดลอกระบบไปใช้กับอาคาร/ห้องปฏิบัติการอื่น (Deployment Guide)](#6-ขั้นตอนการคัดลอกระบบไปใช้กับอาคารห้องปฏิบัติการอื่น)
7. [ความปลอดภัย Token, Data Retention และการตรวจก่อน Deploy](#7-ความปลอดภภ-token-data-retention-และการตรวจกองน-deploy)

---

### 1. ภาพรวมของระบบและบทบาทผู้ใช้
ระบบ **CE F.A.I.R. (Civil Engineering Flow Access Instant Registration)** พัฒนาขึ้นเพื่อจัดการคำขอเข้าใช้งานห้องปฏิบัติการนอกเวลาปฏิบัติงาน (ผู้ใช้สามารถเข้าใช้ห้องได้ตลอด 24 ชั่วโมง ระยะเวลาสิทธิ์การเข้าใช้ 3 เดือน) แบบไร้กระดาษ 100% พร้อมระบบวิเคราะห์ความปลอดภัยด้วย AI และผสานการทำงานกับ Google Sheets, Google Calendar และระบบควบคุมการเข้า-ออกประตู (Access Control).

#### บทบาทในระบบ (User Roles)
| บทบาท | หน้าที่และความรับผิดชอบ |
| :--- | :--- |
| **Applicant (ผู้ยื่นคำขอ)** | นักศึกษา (ป.ตรี/โท/เอก), บุคลากร หรือบุคคลภายนอก ยื่นคำขอพร้อมแนบภาพถ่าย |
| **Advisor (อาจารย์ที่ปรึกษา)** | ผู้อนุมัติขั้นตอนที่ 1 สำหรับนักศึกษาภาควิชา |
| **Head of Civil Eng (หัวหน้าสาขาวิชา)** | ผู้อนุมัติขั้นตอนที่ 1 โดยอัตโนมัติ ในกรณีที่ผู้ขอเป็นบุคคลภายนอก/ต่างสาขา |
| **Division Staff (เจ้าหน้าที่ประจำแผนก)** | ผู้อนุมัติขั้นตอนที่ 2 ตรวจสอบความพร้อมของวัสดุ อุปกรณ์ และความปลอดภัย |
| **Lab Head (หัวหน้าห้องปฏิบัติการ)** | ผู้อนุมัติขั้นตอนที่ 3 ตรวจสอบตารางการใช้ห้อง เครื่องมือเฉพาะทาง และความเหมาะสม |
| **Admin (หัวหน้าอาคาร / ผู้ดูแลระบบ)** | ผู้อนุมัติขั้นตอนที่ 4 (ขั้นสุดท้าย) ยืนยันวันนัดหมายสแกนนิ้ว/ใบหน้า และบันทึกนัดหมายลงปฏิทิน |

---

### 2. ขั้นตอนการอนุมัติ 4 ลำดับขั้น
```
[ ผู้ยื่นคำขอ Submit ] ──> [ AI ตรวจสอบ & สร้าง Access Code ]
                                 │
                                 ▼
                    [ ขั้นตอนที่ 1: Advisor / Head ] ──(อนุมัติ)──┐
                                                                   ▼
                    [ ขั้นตอนที่ 2: Division Staff ] ──(อนุมัติ)──┐
                                                                   ▼
                    [ ขั้นตอนที่ 3: Lab Head ] ───────(อนุมัติ)──┐
                                                                   ▼
                    [ ขั้นตอนที่ 4: Building Admin ] ──(อนุมัติ)──┘
                                 │
             ┌───────────────────┴───────────────────┐
             ▼                                       ▼
  [ บันทึก Google Calendar ]             [ ส่ง Webhook สั่งเปิดสิทธิ์ ]
   (เฉพาะวันนัดแสกน Biometric)              (ไปยังเครื่องสแกนประตู)

---

### 3. โครงสร้างฐานข้อมูลแบบละเอียดทุกชีตและทุกคอลัมน์

#### 3.1 ชีต `Requests` (ตารางบันทึกคำขอทั้งหมด)
| ลำดับคอลัมน์ | ชื่อฟิลด์ (Header) | ประเภทข้อมูล | คำอธิบายรายละเอียด |
| :---: | :--- | :---: | :--- |
| 1 | `RequestID` | String | รหัสคำขอ เช่น `REQ-00001` (สร้างอัตโนมัติผ่าน Atomic Lock) |
| 2 | `Timestamp` | DateTime | วันที่และเวลาที่ส่งคำขอเข้าระบบ |
| 3 | `ApplicantID` | String | รหัสผู้ใช้งาน (เชื่อมโยงกับ Users.UserID) |
| 4 | `ApplicantName` | String | ชื่อ-นามสกุล ของผู้ยื่นคำขอ |
| 5 | `ApplicantEmail` | String | อีเมลของผู้ยื่นคำขอ (ใช้ส่งแจ้งเตือน) |
| 6 | `ApplicantType` | String | ประเภท: `Student`, `Staff`, `External` |
| 7 | `SubmittedByRole`| String | บทบาทขณะยื่นคำขอ เช่น `Applicant`, `Advisor`, `Admin` |
| 8 | `Department` | String | ภาควิชา/สาขาวิชา |
| 9 | `Phone` | String | เบอร์โทรศัพท์ติดต่อ |
| 10 | `RoomID` | String | รหัสห้องที่ขอใช้งาน เช่น `LAB-101` |
| 11 | `RoomName` | String | ชื่อห้องปฏิบัติการ |
| 12 | `Purpose` | String | วัตถุประสงค์การเข้าใช้งาน |
| 13 | `StartDate` | Date | วันที่เริ่มต้นขอเข้าใช้งาน |
| 14 | `EndDate` | Date | วันที่สิ้นสุดการขอเข้าใช้งาน |
| 15 | `AllowedTimeStart`| String | เวลาเริ่มต้นที่อนุญาต เช่น `00:00` |
| 16 | `AllowedTimeEnd` | String | เวลาสิ้นสุดที่อนุญาต เช่น `23:59` |
| 17 | `ParticipantNames`| String | รายชื่อผู้ร่วมปฏิบัติงาน (ต้องมีอย่างน้อย 1 คนตามกฎความปลอดภัย) |
| 18 | `EmergencyContact`| String | ชื่อและเบอร์โทรศัพท์ติดต่อกรณีฉุกเฉิน |
| 19 | `Stage1_ApproverEmail` | String | อีเมลผู้อนุมัติขั้นตอนที่ 1 (Advisor หรือ หัวหน้าสาขา) |
| 20 | `Stage1_Status` | String | สถานะ: `Pending`, `Approved`, `Rejected`, `Skipped` |
| 21 | `Stage1_Date` | DateTime | วันเวลาที่ผู้อนุมัติขั้นที่ 1 ดำเนินการ |
| 22 | `Stage1_Note` | String | บันทึกความเห็นหรือเหตุผลการปฏิเสธของขั้นที่ 1 |
| 23 | `Stage1_Token` | String | Secure Token ประจำขั้นที่ 1 สำหรับ Approve ผ่านลิงก์อีเมล |
| 24 | `Stage1_ReminderSentAt` | DateTime | วันเวลาที่ส่งอีเมลเตือนครั้งล่าสุด |
| 25 | `Stage2_ApproverEmail` | String | อีเมลเจ้าหน้าที่ประจำแผนก (Division Staff) |
| 26 | `Stage2_Status` | String | สถานะขั้นที่ 2: `Pending`, `Approved`, `Rejected`, `Skipped` |
| 27 | `Stage2_Date` | DateTime | วันเวลาที่ผู้อนุมัติขั้นที่ 2 ดำเนินการ |
| 28 | `Stage2_Note` | String | บันทึกความเห็นของขั้นที่ 2 |
| 29 | `Stage2_Token` | String | Secure Token ประจำขั้นที่ 2 |
| 30 | `Stage2_ReminderSentAt` | DateTime | วันเวลาที่ส่งอีเมลเตือนขั้นที่ 2 |
| 31 | `Stage3_ApproverEmail` | String | อีเมลหัวหน้าห้องปฏิบัติการ (Lab Head) |
| 32 | `Stage3_Status` | String | สถานะขั้นที่ 3: `Pending`, `Approved`, `Rejected`, `Skipped` |
| 33 | `Stage3_Date` | DateTime | วันเวลาที่ผู้อนุมัติขั้นที่ 3 ดำเนินการ |
| 34 | `Stage3_Note` | String | บันทึกความเห็นของขั้นที่ 3 |
| 35 | `Stage3_Token` | String | Secure Token ประจำขั้นที่ 3 |
| 36 | `Stage3_ReminderSentAt` | DateTime | วันเวลาที่ส่งอีเมลเตือนขั้นที่ 3 |
| 37 | `Stage4_ApproverEmail` | String | อีเมลหัวหน้าตึก/Admin ผู้ดูแลระบบ |
| 38 | `Stage4_Status` | String | สถานะขั้นที่ 4: `Pending`, `Approved`, `Rejected` |
| 39 | `Stage4_Date` | DateTime | วันเวลาที่อนุมัติขั้นที่ 4 |
| 40 | `Stage4_Note` | String | บันทึกความเห็นของ Admin |
| 41 | `Stage4_Token` | String | Secure Token ประจำขั้นที่ 4 |
| 42 | `Stage4_ReminderSentAt` | DateTime | วันเวลาที่ส่งอีเมลเตือนขั้นที่ 4 |
| 43 | `BiometricAppointmentDate` | DateTime | วันและเวลาที่นัดหมายมาสแกนลายนิ้วมือ/ใบหน้า |
| 44 | `BiometricStatus` | String | สถานะชีวมิติ: `Pending`, `Scheduled`, `Completed` |
| 45 | `CurrentStage` | Number | ขั้นตอนปัจจุบัน (1-4) |
| 46 | `OverallStatus` | String | สถานะรวม: `InReview`, `Approved`, `Rejected`, `Active`, `Expired` |
| 47 | `SignatureData` | String | คอลัมน์สำรอง (Legacy) — คงไว้เพื่อรักษาตำแหน่งคอลัมน์ถัดไป (index alignment) ไม่ถูกเขียนหรืออ่านโดยโค้ดในปัจจุบัน |
| 48 | `PhotoURL` | String | URL รูปถ่ายหน้าตรง (ชื่อไฟล์สุ่ม `IMG_<uuid>`, จำกัด 5 MB, whitelist JPEG/PNG/WebP, ไม่เปิดเผยแขวดข้อมูลในชื่อไฟล์) |
| 49 | `RequestToken` | String | Secure Token สำหรับผู้ยื่นคำขอใช้เปิดดู Tracking Modal |
| 50 | `Stage1_TokenUsedAt` | DateTime | **(Token Security)** วันเวลาที่ Token ขั้น 1 ถูกใช้ครั้งแรก (ใช้ได้ 1 ครั้งเท่านั้น) |
| 51 | `Stage1_TokenFailedAttempts` | Number | จำนวนครั้งที่วิเคราะห์ Token ขั้น 1 ล้มเหลว (ล็อกเมื่อครบ 5 ครั้ง) |
| 52 | `Stage1_TokenLastFailedAt` | DateTime | เวลาตัด Token ขั้น 1 ล้มเหลวล่าสุด |
| 53 | `Stage2_TokenUsedAt` | DateTime | Token ขั้น 2 ถูกใช้แล้ว |
| 54 | `Stage2_TokenFailedAttempts` | Number | จำนวนครั้งล้มเหลวของ Token ขั้น 2 |
| 55 | `Stage2_TokenLastFailedAt` | DateTime | เวลาล้มเหลวล่าสุดขั้น 2 |
| 56 | `Stage3_TokenUsedAt` | DateTime | Token ขั้น 3 ถูกใช้แล้ว |
| 57 | `Stage3_TokenFailedAttempts` | Number | จำนวนครั้งล้มเหลวของ Token ขั้น 3 |
| 58 | `Stage3_TokenLastFailedAt` | DateTime | เวลาล้มเหลวล่าสุดขั้น 3 |
| 59 | `Stage4_TokenUsedAt` | DateTime | Token ขั้น 4 ถูกใช้แล้ว (สำหรับเส้น Approve/Reject) |
| 60 | `Stage4_TokenFailedAttempts` | Number | จำนวนครั้งล้มเหลวของ Token ขั้น 4 |
| 61 | `Stage4_TokenLastFailedAt` | DateTime | เวลาล้มเหลวล่าสุดขั้น 4 |

---

#### 3.2 ชีต `Users` (ฐานข้อมูลผู้ลงทะเบียน)
| คอลัมน์ | ชื่อฟิลด์ | คำอธิบาย |
| :---: | :--- | :--- |
| 1-5 | `UserID`, `FullName`, `Age`, `PersonType`, `StaffType` | รหัสผู้ใช้, ชื่อ, อายุ, ประเภทบุคคล (`Student`/`Staff`/`External`), สายงาน (`Academic`/`Support`) |
| 6-10 | `StudentID`, `Phone`, `Email`, `Department`, `Faculty` | รหัสนักศึกษา, เบอร์โทร, อีเมล, ภาควิชา, คณะ |
| 11-15 | `Division`, `DegreeLevel`, `ExternalOrg`, `ProjectTopic`, `Justification` | แผนก (1-7), ระดับการศึกษา (`Bachelor`/`Master`/`Doctoral`), หน่วยงานภายนอก, หัวข้อวิจัย, ความจำเป็น |
| 16-20 | `AccessCode`, `PhotoURL`, `Status`, `CreatedAt`, `ConsentDate` | รหัส Access Code 6 หลัก, ลิงก์รูปภาพ, สถานะบัญชี, วันที่สร้าง, วันที่กดยินยอมข้อตกลงการใช้งาน |

#### 3.3 ชีต `Rooms` (รายการห้องปฏิบัติการ)
| คอลัมน์ | ชื่อฟิลด์ | คำอธิบาย |
| :---: | :--- | :--- |
| 1-5 | `RoomID`, `RoomName`, `Building`, `Floor`, `Capacity` | รหัสห้อง, ชื่อห้อง, อาคาร, ชั้นที่ตั้ง, ความจุสูงสุด (คน) |
| 6-10 | `Facilities`, `LabHeadEmail`, `ApproverEmail`, `ImageURL`, `Status` | รายการอุปกรณ์/เครื่องมือ, อีเมลหัวหน้าห้องแล็บ, อีเมลเจ้าหน้าที่ดูแล, รูปห้อง, สถานะห้อง (`Active`/`Inactive`) |

#### 3.4 ชีต `Settings` (การตั้งค่าระบบ)
| Key | Default Value | คำอธิบาย |
| :--- | :--- | :--- |
| `ADMIN_EMAIL` | `pacnim@kku.ac.th` | อีเมล Admin กลางผู้ดูแลระบบและรับปฏิทินนัดหมาย |
| `HEAD_OF_CIVIL_ENG_EMAIL` | `lareew@kku.ac.th` | อีเมลหัวหน้าสาขาวิชา (อนุมัติขั้น 1 กรณีเด็กนอกสาขา/บุคคลภายนอก) |
| `BIOMETRIC_API_URL` | *(ตั้งค่าเมื่อเชื่อมต่ออุปกรณ์จริง)* | Webhook URL ของเซิร์ฟเวอร์ควบคุมเครื่องสแกน Biometric |
| `BIOMETRIC_WEBHOOK_SECRET`| *(เก็บใน Script Properties เท่านั้น)* | Secret Token ป้องกันความปลอดภัยการยิง API รับส่งข้อมูล |
| `REQUEST_ID_PREFIX` | `REQ-` | คำนำหน้าเลขที่คำขอ |
| `ACCESS_DURATION_MONTHS` | `3` | ระยะเวลาเริ่มต้นของสิทธิ์เข้าใช้งาน (เดือน) |
| `TIMEZONE` | `Asia/Bangkok` | โซนเวลาที่ระบบใช้ประมวลผล |
| `MAINTENANCE_MODE` | `FALSE` | เปิด/ปิดโหมดปิดปรับปรุง |
| `TOKEN_EXPIRY_DAYS` | `7` | อายุ token สำหรับอนุมัติ (วัน) |
| `APPROVAL_REMINDER_DAYS` | `3` | จำนวนวันก่อนระบบส่งอีเมลแจ้งเตือนซ้ำ |
| `LAST_ACCESS_CODE_SEQ` | `0500` | Running Sequence เริ่มที่ 0500; รหัสถัดไปเริ่ม 0501 และวนจาก 9999 กลับ 0001 |
| `LAST_REQUEST_ID` | `0` | Running Number ของ Request ID |
| `LAST_USER_ID` | `0` | Running Number ของ User ID |
| `DATA_RETENTION_MONTHS` | `12` | ระยะเวลาเก็บข้อมูลตามการตั้งค่าระบบ |

#### 3.5 ชีต `RoomClosures` (วันหยุด / ประกาศปิดห้องปฏิบัติการ)
ใช้ประกาศวันหยุดนักขัตฤกษ์หรือวันปิดห้อง โดยเมื่อกรอกข้อมูลครบ ระบบจะ **ส่งอีเมลไปยังทุกอีเมลที่ปรากฏใน Google Sheet ทั้งหมด** โดยอัตโนมัติ

| คอลัมน์ | ชื่อฟิลด์ | คำอธิบายและวิธีกรอก |
| :---: | :--- | :--- |
| A | `ClosureID` | รหัสปิดห้อง เช่น `CLS-0001` (จะกรอกหรือเว้นว่างก็ได้) |
| B | `Title` | หัวข้อประกาศ เช่น `วันหยุดนักขัตฤกษ์ 1 มกราคม 2569` **จำเป็นต้องกรอก** |
| C | `Description` | รายละเอียดเพิ่มเติม (ไม่บังคับ) |
| D | `StartDate` | วันที่เริ่มปิด (เช่น `01/01/2569`) **กรอกอย่างน้อยวันเริ่มหรือวันสิ้นสุด** |
| E | `EndDate` | วันที่สิ้นสุดการปิด |
| F | `AffectedRoomIDs` | รหัสห้องที่ได้รับผลกระทบ เช่น `LAB-101, LAB-102` หรือ `ALL` |
| G | `CreatedBy` | ผู้บันทึกประกาศ |
| H | `CreatedAt` | เวลาที่บันทึก |
| I | `Status` | สถานะ เช่น `Active` |
| J | `NotifiedAt` | **ระบบเติมอัตโนมัติ** เมื่อส่งอีเมลแล้ว (ไม่ต้องกรอก) |

**ขั้นตอนใช้งาน**
1. เปิด Google Sheet > แท็บ `RoomClosures` (ชื่อเต็มของชีตที่เรียกกันว่า "RoomCloser")
2. รัน `initDatabase()` หนึ่งครั้ง หรือเปิดเมนู **📢 ห้องปิด/วันหยุด > ติดตั้งการแจ้งเตือนอีเมลอัตโนมัติ** เพื่อติดตั้ง Trigger
3. กรอกแถวใหม่โดยกรอก `Title` + `StartDate`/`EndDate` ให้ครบ
4. ระบบจะส่งอีเมลแจ้งเตือนไปยังทุกอีเมลที่ปรากฏในชีตทั้งหมด (Users, Advisor, DivisionStaff, LabHead, Admin, Rooms, Settings ฯลฯ) โดยตัดอีเมลซ้ำอัตโนมัติ แล้วบันทึกเวลาส่งลงคอลัมน์ `NotifiedAt`

> กรณีต้องการส่งรายการที่ยังไม่ได้ส่งซ้ำเอง ใช้เมนู **📢 ห้องปิด/วันหยุด > ส่งอีเมลรายการที่ยังไม่ได้ส่ง**

---

### 4. การทำงานร่วมกับปฏิทิน Google Calendar (เฉพาะวันนัดแสกน Biometric)
เมื่อคำขอได้รับการอนุมัติในขั้นตอนที่ 4 (Building Admin Approved) ระบบจะทำการ:
1. ดึงข้อมูลวันเวลานัดหมาย `BiometricAppointmentDate`
2. สร้าง Google Calendar Event **เฉพาะช่วงเวลานัดหมายสแกนชีวมิติ** ลงในปฏิทินของ Admin อัตโนมัติ (ความยาว 30 นาทีต่อรอบ)
3. ส่งอีเมลเทียบเชิญ (Calendar Invitation) ไปยังอีเมลของผู้ยื่นคำขอโดยตรง

---

### 5. การเชื่อมต่อ API / Webhook กับเครื่องสแกนชีวมิติ
#### 5.1 Push Event (Apps Script ➔ Biometric Gateway)
```json
POST {BIOMETRIC_API_URL}
Content-Type: application/json

{
  "event": "USER_APPROVED",
  "requestId": "REQ-00012",
  "accessCode": "310012",
  "fullName": "นายสมศักดิ์ รักเรียน",
  "studentId": "653040123-4",
  "startDate": "2026-09-01",
  "endDate": "2026-11-30",
  "roomId": "LAB-101",
  "secretToken": "<อ่านจาก Script Properties ของระบบผู้ส่ง>"
}
```

#### 5.2 Pull/Receive Event (Biometric Gateway ➔ Apps Script `doPost`)
```json
POST {WEB_APP_URL}
Content-Type: application/json

{
  "event": "DOOR_ACCESS_LOG",
  "accessCode": "310012",
  "roomId": "LAB-101",
  "accessResult": "Granted",
  "deviceId": "READER-DOOR-01",
  "secretToken": "<อ่านจาก Script Properties ของระบบผู้ส่ง>"
}
```

---

### 6. ขั้นตอนการคัดลอกระบบไปใช้กับอาคาร/ห้องปฏิบัติการอื่น
1. สร้าง Google Spreadsheet ใหม่ แล้วเปิด **ส่วนขยาย (Extensions)** > **Apps Script**
2. คัดลอกไฟล์ทั้งหมด (`Code.gs`, `Index.html`, `ReviewModal.html`, `JavaScript.html`, `Stylesheet.html`, `appsscript.json`) ไปวาง และตรวจสอบ `.gitignore` หากใช้ Git
3. รันฟังก์ชัน `initDatabase()` เพื่อสร้างชีตทั้ง 10 แท็บพร้อม Header
4. แก้ไขข้อมูลในชีต `Rooms`, `Advisor`, `DivisionStaff`, `LabHead`, `Admin` และ `Settings` ให้เป็นของหน่วยงานใหม่
5. ตั้งค่า `ORG_API_KEY` และเมื่อเปิดใช้งานอุปกรณ์ให้ตั้ง `BIOMETRIC_API_URL` กับ `BIOMETRIC_WEBHOOK_SECRET` ใน **Project Settings > Script Properties** (ห้ามใส่ค่าจริงในเอกสารหรือซอร์สโค้ด)
6. กด **Deploy > New Deployment > Web App (Execute as: User accessing the web app, Access: Anyone with the link)** แล้วนำ URL ไปใช้งานได้ โดยผู้ใช้ต้องเข้าสู่ระบบด้วย Google Account ก่อนใช้งาน (การเขียนข้อมูลยังต้องผ่านการยืนยันตัวตนตามบัญชีที่เข้าสู่ระบบ)
```

---

### 7. ความปลอดภัย Token, Data Retention และการตรวจก่อน Deploy
1. **Token แบบครั้งเดียว (One-Time):** `verifyToken()` มาร์ค `StageN_TokenUsedAt` เมื่อสำเร็จ และปฏิเสธการใช้ซ้ำ — บินด์อีเมลผู้อนุมัติตามขั้น และล็อกเมื่อวิเคราะห์ล้มเหลว 5 ครั้งต่อ stage (ตรวจจาก `FailedAttempts`/`LastFailedAt`)
2. **Masked logging:** ทุก log ที่เกี่ยวกับ token ใช้ `maskToken()` เหลือแค่ 4 ตัวหน้า/ท้าย ไม่แสดงค่าเต็มใน Logs sheet
3. **รูปถ่ายปลอดภัย:** `saveApplicantPhoto()` ตรวจ MIME type จริง (JPEG/PNG/WebP only), จำกัด 5 MB ฝั่ง Backend, ตั้งชื่อไฟล์สุ่ม และไม่เปิด Public Link
4. **Data Retention:** `applyDataRetentionPolicy()` ทำงานทุกวันเวลา 02:00 (ผูกใน `setupDailyTriggers()`) ลบไฟล์รูปของคำขอ `Expired`/`Rejected` ที่เก่าเกิน `DATA_RETENTION_MONTHS` และเคลียร์ PhotoURL
5. **Validation:** รัน `node validate.js` หรือ `npm run validate` ตรวจความผิดพลาด/ความปลอดภัยก่อน clasp deploy ทุกครั้ง
6. **Version Control:** commit ทีละรอบด้วย Git, แยก branch `development`/`production`, ใช้ `.gitignore`/`.claspignore` คั้น secret — หากเคย commit secret ไปแล้วต้อง rotate/revoke เสมอ