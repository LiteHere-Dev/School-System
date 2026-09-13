      // ══════════════════════════════════════════════════════
      // ─── PER-ACCOUNT PREFERENCES (theme, language) ────────
      // Each account's theme/language choice is stored under a key
      // namespaced by that account's user id, so switching accounts
      // on the same device/browser never leaks one person's settings
      // into another's. Falls back to a device-level default (used
      // pre-login, or as a one-time seed for a brand-new account)
      // when the account has never set its own preference.
      // ══════════════════════════════════════════════════════
      function userPrefKey(base) {
        return currentUser ? `pref_${base}_${currentUser.id}` : null;
      }

      // Called right after login (once DB is hydrated). Loads this
      // account's own saved language, if it has one. A brand-new
      // account with no saved preference yet keeps whatever language
      // this device was already showing (localStorage "sms_lang")
      // and that becomes its own saved preference from here on, the
      // moment it changes it via the language modal.
      function initAccountLanguage() {
        const key = userPrefKey("lang");
        if (!key) return;
        const acctLang = DB.get(key);
        if (acctLang) {
          currentLang = acctLang;
        } else {
          DB.set(key, currentLang); // seed the account's own pref
        }
      }

      // ══════════════════════════════════════════════════════
      // ─── DARK MODE ────────────────────────────────────────
      // ══════════════════════════════════════════════════════
      function initDarkMode() {
        let isDark;
        const key = userPrefKey("theme");
        const acctPref = key ? DB.get(key) : null; // true | false | null
        if (acctPref !== null) {
          // This account already has its own saved preference.
          isDark = acctPref === true;
        } else {
          // No per-account preference yet. One-time migration path for
          // installs upgraded from before per-account theming existed:
          // if a legacy shared "darkmode" value is present, adopt it as
          // this account's starting preference (and save it under the
          // account's own key so it's independent from here on).
          const legacy = DB.get("darkmode");
          if (legacy !== null) {
            isDark = legacy === true;
          } else {
            isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          }
          if (key) DB.set(key, isDark);
        }
        if (isDark) {
          document.documentElement.setAttribute("data-theme", "dark");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
        document.querySelectorAll(".dm-toggle").forEach((btn) => {
          btn.textContent = isDark ? "☀️" : "🌙";
        });
      }
      function toggleDarkMode() {
        const isDark =
          document.documentElement.getAttribute("data-theme") === "dark";
        const next = !isDark;
        if (next) {
          document.documentElement.setAttribute("data-theme", "dark");
        } else {
          document.documentElement.removeAttribute("data-theme");
        }
        const key = userPrefKey("theme");
        if (key) {
          // Signed in — save to this account only.
          DB.set(key, next);
        } else {
          // Pre-login (login screen toggle, no account yet) — remember
          // on this device only, so it isn't lost on refresh, but never
          // written to any account.
          localStorage.setItem("sms_theme_device", next ? "dark" : "light");
        }
        document.querySelectorAll(".dm-toggle").forEach((btn) => {
          btn.textContent = isDark ? "🌙" : "☀️";
        });
      }
      // Pre-login device-level theme (login screen only, before any
      // account is involved). Applied immediately so the toggle set on
      // a previous visit survives a refresh; overwritten by
      // initDarkMode() the moment someone actually signs in.
      (function applyDeviceThemeBeforeLogin() {
        const saved = localStorage.getItem("sms_theme_device");
        const isDark = saved
          ? saved === "dark"
          : window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (isDark) document.documentElement.setAttribute("data-theme", "dark");
        document.addEventListener("DOMContentLoaded", () => {
          document.querySelectorAll(".dm-toggle").forEach((btn) => {
            btn.textContent = isDark ? "☀️" : "🌙";
          });
        });
      })();

      // ══════════════════════════════════════════════════════
      // ─── LANGUAGE / TRANSLATION SYSTEM ───────────────────
      // ══════════════════════════════════════════════════════
      const LANGUAGES = {
        en: { label: "🇬🇧 English", name: "English" },
        ss: { label: "🇸🇿 Siswati", name: "Siswati" },
        af: { label: "🇿🇦 Afrikaans", name: "Afrikaans" },
        pt: { label: "🇵🇹 Portuguese", name: "Português" },
        ny: { label: "🌍 Chewa", name: "Chichewa" },
        es: { label: "🇪🇸 Spanish", name: "Español" },
        fr: { label: "🇫🇷 French", name: "Français" },
      };

      // All translatable UI strings — add new keys here, then reference via t()
      const TRANSLATIONS = {
        en: {
          // topbar / nav
          signOut: "Sign out",
          resetPassword: "Reset Password",
          changeLanguage: "Change Language",
          darkMode: "Toggle dark mode",
          // login
          welcomeBack: "Welcome back",
          loginSub: "Sign in to the [School Name] Learning Portal",
          roleStudent: "📚 Student",
          roleTeacher: "🎓 Teacher",
          roleParent: "👨‍👩‍👧 Parent",
          roleAdmin: "🛡 Admin",
          badgeTeacher: "Teacher",
          badgeParent: "Parent",
          badgeAdmin: "Administrator",
          badgeStudent: "Student",
          emailLabel: "Email or ID Number",
          emailPlaceholder: "your@email.com or ID (e.g., 10-0001)",
          passwordLabel: "Password",
          signIn: "Sign In →",
          loginError: "⚠️ Incorrect email/ID or password. Please try again.",
          dbConnected: "Database connected",
          demoCreds: "Demo credentials auto-fill when you select a role tab.",
          newStudent: "New student?",
          createAccount: "Create an account",
          // dashboard
          dashboard: "Dashboard",
          portal: "Portal",
          grades: "Grades",
          report: "Report",
          forums: "Forums",
          admin: "Admin",
          accounts: "Accounts",
          auditLog: "Audit Log",
          aiMonitor: "AI Monitor",
          classes: "Classes",
          homeroom: "Homeroom",
          navOverview: "Overview",
          navStaff: "Staff",
          navMyPortal: "My Portal",
          navGradebook: "Gradebook",
          navMyGrades: "My Grades",
          navChildGrades: "My Child's Grades",
          navSystemHealth: "System Health",
          navBackups: "Backups",
          navMigrations: "Migrations",
          navRecords: "Records",
          // language modal
          selectLanguage: "Select Language",
          languageChanged: "Language updated",
          cancel: "Cancel",
          save: "Save",
          // school facts
          founded: "Founded",
          students: "Students",
          curriculum: "Curriculum",
          // AI widget
          aiTitle: "[School Name] AI",
          aiSub: "Powered by Ollama · Local & Private",
          aiOffline: "Offline",
          aiOnline: "Online",
          aiOfflineBanner: "⚠️ Ollama is not running. Start it with:",
          aiWelcomeTitle: "Your School AI Assistant",
          aiWelcomeText: "Ask me anything about your subjects, grades, or school life.\nAll conversations stay on your device — nothing is sent to the cloud.",
          aiSuggest1: "Explain my grades",
          aiSuggest2: "Trig help",
          aiSuggest3: "Homework help",
          aiSuggest4: "IGCSE tips",
          aiPlaceholder: "Ask me anything…",
          aiChecking: "Checking...",
          aiReady: "Ready",
          aiNoModel: "No model",
          aiLocked: "🔒 Locked",
        },
        ss: {
          signOut: "Phuma",
          resetPassword: "Seta Kabusha Liphasiwedi",
          changeLanguage: "Shintja Lulwimi",
          darkMode: "Shintja imodi emnyama",
          welcomeBack: "Wamukelekile futsi",
          loginSub: "Ngena ku-Portal ya Kufundza ya [School Name]",
          roleStudent: "📚 Umfundzi",
          roleTeacher: "🎓 Umfundzisi",
          roleParent: "👨‍👩‍👧 Umzali",
          roleAdmin: "🛡 Umphathi",
          badgeTeacher: "Thishela",
          badgeParent: "Mtali",
          badgeAdmin: "Umphathi",
          badgeStudent: "Sitshudeni",
          emailLabel: "I-imeyili noma Inombolo ye-ID",
          emailPlaceholder: "i-imeyili yakho noma ID",
          passwordLabel: "Liphasiwedi",
          signIn: "Ngena →",
          loginError: "⚠️ I-imeyili noma liphasiwedi alibonakali. Chwayita futsi.",
          dbConnected: "Idatabase ikhonekitiwe",
          demoCreds: "Imininingwane yedemo igcwala ngekushesha ngesikhatsi ukhetsa indlela.",
          newStudent: "Umfundzi lomusha?",
          createAccount: "Yenta i-akhawunti",
          dashboard: "Ikhasi Lekucala",
          portal: "iPortal",
          grades: "Emagiletsi",
          report: "Umbiko",
          forums: "Imihlangano",
          admin: "Umphathi",
          accounts: "Ema-akhawunti",
          auditLog: "Irekhodi",
          aiMonitor: "Isimonitha se-AI",
          classes: "Emakilasi",
          homeroom: "Ikamelo Lasekhaya",
          navOverview: "Simo Lesijikelele",
          navStaff: "Bafundzisi",
          navMyPortal: "IPortal Yami",
          navGradebook: "Incwadzi Yemagiletsi",
          navMyGrades: "Emagiletsi Ami",
          navChildGrades: "Emagiletsi Engane Yami",
          navSystemHealth: "Simo Lesimayelana Nesistimu",
          navBackups: "Emakhophi Ekulondvolota",
          navMigrations: "Kutfutfukiswa Kwesistimu",
          navRecords: "Emarekhodi",
          selectLanguage: "Khetsa Lulwimi",
          languageChanged: "Lulwimi lushintjile",
          cancel: "Yekela",
          save: "Londvolota",
          founded: "Yasungulwa",
          students: "Bafundzi",
          curriculum: "Sifundo",
          aiTitle: "AI ya [School Name]",
          aiSub: "Ikhona nge-Ollama · Yasendlini & Iyimfihlo",
          aiOffline: "Ayikhonekitiwe",
          aiOnline: "Ikhonekitiwe",
          aiOfflineBanner: "⚠️ I-Ollama ayisetjenzi. Yisungule nge:",
          aiWelcomeTitle: "Umsiti Wakho we-AI wa Sikole",
          aiWelcomeText: "Ngibutsele noma yini mayelana nemifanekiso yakho, emagiletsi, noma impilo yasesikolweni.",
          aiSuggest1: "Cacisa emagiletsi ami",
          aiSuggest2: "Lusito lwe-Trigonometry",
          aiSuggest3: "Lusito lwemsebenti wesikolo",
          aiSuggest4: "Ematiphu e-IGCSE",
          aiPlaceholder: "Ngibutsele noma yini…",
          aiChecking: "Iyahlola...",
          aiReady: "Kulungile",
          aiNoModel: "Akukho model",
          aiLocked: "🔒 Kukhiyiwe",
        },
        af: {
          signOut: "Meld af",
          resetPassword: "Stel wagwoord terug",
          changeLanguage: "Verander taal",
          darkMode: "Wissel donker modus",
          welcomeBack: "Welkom terug",
          loginSub: "Teken in op die [School Name] Leerportaal",
          roleStudent: "📚 Leerder",
          roleTeacher: "🎓 Onderwyser",
          roleParent: "👨‍👩‍👧 Ouer",
          roleAdmin: "🛡 Administrateur",
          badgeTeacher: "Onderwyser",
          badgeParent: "Ouer",
          badgeAdmin: "Administrateur",
          badgeStudent: "Student",
          emailLabel: "E-pos of ID-nommer",
          emailPlaceholder: "jou@epos.com of ID",
          passwordLabel: "Wagwoord",
          signIn: "Teken in →",
          loginError: "⚠️ Verkeerde e-pos/ID of wagwoord. Probeer asseblief weer.",
          dbConnected: "Databasis gekoppel",
          demoCreds: "Demo-aanmelding vul outomaties in wanneer u 'n rol kies.",
          newStudent: "Nuwe leerder?",
          createAccount: "Skep 'n rekening",
          dashboard: "Paneelbord",
          portal: "Portaal",
          grades: "Punte",
          report: "Verslag",
          forums: "Forums",
          admin: "Admin",
          accounts: "Rekeninge",
          auditLog: "Ouditloglêer",
          aiMonitor: "KI-monitor",
          classes: "Klasse",
          homeroom: "Tuiskamer",
          navOverview: "Oorsig",
          navStaff: "Personeel",
          navMyPortal: "My Portaal",
          navGradebook: "Puntenboek",
          navMyGrades: "My Punte",
          navChildGrades: "My Kind se Punte",
          navSystemHealth: "Stelselgesondheid",
          navBackups: "Rugsteune",
          navMigrations: "Migrasies",
          navRecords: "Rekords",
          selectLanguage: "Kies taal",
          languageChanged: "Taal opgedateer",
          cancel: "Kanselleer",
          save: "Stoor",
          founded: "Gestig",
          students: "Leerders",
          curriculum: "Kurrikulum",
          aiTitle: "[School Name] KI",
          aiSub: "Aangedryf deur Ollama · Plaaslik & Privaat",
          aiOffline: "Vanlyn",
          aiOnline: "Aanlyn",
          aiOfflineBanner: "⚠️ Ollama loop nie. Begin dit met:",
          aiWelcomeTitle: "Jou Skool KI-assistent",
          aiWelcomeText: "Vra my enigiets oor jou vakke, punte of skoollewe.",
          aiSuggest1: "Verduidelik my punte",
          aiSuggest2: "Driehoekshulp",
          aiSuggest3: "Huiswerkhulp",
          aiSuggest4: "IGCSE-wenke",
          aiPlaceholder: "Vra my enigiets…",
          aiChecking: "Kontroleer...",
          aiReady: "Gereed",
          aiNoModel: "Geen model",
          aiLocked: "🔒 Gesluit",
        },
        pt: {
          signOut: "Sair",
          resetPassword: "Redefinir Senha",
          changeLanguage: "Mudar Idioma",
          darkMode: "Alternar modo escuro",
          welcomeBack: "Bem-vindo de volta",
          loginSub: "Acesse o Portal de Aprendizagem [School Name]",
          roleStudent: "📚 Aluno",
          roleTeacher: "🎓 Professor",
          roleParent: "👨‍👩‍👧 Pai/Mãe",
          roleAdmin: "🛡 Administrador",
          badgeTeacher: "Professor",
          badgeParent: "Responsável",
          badgeAdmin: "Administrador",
          badgeStudent: "Aluno",
          emailLabel: "E-mail ou número de ID",
          emailPlaceholder: "seu@email.com ou ID",
          passwordLabel: "Senha",
          signIn: "Entrar →",
          loginError: "⚠️ E-mail/ID ou senha incorretos. Tente novamente.",
          dbConnected: "Banco de dados conectado",
          demoCreds: "As credenciais de demonstração são preenchidas automaticamente ao selecionar uma função.",
          newStudent: "Novo aluno?",
          createAccount: "Criar uma conta",
          dashboard: "Painel",
          portal: "Portal",
          grades: "Notas",
          report: "Relatório",
          forums: "Fóruns",
          admin: "Administração",
          accounts: "Contas",
          auditLog: "Registo de Auditoria",
          aiMonitor: "Monitor de IA",
          classes: "Turmas",
          homeroom: "Sala de Origem",
          navOverview: "Visão Geral",
          navStaff: "Funcionários",
          navMyPortal: "Meu Portal",
          navGradebook: "Diário de Notas",
          navMyGrades: "Minhas Notas",
          navChildGrades: "Notas do Meu Filho",
          navSystemHealth: "Saúde do Sistema",
          navBackups: "Cópias de Segurança",
          navMigrations: "Migrações",
          navRecords: "Registros",
          selectLanguage: "Selecionar Idioma",
          languageChanged: "Idioma actualizado",
          cancel: "Cancelar",
          save: "Guardar",
          founded: "Fundada",
          students: "Alunos",
          curriculum: "Currículo",
          aiTitle: "IA de [School Name]",
          aiSub: "Desenvolvido por Ollama · Local e Privado",
          aiOffline: "Desligado",
          aiOnline: "Ligado",
          aiOfflineBanner: "⚠️ O Ollama não está a correr. Inicie com:",
          aiWelcomeTitle: "O Seu Assistente de IA Escolar",
          aiWelcomeText: "Pergunte-me qualquer coisa sobre as suas disciplinas, notas ou vida escolar.",
          aiSuggest1: "Explicar as minhas notas",
          aiSuggest2: "Ajuda com trigonometria",
          aiSuggest3: "Ajuda com trabalhos de casa",
          aiSuggest4: "Dicas IGCSE",
          aiPlaceholder: "Pergunte-me qualquer coisa…",
          aiChecking: "Verificando...",
          aiReady: "Pronto",
          aiNoModel: "Nenhum modelo",
          aiLocked: "🔒 Bloqueado",
        },
        ny: {
          signOut: "Tuluka",
          resetPassword: "Sinthani Chinsinsi",
          changeLanguage: "Sinthani Chilankhulo",
          darkMode: "Sinthani njira ya mdima",
          welcomeBack: "Takulandirani bwerani",
          loginSub: "Lowani ku [School Name] Learning Portal",
          roleStudent: "📚 Wophunzira",
          roleTeacher: "🎓 Mphunzitsi",
          roleParent: "👨‍👩‍👧 Kholo",
          roleAdmin: "🛡 Woyang'anira",
          badgeTeacher: "Mphunzitsi",
          badgeParent: "Kholo",
          badgeAdmin: "Woyang'anira",
          badgeStudent: "Wophunzira",
          emailLabel: "Imelo kapena Nambala ya ID",
          emailPlaceholder: "imelo@yanu.com kapena ID",
          passwordLabel: "Chinsinsi",
          signIn: "Lowani →",
          loginError: "⚠️ Imelo/ID kapena chinsinsi palibe. Yesaninso.",
          dbConnected: "Databesi yalumikizidwa",
          demoCreds: "Zidziwitso za demo zimadzaza zokha mukaŵsankha udindo.",
          newStudent: "Wophunzira watsopano?",
          createAccount: "Pangani akawunti",
          dashboard: "Tsamba Lalikulu",
          portal: "Chipata",
          grades: "Maganizo",
          report: "Lipoti",
          forums: "Mipukutu",
          admin: "Woyang'anira",
          accounts: "Akawunti",
          auditLog: "Rekoodi",
          aiMonitor: "Woyang'anira AI",
          classes: "Makilasi",
          homeroom: "Chipinda cha Khaya",
          navOverview: "Chidule",
          navStaff: "Antchito",
          navMyPortal: "Portal Yanga",
          navGradebook: "Buku la Magiredi",
          navMyGrades: "Magiredi Anga",
          navChildGrades: "Magiredi a Mwana Wanga",
          navSystemHealth: "Thanzi la Njira",
          navBackups: "Zosungidwa",
          navMigrations: "Zosinthidwa",
          navRecords: "Zolembedwa",
          selectLanguage: "Sankhani Chilankhulo",
          languageChanged: "Chilankhulo chasinthidwa",
          cancel: "Siyani",
          save: "Sunga",
          founded: "Yakhazikitsidwa",
          students: "Ophunzira",
          curriculum: "Nzeru za Phunziro",
          aiTitle: "AI ya [School Name]",
          aiSub: "Iphunzitsidwa ndi Ollama · Yakomwe & Yachinsinsi",
          aiOffline: "Ili kutali",
          aiOnline: "Ili pa intaneti",
          aiOfflineBanner: "⚠️ Ollama sikugwira ntchito. Yiyambitseni ndi:",
          aiWelcomeTitle: "Wothandiza Wanu wa AI wa Sukulu",
          aiWelcomeText: "Munditumize mafunso pa ziphunziro, maganizo, kapena moyo wa sukulu.",
          aiSuggest1: "Fotokozani maganizo anga",
          aiSuggest2: "Thandizo la Trigonometry",
          aiSuggest3: "Thandizo la ntchito yapasukulu",
          aiSuggest4: "Malangizo a IGCSE",
          aiPlaceholder: "Munditumize mafunso…",
          aiChecking: "Kuwunika...",
          aiReady: "Yakonzeka",
          aiNoModel: "Palibe modelo",
          aiLocked: "🔒 Yatsekedwa",
        },
        es: {
          signOut: "Cerrar sesión",
          resetPassword: "Restablecer contraseña",
          changeLanguage: "Cambiar idioma",
          darkMode: "Cambiar modo oscuro",
          welcomeBack: "Bienvenido de nuevo",
          loginSub: "Inicia sesión en el Portal de Aprendizaje [School Name]",
          roleStudent: "📚 Estudiante",
          roleTeacher: "🎓 Profesor",
          roleParent: "👨‍👩‍👧 Padre/Madre",
          roleAdmin: "🛡 Administrador",
          badgeTeacher: "Profesor",
          badgeParent: "Padre/Madre",
          badgeAdmin: "Administrador",
          badgeStudent: "Estudiante",
          emailLabel: "Correo electrónico o número de ID",
          emailPlaceholder: "tu@correo.com o ID",
          passwordLabel: "Contraseña",
          signIn: "Iniciar sesión →",
          loginError: "⚠️ Correo/ID o contraseña incorrectos. Inténtalo de nuevo.",
          dbConnected: "Base de datos conectada",
          demoCreds: "Las credenciales de demostración se completan automáticamente al seleccionar un rol.",
          newStudent: "¿Nuevo estudiante?",
          createAccount: "Crear una cuenta",
          dashboard: "Panel",
          portal: "Portal",
          grades: "Notas",
          report: "Informe",
          forums: "Foros",
          admin: "Administración",
          accounts: "Cuentas",
          auditLog: "Registro de auditoría",
          aiMonitor: "Monitor de IA",
          classes: "Clases",
          homeroom: "Aula principal",
          navOverview: "Resumen",
          navStaff: "Personal",
          navMyPortal: "Mi Portal",
          navGradebook: "Libro de Calificaciones",
          navMyGrades: "Mis Calificaciones",
          navChildGrades: "Calificaciones de Mi Hijo",
          navSystemHealth: "Estado del Sistema",
          navBackups: "Copias de Seguridad",
          navMigrations: "Migraciones",
          navRecords: "Registros",
          selectLanguage: "Seleccionar idioma",
          languageChanged: "Idioma actualizado",
          cancel: "Cancelar",
          save: "Guardar",
          founded: "Fundada",
          students: "Estudiantes",
          curriculum: "Plan de estudios",
          aiTitle: "IA de [School Name]",
          aiSub: "Impulsado por Ollama · Local y Privado",
          aiOffline: "Desconectado",
          aiOnline: "Conectado",
          aiOfflineBanner: "⚠️ Ollama no está ejecutándose. Inícialo con:",
          aiWelcomeTitle: "Tu Asistente de IA Escolar",
          aiWelcomeText: "Pregúntame cualquier cosa sobre tus materias, notas o vida escolar.",
          aiSuggest1: "Explicar mis notas",
          aiSuggest2: "Ayuda con trigonometría",
          aiSuggest3: "Ayuda con tareas",
          aiSuggest4: "Consejos IGCSE",
          aiPlaceholder: "Pregúntame cualquier cosa…",
          aiChecking: "Comprobando...",
          aiReady: "Listo",
          aiNoModel: "Sin modelo",
          aiLocked: "🔒 Bloqueado",
        },
        fr: {
          signOut: "Se déconnecter",
          resetPassword: "Réinitialiser le mot de passe",
          changeLanguage: "Changer de langue",
          darkMode: "Basculer le mode sombre",
          welcomeBack: "Bienvenue de retour",
          loginSub: "Connectez-vous au Portail d'Apprentissage [School Name]",
          roleStudent: "📚 Élève",
          roleTeacher: "🎓 Enseignant",
          roleParent: "👨‍👩‍👧 Parent",
          roleAdmin: "🛡 Administrateur",
          badgeTeacher: "Enseignant",
          badgeParent: "Parent",
          badgeAdmin: "Administrateur",
          badgeStudent: "Étudiant",
          emailLabel: "E-mail ou numéro d'identifiant",
          emailPlaceholder: "votre@email.com ou ID",
          passwordLabel: "Mot de passe",
          signIn: "Se connecter →",
          loginError: "⚠️ E-mail/ID ou mot de passe incorrect. Veuillez réessayer.",
          dbConnected: "Base de données connectée",
          demoCreds: "Les identifiants de démonstration se remplissent automatiquement lors de la sélection d'un rôle.",
          newStudent: "Nouvel élève ?",
          createAccount: "Créer un compte",
          dashboard: "Tableau de bord",
          portal: "Portail",
          grades: "Notes",
          report: "Rapport",
          forums: "Forums",
          admin: "Administration",
          accounts: "Comptes",
          auditLog: "Journal d'audit",
          aiMonitor: "Moniteur IA",
          classes: "Classes",
          homeroom: "Salle principale",
          navOverview: "Aperçu",
          navStaff: "Personnel",
          navMyPortal: "Mon Portail",
          navGradebook: "Carnet de Notes",
          navMyGrades: "Mes Notes",
          navChildGrades: "Notes de Mon Enfant",
          navSystemHealth: "État du Système",
          navBackups: "Sauvegardes",
          navMigrations: "Migrations",
          navRecords: "Dossiers",
          selectLanguage: "Choisir la langue",
          languageChanged: "Langue mise à jour",
          cancel: "Annuler",
          save: "Enregistrer",
          founded: "Fondée",
          students: "Élèves",
          curriculum: "Programme",
          aiTitle: "IA de [School Name]",
          aiSub: "Propulsé par Ollama · Local et Privé",
          aiOffline: "Hors ligne",
          aiOnline: "En ligne",
          aiOfflineBanner: "⚠️ Ollama ne fonctionne pas. Démarrez-le avec :",
          aiWelcomeTitle: "Votre Assistant IA Scolaire",
          aiWelcomeText: "Posez-moi n'importe quelle question sur vos matières, notes ou vie scolaire.",
          aiSuggest1: "Expliquer mes notes",
          aiSuggest2: "Aide en trigonométrie",
          aiSuggest3: "Aide aux devoirs",
          aiSuggest4: "Conseils IGCSE",
          aiPlaceholder: "Posez-moi n'importe quelle question…",
          aiChecking: "Vérification...",
          aiReady: "Prêt",
          aiNoModel: "Aucun modèle",
          aiLocked: "🔒 Verrouillé",
        },
      };

      let currentLang = localStorage.getItem("sms_lang") || "en";

      function t(key) {
        return (TRANSLATIONS[currentLang] && TRANSLATIONS[currentLang][key]) ||
               TRANSLATIONS["en"][key] || key;
      }

      function applyTranslations() {
        // Login page
        const loginHeading = document.querySelector(".login-heading");
        if (loginHeading) loginHeading.textContent = t("welcomeBack");
        const loginSubText = document.querySelector(".login-sub-text");
        if (loginSubText) loginSubText.textContent = t("loginSub");

        const tabStudent = document.getElementById("tab-student");
        if (tabStudent) tabStudent.textContent = t("roleStudent");
        const tabTeacher = document.getElementById("tab-teacher");
        if (tabTeacher) tabTeacher.textContent = t("roleTeacher");
        const tabParent = document.getElementById("tab-parent");
        if (tabParent) tabParent.textContent = t("roleParent");
        const tabAdmin = document.getElementById("tab-admin");
        if (tabAdmin) tabAdmin.textContent = t("roleAdmin");

        const emLabel = document.querySelector('label[for="em"], .field label');
        document.querySelectorAll(".field label").forEach((lbl, i) => {
          if (i === 0) lbl.textContent = t("emailLabel");
          if (i === 1) lbl.textContent = t("passwordLabel");
        });
        const emInput = document.getElementById("em");
        if (emInput) emInput.placeholder = t("emailPlaceholder");

        const loginBtn = document.querySelector(".login-btn");
        if (loginBtn) loginBtn.textContent = t("signIn");

        const loginErr = document.getElementById("login-err");
        if (loginErr) loginErr.textContent = t("loginError");

        const dbStatus = document.getElementById("db-status");
        if (dbStatus) {
          const dot = dbStatus.querySelector(".db-dot");
          dbStatus.innerHTML = "";
          if (dot) dbStatus.appendChild(dot);
          dbStatus.appendChild(document.createTextNode(" " + t("dbConnected")));
        }

        const loginNote = document.querySelector(".login-note");
        if (loginNote) loginNote.textContent = t("demoCreds");

        const signupPrompt = document.getElementById("signup-prompt");
        if (signupPrompt) {
          const link = signupPrompt.querySelector("a");
          if (link) {
            signupPrompt.childNodes[0].textContent = t("newStudent") + " ";
            link.textContent = t("createAccount");
          }
        }

        // Topbar logout button
        const logoutBtn = document.querySelector(".logout-btn");
        if (logoutBtn) logoutBtn.textContent = t("signOut");

        // Dark mode toggle titles
        document.querySelectorAll(".dm-toggle").forEach(btn => {
          btn.title = t("darkMode");
        });

        // AI widget
        const aiHeaderTitle = document.querySelector(".ai-header-title");
        if (aiHeaderTitle) aiHeaderTitle.textContent = t("aiTitle");
        const aiHeaderSub = document.querySelector(".ai-header-sub");
        if (aiHeaderSub) aiHeaderSub.textContent = t("aiSub");
        const aiStatusText = document.getElementById("ai-status-text");
        if (aiStatusText) {
          const isOnline = aiStatusText.textContent !== TRANSLATIONS["en"]["aiOffline"] &&
                           Object.values(TRANSLATIONS).some(tr => tr.aiOnline === aiStatusText.textContent);
          aiStatusText.textContent = isOnline ? t("aiOnline") : t("aiOffline");
        }
        const aiOfflineBanner = document.getElementById("ai-offline-banner");
        if (aiOfflineBanner) {
          const code = aiOfflineBanner.querySelector("code");
          const codeText = code ? code.outerHTML : "<code>ollama run llama3.2</code>";
          aiOfflineBanner.innerHTML = t("aiOfflineBanner") + " " + codeText;
        }
        const aiWelcomeTitle = document.querySelector(".ai-welcome-title");
        if (aiWelcomeTitle) aiWelcomeTitle.textContent = t("aiWelcomeTitle");
        const aiWelcomeText = document.querySelector(".ai-welcome-text");
        if (aiWelcomeText) aiWelcomeText.innerHTML = t("aiWelcomeText").replace("\n", "<br/>");
        const aiSuggestions = document.querySelectorAll(".ai-suggestion");
        const sugKeys = ["aiSuggest1","aiSuggest2","aiSuggest3","aiSuggest4"];
        aiSuggestions.forEach((s, i) => { if (sugKeys[i]) s.textContent = t(sugKeys[i]); });
        const aiInput = document.getElementById("ai-input");
        if (aiInput) aiInput.placeholder = t("aiPlaceholder");

        // User dropdown items
        const udItems = document.querySelectorAll(".ud-item");
        udItems.forEach(item => {
          if (item.getAttribute("onclick") && item.getAttribute("onclick").includes("showSelfPasswordModal")) {
            item.innerHTML = "🔑 " + t("resetPassword");
          }
          if (item.getAttribute("onclick") && item.getAttribute("onclick").includes("doLogout")) {
            item.innerHTML = "🚪 " + t("signOut");
          }
          if (item.getAttribute("onclick") && item.getAttribute("onclick").includes("showLanguageModal")) {
            item.innerHTML = "🌐 " + t("changeLanguage");
          }
        });

        // School facts on login
        const factLabels = document.querySelectorAll(".login-fact-label");
        const factKeys = ["founded","students","curriculum"];
        factLabels.forEach((lbl, i) => { if (factKeys[i]) lbl.textContent = t(factKeys[i]); });
      }

      // ══════════════════════════════════════════════════════
      // ─── CONTENT TRANSLATION (user-entered text) ──────────
      // Translates forum posts, replies, announcement bodies
      // via Ollama when a non-English language is active.
      // ══════════════════════════════════════════════════════
      // Persisted across page loads (and across Ollama outages) so any
      // text the AI has EVER successfully translated stays translated
      // forever, even if Ollama is down on a later visit. Only this ran
      // once — a page nobody's opened yet while Ollama is offline still
      // can't be translated (there's no way around that without an AI),
      // but nothing already-seen ever regresses back to English.
      const _translateCache = new Map();
      const _TRANSLATE_CACHE_KEY = "sms_translate_cache_v1";
      const _TRANSLATE_CACHE_MAX_ENTRIES = 1000; // simple FIFO cap to keep localStorage small

      function _loadTranslateCache() {
        try {
          const raw = localStorage.getItem(_TRANSLATE_CACHE_KEY);
          if (!raw) return;
          const obj = JSON.parse(raw);
          Object.keys(obj).forEach((k) => _translateCache.set(k, obj[k]));
        } catch {
          // Corrupt or missing — just start with an empty cache.
        }
      }

      let _translateCacheSaveTimer = null;
      function _persistTranslateCache() {
        clearTimeout(_translateCacheSaveTimer);
        _translateCacheSaveTimer = setTimeout(() => {
          try {
            while (_translateCache.size > _TRANSLATE_CACHE_MAX_ENTRIES) {
              _translateCache.delete(_translateCache.keys().next().value); // drop oldest
            }
            const obj = {};
            _translateCache.forEach((v, k) => { obj[k] = v; });
            localStorage.setItem(_TRANSLATE_CACHE_KEY, JSON.stringify(obj));
          } catch {
            // localStorage full/unavailable — non-fatal, just won't persist this round.
          }
        }, 500);
      }

      let _lastTranslateFailed = false;
      // Caches the set of already-translated curated-dictionary strings
      // per language (e.g. nav labels set directly by applyTranslations())
      // so the generic AI pass never re-translates text that's already
      // correct — saves a wasted round trip and avoids double-translating.
      const _curatedValueSets = new Map();
      function _curatedTranslatedValueSet(lang) {
        const dict = TRANSLATIONS[lang];
        if (!dict) return null;
        if (!_curatedValueSets.has(lang)) {
          _curatedValueSets.set(lang, new Set(Object.values(dict)));
        }
        return _curatedValueSets.get(lang);
      }
      // Tracks the last value WE wrote into a given text node via
      // translateSubtree, so the automatic mutation observer (further
      // below) can tell "the app rendered new English text" apart from
      // "this is just my own translation write echoing back" and never
      // loops on itself.
      const _autoTranslatedNodes = new WeakMap();

      // ══════════════════════════════════════════════════════
      // ─── GLOBAL OLLAMA GENERATE QUEUE ──────────────────────
      // See translateContent() below for why this exists.
      // ══════════════════════════════════════════════════════
      const _genQueue = [];
      let _genQueueRunning = false;
      const _genInFlight = new Map(); // cacheKey -> shared Promise, de-dupes identical concurrent requests
      let _genConsecutiveFailures = 0;
      const _GEN_QUEUE_MAX = 60; // safety cap so a runaway burst can't grow this forever
      const _GEN_FAILED = Symbol("gen-failed");

      function _enqueueGenerate(cacheKey, runFn) {
        if (_genInFlight.has(cacheKey)) return _genInFlight.get(cacheKey);
        const p = new Promise((resolve) => {
          // Drop the oldest waiting request rather than let the queue grow
          // without bound — it's stale UI text by the time its turn comes.
          while (_genQueue.length >= _GEN_QUEUE_MAX) {
            const dropped = _genQueue.shift();
            dropped.resolve(_GEN_FAILED);
          }
          _genQueue.push({ runFn, resolve });
          _runGenQueue();
        });
        _genInFlight.set(cacheKey, p);
        p.finally(() => _genInFlight.delete(cacheKey));
        return p;
      }

      async function _runGenQueue() {
        if (_genQueueRunning) return;
        _genQueueRunning = true;
        while (_genQueue.length) {
          const { runFn, resolve } = _genQueue.shift();
          try {
            const result = await runFn();
            _genConsecutiveFailures = 0;
            resolve(result);
          } catch (e) {
            _genConsecutiveFailures++;
            resolve(_GEN_FAILED);
            // Circuit breaker: several failures in a row means Ollama is
            // genuinely struggling (overloaded, restarting, offline) —
            // back off briefly instead of immediately hammering it with
            // the next queued request too.
            if (_genConsecutiveFailures >= 3) {
              await new Promise((r) => setTimeout(r, 4000));
            }
          }
        }
        _genQueueRunning = false;
      }

      async function translateContent(text) {
        if (!text || !text.trim()) return text;
        if (currentLang === "en") return text;
        const cacheKey = currentLang + "|" + text;
        if (_translateCache.has(cacheKey)) return _translateCache.get(cacheKey);
        const curatedSet = _curatedTranslatedValueSet(currentLang);
        if (curatedSet) {
          if (curatedSet.has(text)) return text; // exact match — already correctly translated
          // V162: a curated string wrapped with an icon/prefix (e.g. the
          // resetPassword menu item is built as "🔑 " + t("resetPassword"))
          // used to miss this exact-match check, get treated as
          // untranslated English, and get sent to the AI — which then
          // "translated" text that was ALREADY in the target language,
          // producing a garbled hallucinated paraphrase instead of leaving
          // it alone. Checking containment catches these wrapped cases too.
          for (const curated of curatedSet) {
            if (curated.length > 3 && text.includes(curated)) return text;
          }
        }

        const LANG_NAMES = {
          ss: "Siswati", af: "Afrikaans", pt: "Portuguese",
          ny: "Chichewa", es: "Spanish", fr: "French"
        };
        const langName = LANG_NAMES[currentLang] || currentLang;
        // Siswati (isiSwati) is a low-resource language that small local
        // models know poorly, so left unguided the model tends to
        // hallucinate an unrelated sentence rather than admit it doesn't
        // know a word. Zulu (isiZulu) is a closely related Nguni language
        // with far more training data, and is widely understood by
        // Siswati speakers, so it's a much safer fallback than a
        // fabricated Siswati-looking phrase.
        const prompt =
          currentLang === "ss"
            ? `Translate the following user-submitted text into Siswati (isiSwati). ` +
              `If you are not confident of the correct Siswati word or phrase for ` +
              `something, use the closest isiZulu (Zulu) equivalent instead — Zulu ` +
              `and Siswati are closely related and Zulu is widely understood by ` +
              `Siswati speakers. Never invent or guess a Siswati-sounding phrase you ` +
              `are not sure of; prefer a correct Zulu word over an incorrect Siswati one. ` +
              `Return ONLY the translated text, no preamble, no explanation, no quotes.\n\n` +
              `Text to translate:\n${text}`
            : `Translate the following user-submitted text into ${langName}. ` +
              `Return ONLY the translated text, no preamble, no explanation, no quotes.\n\n` +
              `Text to translate:\n${text}`;

        try {
          const result = await _enqueueGenerate(cacheKey, async () => {
            const ollamaBase = (typeof OLLAMA_URL !== "undefined") ? OLLAMA_URL : "http://localhost:11434";
            const ollamaModel = (typeof OLLAMA_MODEL !== "undefined") ? OLLAMA_MODEL : "llama3.2";
            const res = await fetch(ollamaBase + "/api/generate", {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: "Bearer " + (window._authToken || "") },
              body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
              signal: AbortSignal.timeout(15000)
            });
            if (!res.ok) throw new Error("Ollama generate returned " + res.status);
            const data = await res.json();
            const out = (data.response || "").trim() || text;
            // HARDCODED SAFETY NET: reject obviously-runaway output.
            // Short inputs (names, initials, labels, single words) should
            // translate to something roughly the same size. A small local
            // model given a short, decontextualized fragment sometimes
            // hallucinates a whole explanatory paragraph instead (e.g.
            // "AD" -> a multi-sentence essay about what "AD" could stand
            // for) rather than admitting it doesn't know how to translate
            // it. Any result that blows up far beyond the input's length
            // is discarded in favor of the original text, no matter what
            // language or element it came from.
            const inputLen = text.trim().length;
            const outputLen = out.length;
            const isRunaway =
              inputLen <= 40
                ? outputLen > inputLen * 4 + 20
                : outputLen > inputLen * 3 + 60;
            if (isRunaway) return text;
            // HARDCODED SAFETY NET #2: reject refusals. The model
            // sometimes declines to translate something it treats as
            // sensitive (email addresses, phone numbers, IDs) and
            // responds with an apology/refusal sentence instead of an
            // error — which then gets written into the page as if it
            // were the real translated content (e.g. a refusal sentence
            // literally replacing a student's email in a table). Catch
            // the common refusal phrasing and fall back to the original
            // text instead of displaying the AI talking about itself.
            const _REFUSAL_RE = /\b(i'?m sorry|i cannot|i can'?t assist|i can'?t help|as an ai|i am unable to|i'?m unable to|i won'?t be able to)\b/i;
            if (_REFUSAL_RE.test(out)) return text;
            return out;
          });
          if (result === _GEN_FAILED) { _lastTranslateFailed = true; return text; }
          _translateCache.set(cacheKey, result);
          _persistTranslateCache();
          return result;
        } catch {
          _lastTranslateFailed = true;
          return text; // graceful fallback — show original if Ollama unreachable
        }
      }

      // ══════════════════════════════════════════════════════
      // ─── UNIVERSAL CONTENT TRANSLATION ENGINE ─────────────
      // Walks every visible text node under a root element and
      // translates it via Ollama, in place. This replaces the old
      // approach of hand-tagging individual fields with a
      // ".translatable-content" span: nav labels, tabs, forum posts,
      // replies, comments, feedback, notifications, staff notes —
      // literally anything rendered as text — gets picked up
      // automatically, with no need to remember to tag new fields
      // as they're added later.
      //
      // Nothing needs "restoring" when switching back to English:
      // every page/shell re-render already rebuilds fresh English
      // markup from the underlying data before this function is
      // ever called, so English is the natural starting state.
      // ══════════════════════════════════════════════════════

      // Live form controls / code — never translate their contents.
      const _NO_TRANSLATE_TAGS = new Set([
        "SCRIPT", "STYLE", "NOSCRIPT", "INPUT", "TEXTAREA",
        "SELECT", "OPTION", "SVG", "PATH", "CODE", "PRE",
      ]);
      // Elements that hold identity/meta info (names, IDs, model names,
      // timestamps) rather than translatable prose — translating these
      // risks mangling a person's name or a technical value.
      const _NO_TRANSLATE_CLASSES = [
        "li-sub", "ft-meta", "thread-reply-author", "freply-context",
        "ft-av", "fedited-tag", "syshealth-timeline-badge",
        // V162: the topbar's logged-in user name. This is a person's
        // proper name, not prose — translating it is wrong by definition,
        // and since buildShell() re-renders it from the raw English
        // currentUser.name on every shell rebuild, the old behavior sent
        // it to the AI again and again (a fresh text node each time, so
        // the "already translated, skip" node-identity check never
        // matched), which is what caused the topbar name to visibly
        // flicker/garble and never settle.
        "u-name",
        // V162: topbar avatar initials (e.g. "AD"). Same problem as
        // u-name — not translatable text at all — but this one was
        // missed even though the equivalent forum-avatar class (ft-av)
        // was already excluded. A bare 2-letter fragment like "AD" gives
        // the model nothing to translate, so instead of admitting that,
        // it hallucinates an entire explanatory paragraph (e.g. treating
        // "AD" as an abbreviation and rambling about what it might stand
        // for) — which is the runaway wall of text seen overlaying the
        // sidebar.
        "u-av",
        // V162: pure numeric/technical live telemetry (bytes, ms, %, MB,
        // context length, network type, ...). These re-render every 4s
        // during AI Monitor / System Health polling — since each new
        // number is a fresh string, it was a permanent cache-miss that
        // queued a fresh AI translation call every single poll tick, even
        // with zero user interaction. That constant background stream is
        // what was congesting Ollama's single-request queue and causing
        // intermittent "offline" readings that had nothing to do with any
        // real connectivity problem. None of these values are actually
        // language-dependent prose, so they never needed translation.
        "mon-value",
      ];

      // Data-shaped text that is never prose, no matter what page it's
      // on — sending it to the AI at all is the bug, not just a risk.
      // Email addresses are the concrete case that surfaced this: many
      // models are aligned to refuse requests involving what looks like
      // personal contact info, and that refusal sentence ("I'm sorry but
      // I can't assist with translating email addresses...") was getting
      // treated as a normal successful translation and written straight
      // into the table in place of the real email.
      const _EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      // Staff/student ID formats used throughout the app, e.g. "T-001",
      // "10-0001", "ADM-002": a few letters, a hyphen, some digits.
      // These are identifiers, not prose — there's nothing to translate,
      // and giving the AI a bare code like this is exactly the kind of
      // decontextualized fragment that makes it hallucinate an
      // explanation instead of admitting there's no translation to do.
      const _ID_RE = /^(?=.*\d)[A-Za-z0-9]{1,8}(-[A-Za-z0-9]{1,8})?$/;

      function _isTranslatableTextNode(node) {
        if (node.nodeType !== Node.TEXT_NODE) return false;
        const txt = node.nodeValue;
        if (!txt || !txt.trim()) return false;
        if (!/[A-Za-z\u00C0-\u024F]/.test(txt)) return false; // needs actual letters
        const trimmed = txt.trim();
        if (_EMAIL_RE.test(trimmed)) return false; // email address — data, not prose
        if (_ID_RE.test(trimmed)) return false; // staff/student ID code — data, not prose
        let el = node.parentElement;
        while (el) {
          if (_NO_TRANSLATE_TAGS.has(el.tagName)) return false;
          if (el.hasAttribute && el.hasAttribute("data-no-translate")) return false;
          if (el.classList) {
            for (const c of _NO_TRANSLATE_CLASSES) {
              if (el.classList.contains(c)) return false;
            }
          }
          if (el.isContentEditable) return false;
          el = el.parentElement;
        }
        return true;
      }

      function _collectTextNodes(root) {
        if (!root) return [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode: (n) => _isTranslatableTextNode(n) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP,
        });
        const nodes = [];
        let n;
        while ((n = walker.nextNode())) nodes.push(n);
        return nodes;
      }

      // Translates every qualifying text node under `root`, in place.
      // Small worker pool so a busy page doesn't fire 100+ fetches at once.
      const _autoTranslatedHeadings = new WeakMap();

      async function translateHeadingWhole(heading) {
        const original = heading.textContent;
        if (!original || !original.trim()) return;
        // Never touch a heading that contains the current user's own
        // name (e.g. "Sawubona, <em>Jane Dlamini</em> 👋") — sending a
        // proper name into a translation prompt risks mangling it, and
        // names aren't translatable prose in the first place.
        if (currentUser && currentUser.name && original.includes(currentUser.name)) return;
        if (_autoTranslatedHeadings.get(heading) === original) return; // our own last write, unchanged
        try {
          const translated = await translateContent(original);
          if (heading.isConnected && heading.textContent === original) {
            heading.textContent = translated;
            _autoTranslatedHeadings.set(heading, translated);
          }
        } catch {
          // leave original text in place on failure
        }
      }

      async function translateSubtree(root) {
        if (!root || currentLang === "en") return;
        const headings = [];
        if (root.matches && root.matches("h1,h2,h3")) headings.push(root);
        if (root.querySelectorAll) headings.push(...root.querySelectorAll("h1,h2,h3"));
        if (headings.length) await Promise.all(headings.map(translateHeadingWhole));
        const nodes = _collectTextNodes(root).filter(
          (n) => !headings.some((h) => h.contains(n)),
        );
        if (!nodes.length) return;
        // V162: was 6. Ollama serializes /api/generate anyway (single
        // request queue), so 6 "concurrent" calls didn't parallelize
        // anything — they just piled up behind each other, and while
        // Ollama churned through the backlog, unrelated status-check calls
        // (AI Monitor's /api/tags poll) couldn't get a timely response
        // either, which is what made every non-English language falsely
        // read as "Ollama offline" the moment you switched to it. Running
        // these one at a time is no slower in practice (Ollama was already
        // serializing them) and stops that pile-up.
        const CONCURRENCY = 1;
        let i = 0;
        async function worker() {
          while (i < nodes.length) {
            const node = nodes[i++];
            if (!node.isConnected) continue;
            const original = node.nodeValue;
            try {
              const translated = await translateContent(original);
              if (node.isConnected) {
                node.nodeValue = translated;
                _autoTranslatedNodes.set(node, translated);
              }
            } catch {
              // leave original text in place on failure
            }
          }
        }
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, nodes.length) }, worker));
      }

      // Translates the currently active tab/page plus the persistent shell
      // chrome (sidebar nav, mobile nav) that isn't rebuilt on every navigation.
      // Nav labels/buttons/headers etc. are covered by the curated dictionary
      // (instant, no AI needed) via applyTranslations(); this generic pass
      // handles everything else — but it depends on Ollama being reachable,
      // so surface a clear warning instead of silently leaving text in English.
      async function applyContentTranslations() {
        if (currentLang === "en") return;
        _lastTranslateFailed = false;
        const targets = [
          document.querySelector(".page.active"),
          document.getElementById("sb-nav"),
          document.getElementById("mob-nav"),
        ].filter(Boolean);
        await Promise.all(targets.map(translateSubtree));
        if (_lastTranslateFailed) {
          showToast("⚠️ Ollama is offline — page content couldn't be translated (menu labels still updated)", "err");
        }
      }

      // ══════════════════════════════════════════════════════
      // ─── AUTOMATIC TRANSLATION OBSERVER ────────────────────
      // applyContentTranslations() above only reaches the page/nav
      // targets it's explicitly pointed at, and only at the moment a
      // language switch happens. That misses everything rendered
      // AFTER the fact: modals (announcements, forum threads, edit
      // dialogs, ...), helpers that update a page directly without
      // going through navigateTo() (renderClassesPage, viewThread,
      // saveAnnouncement, ...), and periodic polling updates (System
      // Health cards, AI Monitor). Rather than hunting down every such
      // call site and hard-coding a translation call into it, this
      // watches the whole document with a MutationObserver: any text
      // that appears or changes while a non-English language is active
      // gets picked up and translated automatically, with nothing to
      // remember when new features are added later.
      // ══════════════════════════════════════════════════════
      let _langObserver = null;
      const _dirtyTranslateRoots = new Set();
      let _dirtyTranslateTimer = null;

      function _scheduleDirtyTranslate() {
        clearTimeout(_dirtyTranslateTimer);
        // Small debounce so a burst of DOM changes (a whole page
        // re-render, a table refresh) collapses into one translation
        // pass instead of one per mutation.
        _dirtyTranslateTimer = setTimeout(() => {
          const roots = Array.from(_dirtyTranslateRoots);
          _dirtyTranslateRoots.clear();
          roots.forEach((root) => {
            if (root && root.isConnected) translateSubtree(root);
          });
        }, 200);
      }

      function _queueForTranslation(node) {
        if (!node) return;
        // translateSubtree() walks from an element downward, so a bare
        // text node gets its parent element queued instead of itself.
        const root = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
        if (root) {
          _dirtyTranslateRoots.add(root);
          _scheduleDirtyTranslate();
        }
      }

      function initLanguageAutoObserver() {
        if (_langObserver || !document.body) return;
        _langObserver = new MutationObserver((mutations) => {
          if (currentLang === "en") return;
          for (const m of mutations) {
            if (m.type === "characterData") {
              const node = m.target;
              // Our own translation writes land here too (changing
              // nodeValue IS a characterData mutation) — skip anything
              // that matches what we last wrote ourselves, or this
              // would retranslate forever.
              if (_autoTranslatedNodes.get(node) === node.nodeValue) continue;
              if (_isTranslatableTextNode(node)) _queueForTranslation(node);
            } else if (m.type === "childList") {
              m.addedNodes.forEach((n) => {
                if (n.nodeType === Node.ELEMENT_NODE) {
                  _queueForTranslation(n);
                } else if (n.nodeType === Node.TEXT_NODE && _isTranslatableTextNode(n)) {
                  _queueForTranslation(n);
                }
              });
            }
          }
        });
        _langObserver.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
        });
      }

      function showLanguageModal() {
        closeUserDropdown();
        const backdrop = document.createElement("div");
        backdrop.className = "modal-backdrop";
        backdrop.id = "lang-modal";
        backdrop.innerHTML = `
          <div class="modal" style="max-width:380px">
            <div class="modal-title">🌐 ${t("selectLanguage")}</div>
            <div style="display:flex;flex-direction:column;gap:8px;margin:16px 0">
              ${Object.entries(LANGUAGES).map(([code, lang]) => `
                <label style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:8px;cursor:pointer;border:1.5px solid ${currentLang===code?"var(--crimson)":"var(--ink-12)"};background:${currentLang===code?"rgba(156,28,39,0.06)":"transparent"};transition:all 0.15s" onclick="selectLangOption('${code}')">
                  <input type="radio" name="lang-pick" value="${code}" ${currentLang===code?"checked":""} style="accent-color:var(--crimson)">
                  <span style="font-size:14px;font-family:'Barlow',sans-serif;color:var(--ink)">${escapeHtml(lang.label)}</span>
                  <span style="margin-left:auto;font-size:12px;color:var(--ink-35);font-style:italic">${escapeHtml(lang.name)}</span>
                </label>
              `).join("")}
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end">
              <button class="ud-item" style="width:auto;padding:8px 18px" onclick="document.getElementById('lang-modal').remove()">${t("cancel")}</button>
              <button class="btn-primary" style="padding:8px 18px;border-radius:8px;border:none;background:var(--crimson);color:#fff;cursor:pointer;font-family:'Barlow',sans-serif;font-size:14px" onclick="applyLangChoice()">${t("save")}</button>
            </div>
          </div>
        `;
        backdrop.addEventListener("click", e => { if (e.target === backdrop) backdrop.remove(); });
        document.body.appendChild(backdrop);
      }

      function selectLangOption(code) {
        document.querySelectorAll("#lang-modal label").forEach(lbl => {
          const isThis = lbl.querySelector("input").value === code;
          lbl.style.border = `1.5px solid ${isThis ? "var(--crimson)" : "var(--ink-12)"}`;
          lbl.style.background = isThis ? "rgba(156,28,39,0.06)" : "transparent";
        });
        document.querySelector(`#lang-modal input[value="${code}"]`).checked = true;
      }

      async function applyLangChoice() {
        const selected = document.querySelector("#lang-modal input[name='lang-pick']:checked");
        if (!selected) return;
        currentLang = selected.value;
        const langKey = userPrefKey("lang");
        if (langKey) {
          DB.set(langKey, currentLang); // signed in — this account only
        } else {
          localStorage.setItem("sms_lang", currentLang); // no account yet — device-level fallback
        }
        document.getElementById("lang-modal").remove();
        _translateCache.clear(); // clear cache on lang change

        // Re-render the currently active page AND the shell chrome (sidebar +
        // mobile nav labels), so every tab, and every bit of user-entered
        // content in it, starts from a fresh English render before translation.
        const activePage = document.querySelector(".page.active");
        const pgId = activePage ? activePage.id.replace("page-", "") : null;
        if (activePage) activePage.innerHTML = renderPage(pgId);
        if (typeof buildShell === "function") buildShell(); // rebuilds sb-nav/mob-nav labels
        if (pgId) {
          // Re-highlight the sidebar/mobile button for this page (buildShell
          // rebuilds the nav from scratch, so the active class needs re-applying)
          document.querySelectorAll(".sb-nav-btn, .tb-nav-item, .mob-btn, .mob-more-item").forEach(b => b.classList.remove("active"));
          const sbBtn = document.getElementById("sb-" + pgId);
          if (sbBtn) sbBtn.classList.add("active");
          const tbBtn = document.getElementById("tb-" + pgId);
          if (tbBtn) tbBtn.classList.add("active");
          const mb = document.getElementById("mob-" + pgId);
          if (mb) mb.classList.add("active");
        }

        // Generic AI translation pass first — covers everything: nav labels,
        // tabs, forum posts, replies, comments, feedback, notifications, staff
        // notes, literally anything rendered as text, with nothing hand-tagged.
        await applyContentTranslations();

        // Curated dictionary pass runs LAST so the small set of hand-picked,
        // instant, guaranteed-quality strings (login screen, AI widget, topbar)
        // always win over whatever the generic AI pass produced for them.
        applyTranslations();

        // Update sidebar language label
        const sbLangLabel = document.getElementById("sb-lang-label");
        if (sbLangLabel) sbLangLabel.textContent = t("changeLanguage");

        showToast(t("languageChanged"), "ok");
      }

      // ══════════════════════════════════════════════════════
      // ─── USER DROPDOWN ────────────────────────────────────
      // ══════════════════════════════════════════════════════
      let userDropdownOpen = false;
      function toggleUserDropdown(e) {
        e.stopPropagation();
        const dd = document.getElementById("user-dropdown");
        if (!dd) return;
        userDropdownOpen = !userDropdownOpen;
        dd.classList.toggle("show", userDropdownOpen);
        if (userDropdownOpen) {
          setTimeout(() => {
            document.addEventListener("click", closeUserDropdown, { once: true });
          }, 50);
        }
      }
      function closeUserDropdown() {
        userDropdownOpen = false;
        const dd = document.getElementById("user-dropdown");
        if (dd) dd.classList.remove("show");
      }

