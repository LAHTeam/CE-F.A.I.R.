# 🖥️ Setup เครื่องใหม่ — CE F.A.I.R.

คู่มือนี้ใช้สำหรับตั้งค่าเครื่องคอมพิวเตอร์เครื่องใหม่ให้กลับมาทำงานกับโปรเจกต์
**CE F.A.I.R. (ระบบขออนุมัติเข้าใช้ห้องปฏิบัติการสาขาวิชาวิศวกรรมโยธานอกเวลาปฏิบัติงาน)**
ได้ครบ 100% ภายในครั้งเดียว

> 💡 โค้ดทั้งหมดถูกเก็บไว้บน GitHub แล้ว ไม่ต้องสร้างงานใหม่
> เพียงติดตั้งเครื่องมือ แล้ว `git clone` ทุกอย่างจะกลับมาเหมือนเดิม

---

## 📦 ส่วนที่ 1 — ติดตั้งโปรแกรม (ครั้งเดียว)

ติดตั้งตามลำดับต่อไปนี้:

| # | โปรแกรม | ลิงก์ / คำสั่ง | หมายเหตุ |
|---|---|---|---|
| 1 | **VS Code** | https://code.visualstudio.com/ | เลือก "Add to PATH" ตอนติดตั้ง |
| 2 | **Git** | https://git-scm.com/downloads | ใช้ Git Bash ที่แถมมา |
| 3 | **Node.js + npm** | https://nodejs.org/ | เลือกเวอร์ชัน LTS |
| 4 | **Google clasp** | `npm i -g @google/clasp` | ใช้ push โค้ดขึ้น Apps Script |
| 5 | **Cline** (VS Code extension) | Marketplace → ค้น "Cline" | AI agent ที่ใช้พัฒนา |

ตรวจสอบว่าติดตั้งครบ:

```bash
git --version
node -v
npm -v
clasp --version
```

---

## 🔑 ส่วนที่ 2 — สร้าง credentials (ทำใหม่ทุกเครื่อง)

ข้อมูล login เหล่านี้ **ไม่ถูก sync ผ่าน git** จึงต้อง setup ใหม่:

