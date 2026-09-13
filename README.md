# 🏫 School System

A full-featured school management platform designed to centralize academic management, communication, administration, AI assistance, system monitoring, and security into one application.

The system combines a web-based school management interface with a Node.js/Express backend, PostgreSQL database, and local AI powered by Ollama.

> **Current Version: V162**

---

## ✨ Features

### 👥 Account & User Management

* Student, teacher, parent, and administrator accounts
* Role-based permissions
* Account suspension and management
* Secure authentication using JWT
* Password hashing with bcrypt
* Login and session tracking
* Active-user monitoring
* Account activity history

### 📚 Academic Management

* Student management
* Class and homeroom management
* Teacher/staff management
* Subject management
* Grades and report cards
* Gradebooks
* Assignments
* Student submissions
* Class notes
* Academic records

### 📅 Attendance & School Operations

* Attendance management
* Class information
* School announcements
* Events and school information
* Student and staff information

### 💬 Forums & Communication

* School forums
* Forum categories
* Threads and replies
* User profiles and avatars
* Moderation controls
* Content filtering
* Administrative oversight

### 🤖 AI Assistant

The system includes a locally hosted AI assistant powered by **Ollama**.

Features include:

* AI-powered school assistant
* Local AI processing
* AI model monitoring
* Automatic model selection
* Model availability detection
* Automatic model switching
* Parameter-size detection
* Vision-model routing
* AI translation
* AI-powered document analysis
* AI chat attachments
* AI system diagnostics

The AI Monitor checks the models Ollama actually reports as installed instead of relying solely on a predefined model list. This allows the system to resolve models such as `qwen3:8b` or other installed parameter sizes dynamically.

### 🧠 Supported AI Model Families

The current AI Monitor is designed around model families including:

* `deepseek-r1`
* `gemma4`
* `llama3`
* `llama3.2`
* `phi4-mini`
* `qwen2.5-coder`
* `qwen2.5vl`
* `qwen2-math`
* `qwen3`
* `qwen3.5`

The system detects the actual installed tags and parameter sizes reported by Ollama.

---

## 📎 AI File & Document Support

AI Chat supports file and image attachments.

Supported document extraction includes:

* PDF
* DOCX
* XLSX
* XLS

Archives can also be processed, including:

* ZIP
* TAR
* GZ
* TGZ
* TAR.GZ

The system extracts usable text and file information before passing it to the AI.

Images can be automatically routed to a vision-capable model when required.

The current attachment limit is **1 GB**.

---

## 🛡️ Security

Security is built into the application at both the API and application levels.

Current security features include:

* JWT authentication
* bcrypt password hashing
* Role-based authorization
* Admin-only management actions
* API authentication
* Request rate limiting
* Security headers
* Content Security Policy
* Clickjacking protection
* MIME-sniffing protection
* Referrer policy
* Permissions policy
* HTTPS-aware HSTS
* XSS escaping
* Restricted bootstrap initialization
* Protected database operations
* Archive extraction limits

The V162 security work also added authorization around sensitive resources such as grades, assignments, submissions, account data, moderation configuration, and audit history.

---

## 📊 System Monitoring

Administrators have access to dedicated system monitoring tools.

### System Health

The system can monitor:

* Server uptime
* Memory usage
* Node.js version
* Process ID
* Platform information
* Database health
* PostgreSQL latency
* Database size
* Connection counts
* Blocked database locks
* Table sizes and row counts

### Activity Timeline

Administrative system events are recorded in a dedicated timeline, including events such as:

* Logins
* Server startup
* Backups
* Migrations
* Administrative actions
* Other system events

### Error Logging

The system maintains a persistent error log containing:

* Frontend errors
* Server errors
* Error severity
* Stack traces
* Resolution status

Administrators can inspect and resolve recorded errors.

---

## 💾 Backups & Recovery

The system includes built-in database/data backup functionality.

### Automatic Backups

Backups are automatically created:

* Shortly after server startup
* Every 24 hours afterward

Up to **30 automatic backups** are retained, with older backups automatically removed.

Administrators can also:

* Create manual backups
* View existing backups
* Restore backups
* Delete backups

---

## 🔄 Database Migrations

The system includes an administrative migration system.

Administrators can:

* View migrations
* Apply migrations
* Roll back migrations when supported
* Track migration history

Migration actions are logged for accountability.

---

## 🌍 Language & Personalization

The application supports per-account preferences, including:

