/* =====================================================================
   School Management System — Seeded Database
   File: seed-data.js
   Seeds the minimal starter data needed on first run: a single
   administrator account and the class/subject skeleton (subjects,
   homeroom groupings). No student, teacher, or parent records, grades,
   announcements, forum posts, or class notes are included — this is a
   clean shell, ready for a school's own data.

   Log in as the seeded admin (see ROLE_EMAILS/ROLE_PASSWORDS in 1.js —
   defaults to admin@yourschool.com / Admin123) to create real staff
   and student accounts, post announcements, and set up gradebooks.

   Load this file BEFORE 1.js in index.html, since 1.js calls
   seedDatabase() during init.
   ===================================================================== */

      const DATA_VERSION = "v1-clean-shell";

      function seedDatabase() {
        const currentVersion = DB.get("data_version");
        if (currentVersion !== DATA_VERSION) {
          DB.del("seeded");
          DB.del("data_version");
        }

        if (!DB.get("seeded")) {
          // Single starter account — the school's own admin should change
          // this password (or create a new admin account) immediately.
          DB.set("users", [
            {
              id: "u1",
              uid: "A-001",
              email: "admin@yourschool.com",
              password: ROLE_PASSWORDS.admin,
              role: "admin",
              name: "System Administrator",
              initials: "AD",
              av: "av1",
            },
          ]);

          DB.set("announcements", []);
          DB.set("forum_threads", []);
          DB.set("assignments", []);
          DB.set("staff", []);
          DB.set("submissions", []);

          seedGradebookClasses();
          seedClassNotes();
          seedHomerooms();

          DB.set("seeded", true);
          DB.set("data_version", DATA_VERSION);
        }

        // Defensive backfill for any collection that predates this shell.
        if (!DB.get("gb_classes")) seedGradebookClasses();
        if (!DB.get("class_notes")) seedClassNotes();
        if (!DB.get("homerooms")) seedHomerooms();
      }

      // ─── GRADEBOOK CLASSES ─────────────────────────────────
      // A starter set of subject/class containers so the Gradebook and
      // Classes pages have something to show. Rename, delete, or add to
      // these from Admin once real subjects/classes are known — rosters
      // start empty.
      function seedGradebookClasses() {
        DB.set("gb_classes", [
          {
            id: "9A",
            subject: "Mathematics",
            cls: "Grade 9 · 9A",
            emoji: "📐",
            color: "var(--crimson)",
            cols: ["Assessment 1", "Assessment 2", "Mid-Term", "Project"],
          },
          {
            id: "10A",
            subject: "Science",
            cls: "Grade 10 · 10A",
            emoji: "🔬",
            color: "#7A4080",
            cols: ["Assessment 1", "Assessment 2", "Test", "Project"],
          },
        ]);
        DB.set("gradebook_9A", []);
        DB.set("gradebook_10A", []);
      }

      // ─── CLASS NOTES (per-subject study notes, shown on student
      //     "View Class" cards) ─────────────────────────────────
      function seedClassNotes() {
        DB.set("class_notes", []);
      }

      // ─── HOMEROOM CLASSES ───────────────────────────────────
      // A starter set of grade/homeroom groupings. Add or rename these
      // from Admin to match the school's actual structure — rosters
      // start empty.
      function seedHomerooms() {
        const groups = [
          { grade: "Grade 8", classes: ["8A"] },
          { grade: "Grade 9", classes: ["9A"] },
          { grade: "Grade 10", classes: ["10A"] },
          { grade: "Grade 11", classes: ["11A"] },
        ];
        const homerooms = [];
        groups.forEach((g) => {
          g.classes.forEach((id) => {
            const label = id.replace(/^(\d+)/, "$1 ");
            homerooms.push({ id, label, grade: g.grade, sixth: false });
            DB.set("homeroom_" + id, []);
          });
        });
        DB.set("homerooms", homerooms);
      }
