import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * Initial passwords come from environment variables, never from code:
 * INITIAL_PASSWORD_RON / INITIAL_PASSWORD_GUY. A password is set ONLY for a
 * user who has none yet, so this never overwrites a password changed in
 * Settings. To reset a forgotten password: clear that user's passwordHash
 * in the database, set the variable, and redeploy (see README).
 */
async function setInitialPasswords() {
  const initial = [
    { email: "ronketerltd@gmail.com", envVar: "INITIAL_PASSWORD_RON" },
    { email: "guyketerltd@gmail.com", envVar: "INITIAL_PASSWORD_GUY" },
  ];
  for (const { email, envVar } of initial) {
    const password = process.env[envVar];
    if (!password) continue;
    if (password.length < 8) {
      console.warn(`${envVar} קצרה מ-8 תווים - לא הוגדרה.`);
      continue;
    }
    const { count } = await prisma.user.updateMany({
      where: { email, passwordHash: null },
      data: {
        passwordHash: await bcrypt.hash(password, 12),
        passwordChangedAt: new Date(),
        failedLoginCount: 0,
        lockedUntil: null,
      },
    });
    if (count > 0) console.log(`הוגדרה סיסמה ראשונית עבור ${email}`);
  }
}

async function main() {
  // The sign-in allow-list: each person signs in with "Sign in with Google"
  // using exactly this email. On an existing database these rows were
  // already linked by the google_sign_in migration, so `update` stays empty
  // (never overwrite names/colors someone changed).
  const ron = await prisma.user.upsert({
    where: { id: "partner-ron" },
    update: {},
    create: {
      id: "partner-ron",
      name: "רון",
      email: "ronketerltd@gmail.com",
      role: "PARTNER",
      color: "#2251e0",
    },
  });

  const guy = await prisma.user.upsert({
    where: { id: "partner-guy" },
    update: {},
    create: {
      id: "partner-guy",
      name: "גיא",
      email: "guyketerltd@gmail.com",
      role: "PARTNER",
      color: "#eda520",
    },
  });

  await setInitialPasswords();

  // בדק בית: the owner inspectors (migration 20261104090000) link to their
  // users. On an existing database the migration already did it; on a fresh
  // one the users only exist now.
  for (const [inspectorId, userId] of [
    ["inspector-ron", ron.id],
    ["inspector-guy", guy.id],
  ]) {
    await prisma.inspector.updateMany({
      where: { id: inspectorId, userId: null },
      data: { userId },
    });
  }

  const existingProjects = await prisma.project.count();
  if (existingProjects > 0) {
    console.log("כבר קיימים פרויקטים במסד הנתונים - מדלג על נתוני דוגמה.");
    return;
  }

  const today = new Date();
  const inDays = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d;
  };

  const projectA = await prisma.project.create({
    data: {
      name: 'בניין מגורים - רח" הרצל 12, ראשון לציון',
      client: "יזמי הרצל בע\"מ",
      address: 'רח" הרצל 12, ראשון לציון',
      status: "ACTIVE",
      department: "DEVELOPER",
      ownerId: ron.id,
      city: "ראשון לציון",
      budget: 4200000,
      startDate: inDays(-60),
      endDate: inDays(180),
      description: "פיקוח הנדסי מלא על בניית בניין מגורים בן 6 קומות, 18 יח\"ד.",
      milestones: {
        create: [
          { title: "היתר בנייה", dueDate: inDays(-55), completedAt: inDays(-56), done: true, status: "DONE", order: 0 },
          { title: "יסודות", dueDate: inDays(-20), completedAt: inDays(-18), done: true, status: "DONE", order: 1 },
          { title: "שלד – קומות וגג", dueDate: inDays(30), status: "IN_PROGRESS", order: 2 },
          { title: "גמרים", dueDate: inDays(120), order: 3 },
          { title: "מסירות לדיירים", dueDate: inDays(180), order: 4 },
        ],
      },
    },
  });

  const projectB = await prisma.project.create({
    data: {
      name: "שיפוץ משרדים - מגדל עזריאלי",
      client: "חברת טכנולוגיה בע\"מ",
      address: "מגדל עזריאלי, תל אביב",
      status: "PLANNING",
      department: "DEVELOPER",
      ownerId: guy.id,
      city: "תל אביב",
      budget: 850000,
      startDate: inDays(14),
      endDate: inDays(100),
      description: "תכנון ופיקוח על שיפוץ קומת משרדים 1,200 מ\"ר.",
      milestones: {
        create: [
          { title: "אישור תוכניות", dueDate: inDays(10), order: 0 },
          { title: "התחלת עבודות", dueDate: inDays(14), order: 1 },
        ],
      },
    },
  });

  const projectC = await prisma.project.create({
    data: {
      name: "וילה פרטית - כפר שמריהו",
      client: "משפחת לוי",
      address: "כפר שמריהו",
      status: "ON_HOLD",
      department: "VILLA",
      ownerId: ron.id,
      city: "כפר שמריהו",
      budget: 3100000,
      startDate: inDays(-200),
      endDate: inDays(-10),
      description: "הפרויקט מוקפא בהמתנה לאישור תב\"ע מעודכן.",
    },
  });

  await prisma.task.createMany({
    data: [
      {
        title: "בדיקת קבלנים לעבודות שלד",
        status: "IN_PROGRESS",
        priority: "HIGH",
        dueDate: inDays(3),
        projectId: projectA.id,
        assigneeId: ron.id,
        createdById: ron.id,
      },
      {
        title: "אישור חשבון ביניים מס' 4",
        status: "TODO",
        priority: "URGENT",
        dueDate: inDays(1),
        projectId: projectA.id,
        assigneeId: guy.id,
        createdById: ron.id,
      },
      {
        title: "ביקורת בטיחות שבועית באתר",
        status: "TODO",
        priority: "MEDIUM",
        dueDate: inDays(5),
        projectId: projectA.id,
        assigneeId: ron.id,
        createdById: guy.id,
      },
      {
        title: "תיאום עם מהנדס קונסטרוקציה",
        status: "REVIEW",
        priority: "MEDIUM",
        dueDate: inDays(-2),
        projectId: projectA.id,
        assigneeId: guy.id,
        createdById: guy.id,
      },
      {
        title: "קבלת הצעות מחיר לעבודות חשמל",
        status: "DONE",
        priority: "LOW",
        dueDate: inDays(-10),
        projectId: projectB.id,
        assigneeId: ron.id,
        createdById: ron.id,
      },
      {
        title: "הכנת לוח זמנים ראשוני לשיפוץ",
        status: "TODO",
        priority: "HIGH",
        dueDate: inDays(8),
        projectId: projectB.id,
        assigneeId: guy.id,
        createdById: guy.id,
      },
      {
        title: "מעקב מול עירייה לאישור תב\"ע",
        status: "IN_PROGRESS",
        priority: "MEDIUM",
        dueDate: inDays(20),
        projectId: projectC.id,
        assigneeId: ron.id,
        createdById: ron.id,
      },
      {
        title: "עדכון תוכנית עסקית לרבעון",
        status: "TODO",
        priority: "LOW",
        dueDate: inDays(15),
        assigneeId: guy.id,
        createdById: guy.id,
      },
    ],
  });

  await prisma.activity.createMany({
    data: [
      {
        message: `${ron.name} פתח/ה פרויקט חדש: "${projectA.name}"`,
        actorId: ron.id,
        projectId: projectA.id,
      },
      {
        message: `${guy.name} פתח/ה פרויקט חדש: "${projectB.name}"`,
        actorId: guy.id,
        projectId: projectB.id,
      },
      {
        message: `${ron.name} עדכן/ה את סטטוס הפרויקט "${projectC.name}"`,
        actorId: ron.id,
        projectId: projectC.id,
      },
    ],
  });

  console.log("נתוני דוגמה נוצרו בהצלחה!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