* Language selection
* Dark mode
* Persistent translation memory
* Automatic translation of dynamically generated content

Preferences are stored per account rather than being shared between users on the same device.

---

## 🏗️ Architecture

```text
┌──────────────────────────────┐
│          Web Client          │
│        HTML / CSS / JS       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│      Node.js / Express       │
│          REST API            │
└──────────┬───────────┬───────┘
           │           │
           ▼           ▼
┌────────────────┐  ┌───────────────┐
│   PostgreSQL   │  │    Ollama     │
│    Database    │  │   Local AI    │
└────────────────┘  └───────────────┘
```

### Core technologies

| Component                 | Technology                |
| ------------------------- | ------------------------- |
| Backend                   | Node.js                   |
| Web Server                | Express.js                |
| Database                  | PostgreSQL                |
| Authentication            | JWT                       |
| Password Security         | bcrypt                    |
| AI                        | Ollama                    |
| Frontend                  | HTML / CSS / JavaScript   |
| Document Processing       | PDF / DOCX / XLSX parsers |
| Archive Processing        | ZIP / TAR / GZ            |
| Environment Configuration | dotenv                    |

The project's current `package.json` confirms Express, PostgreSQL (`pg`), JWT, bcrypt, document-processing libraries, archive-processing libraries, and dotenv as core dependencies.

---

## 📁 Project Structure

```text
School-System/
│
├── index.html
├── 1.css
├── 1.js
│
├── server.js
├── schema.sql
├── seed-data.js
│
├── package.json
├── SETUP.md
│
├── Start_system.bat
├── start_ollama.ps1
│
├── logo.png
├── favicon.png
│
└── .gitignore
```

---

# 🚀 Installation

## Requirements

Before installing the system, make sure you have:

* **Node.js 18+**
* **PostgreSQL 14+**
* **Ollama**
* An Ollama model compatible with your intended AI features

The official setup documentation specifies Node.js 18+ and PostgreSQL 14+.

---

## 1. Clone the Repository

```bash
git clone https://github.com/LiteHere-Dev/School-System.git
cd School-System
```

---

## 2. Create the PostgreSQL Database

Open PostgreSQL and run:

```sql
CREATE DATABASE school_db;

CREATE USER school_user
WITH PASSWORD 'change_me';

GRANT ALL PRIVILEGES
ON DATABASE school_db
TO school_user;

\c school_db

GRANT ALL
ON SCHEMA public
TO school_user;
```

---

## 3. Configure Environment Variables

Create a `.env` file in the project directory.

Example:

```env
DATABASE_URL=postgresql://school_user:change_me@localhost:5432/school_db
JWT_SECRET=your_long_random_secret
PORT=8000
OLLAMA_URL=http://127.0.0.1:11434
```

Generate a secure JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

The repository's setup documentation uses port `8000` for the application and `11434` for the local Ollama service.

---

## 4. Install Dependencies

```bash
npm install
```

---

## 5. Start the System

### Windows

You can launch the complete system using:

```text
Start_system.bat
```

### Manual startup

Alternatively:

```bash
npm start
```

Then open:

```text
http://localhost:8000
```

---

# 🤖 Ollama Setup

Install Ollama separately and make sure the Ollama service is available.

The project includes:

```text
start_ollama.ps1
```

which is used by the Windows launcher to start Ollama and record its session output.

The system communicates with Ollama through the Node.js server rather than requiring the browser to communicate directly with the local AI service.

Example:

```bash
ollama pull llama3.2
```

You can then verify the installed models through the AI Monitor.

---

# 🔌 API

The backend exposes REST API endpoints for system functionality.

Examples include:

```text
GET  /api/system/health
GET  /api/system/db-health
GET  /api/system/timeline
POST /api/system/timeline

GET  /api/system/errors
POST /api/system/errors
PATCH /api/system/errors/:id/resolve
DELETE /api/system/errors/:id

GET  /api/backups
POST /api/backups/run
GET  /api/backups/:id
POST /api/backups/restore/:id
DELETE /api/backups/:id

GET  /api/migrations
POST /api/migrations
POST /api/migrations/:version/rollback

POST /api/documents/parse
```

Access to administrative endpoints is restricted according to the authenticated user's permissions.

---

# 🗄️ Database

The application uses PostgreSQL for persistent storage.

System tables include:

```text
kv_store
system_timeline
error_log
backups
migration_history
```

Database initialization and required system tables can be handled automatically when the server starts.