### 2.1 SSH key สำหรับ GitHub
Remote ของโปรเจกต์นี้ใช้ SSH (`git@github.com:...`):

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
# กด Enter ผ่านไปได้ (เก็บที่ default path)
cat ~/.ssh/id_ed25519.pub
```

คัดลอก public key ไปวางที่:
**GitHub → Settings → SSH and GPG keys → New SSH key**

ทดสอบ:

```bash
ssh -T git@github.com
# ควรแสดง: Hi <username>! You've successfully authenticated...
```

> ⚠️ ถ้าไม่อยากใช้ SSH ให้เปลี่ยน remote เป็น HTTPS + Personal Access Token แทน
> แต่แนะนำ SSH เพราะใช้คำสั่งเดิมได้เลย

### 2.2 Google clasp login
```bash
clasp login
```
จะเปิด browser ให้ authorize — เข้าด้วยบัญชี Google ที่เป็นเจ้าของ/ผู้ร่วมแก้ไข
Apps Script ตัวนี้ (หรือ bัญชีที่เคย Deploy ไว้)

---

## 📥 ส่วนที่ 3 — โคลนโปรเจกต์

```bash
cd ~/Documents
git clone git@github.com:LAHTeam/CE-F.A.I.R..git
cd CE-F.A.I.R.
```

สิ่งที่ได้กลับมาเหมือนเดิม:

- `Code.gs`, `Index.html`, `JavaScript.html`, `ReviewModal.html`, `Stylesheet.html`
- `appsscript.json` (กำหนด Web App + OAuth scopes)
- `.clasp.json` ← **มี `scriptId` ชี้ไปที่ GAS script ตัวเดิมแล้ว ไม่ต้องสร้างใหม่**
- `.claspignore` ← กันไม่ให้ push ไฟล์ docs/test ขึ้น Apps Script
- `validate.js`, `package.json`, `README.md` และไฟล์ docs ทั้งหมด

---

## ✅ ส่วนที่ 4 — ตรวจสอบก่อน deploy

```bash
npm run validate
```

ต้องผ่านทุกข้อ (PASS ทั้งหมด) ก่อน push — ตรวจไฟล์ครบ, JSON syntax, Web App access,
ไม่มี secret, Q&A = 50, component ครบ, ฟังก์ชันสำคัญ, brace balance, token headers

---

## 🚀 ส่วนที่ 5 — Push โค้ดขึ้น Apps Script

```bash
clasp push
```

> ถ้า `clasp` ไม่ถูก add เข้า PATH ให้ใช้คำสั่งเต็ม:
> ```bash
> node "$(npm root -g)/@google/clasp/build/src/index.js" push
> ```

จะ push เฉพาะ 6 ไฟล์ (ตาม `.claspignore`):
`appsscript.json`, `Code.gs`, `Index.html`, `JavaScript.html`, `ReviewModal.html`, `Stylesheet.html`

---

## 🌐 ส่วนที่ 6 — ตั้งค่าใน Apps Script Editor (ทำครั้งเดียวหลัง push แรก)

เปิด editor ผ่าน `clasp open` หรือเข้า https://script.google.com แล้วเลือก script ตัวเดิม

### 6.1 รันฟังก์ชันตั้งค่า (ต้อง authorize แบบ interactive)

1. เปิด Apps Script Editor
2. เลือก dropdown ข้างปุ่ม Run → เลือก `initDatabase` → ▶️ Run → อนุญาตสิทธิ์
   (สร้าง/เติม headers และค่า Settings ที่ขาด)
3. เลือก `setupDailyTriggers` → ▶️ Run → อนุญาตสิทธิ์
   (ติดตั้ง trigger ประจำวัน: อัปเดตสถานะ, แจ้งเตือน approval, ลบข้อมูลเก่า)

> ⚠️ การสร้าง trigger แบบ time-based **ต้องกด Run ใน Editor เท่านั้น**
> (ไม่สามารถทำผ่าน clasp push หรือจากภายนอกได้ เพราะต้อง authorize interactive)

### 6.2 ตั้งค่า Script Properties (ถ้ายังไม่มี)

เข้า **Project Settings → Script Properties** แล้วเพิ่ม:

| Key | ค่า | หมายเหตุ |
|---|---|---|
| `ORG_API_KEY` | (ค่า API จริง) | สำหรับ KKU IntelSphere AI — ห้ามใส่ค่าจริงลงซอร์สโค้ด |
| `BIOMETRIC_API_URL` | (URL อุปกรณ์) | เมื่อเชื่อมอุปกรณ์ Biometric จริง |
| `BIOMETRIC_WEBHOOK_SECRET` | (secret) | ห้ามเก็บในชีต Settings |

### 6.3 Deploy เป็น Web App

1. **Deploy → New deployment**
2. Type = **Web app**
3. Execute as = **User accessing the web app**
4. Who has access = **Anyone with the link (ANYONE)** — ตรงกับ `appsscript.json`
5. กด Deploy → คัดลอก `/exec` URL ไปใช้/แจก

> ทุกครั้งที่แก้ `appsscript.json` ต้อง Deploy ใหม่ และยอมรับ OAuth consent ตาม scope ที่ขอ

---

## 📋 ส่วนที่ 7 — Workflow ทำงานจริง (หลัง setup เสร็จ)

```bash
# 1) แก้โค้ดใน VS Code

# 2) ตรวจก่อน push
npm run validate

# 3) push ขึ้น Apps Script
clasp push

# 4) (ถ้าแก้โค้ดสำคัญ) commit + push ขึ้น GitHub
git add Code.gs Index.html JavaScript.html ReviewModal.html Stylesheet.html
git commit -m "describe your change"
git push origin HEAD:main
```

> หมายเหตุ branch: ทั้ง local และ remote ใช้ชื่อ `main`
> จึงใช้ `git push origin main`

---

## 🔍 การแก้ปัญหาที่พบบ่อย

| ปัญหา | วิธีแก้ |
|---|---|
| `clasp push` ค้าง / timeout | รันแบบ background แล้วอ่านผลจากไฟล์ หรือรอให้เสร็จ (ใช้เวลาราว 5 นาที) |
| `git push` ขึ้น `upstream branch does not match` | ใช้ `git push origin HEAD:main` |
| `clasp login` ไม่เปิด browser | รันใน terminal ธรรมดา (ไม่ใช่ใน VS Code integrated terminal บางกรณี) หรือใช้ `clasp login --no-localhost` |
| SSH ไม่ authenticate | ตรวจ `ssh -T git@github.com` และยืนยัน public key ถูก add ใน GitHub |
| `npm run validate` FAIL brace balance | ตรวจว่ามี `1)` `2)` ใน prompt/comment หรือไม่ — ใช้ `1.` `2.` แทน (ตัว validator นับ `()` แบบ naive) |

---

## ✅ Checklist สรุป

- [ ] ติดตั้ง VS Code, Git, Node.js, clasp, Cline
- [ ] สร้าง SSH key → add ใน GitHub
- [ ] `clasp login`
- [ ] `git clone git@github.com:LAHTeam/CE-F.A.I.R..git`
- [ ] `npm run validate` ผ่าน
- [ ] `clasp push` สำเร็จ
- [ ] `initDatabase()` + `setupDailyTriggers()` (authorize)
- [ ] ตั้งค่า Script Properties
- [ ] Deploy เป็น Web App (ANYONE)
