import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD = "keter2026!";

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  const ron = await prisma.user.upsert({
    where: { email: "ronkokaltd@gmail.com" },
    update: {},
    create: {
      name: "רון",
      email: "ronkokaltd@gmail.com",
      passwordHash,
      color: "#2251e0",
    },
  });

  const guy = await prisma.user.upsert({
    where: { email: "guy@keter-eng.co.il" },
    update: {},
    create: {
      name: "גיא",
      email: "guy@keter-eng.co.il",
      passwordHash,
      color: "#eda520",
    },
  });

  const existingProjects = await prisma.project.count();
  if (existingProjects > 0) {
    console.log("כבר קיימים פרויקטים במסד הנתונים - מדלג על נתוני דוגמה.");
    console.log("משתמשים מוכנים:");
    console.log(`  ${ron.email} / ${DEFAULT_PASSWORD}`);
    console.log(`  ${guy.email} / ${DEFAULT_PASSWORD}`);
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
      budget: 4200000,
      startDate: inDays(-60),
      endDate: inDays(180),
      description: "פיקוח הנדסי מלא על בניית בניין מגורים בן 6 קומות, 18 יח\"ד.",
      milestones: {
        create: [
          { title: "היתר בנייה", dueDate: inDays(-55), done: true, order: 0 },
          { title: "יציקת יסודות", dueDate: inDays(-20), done: true, order: 1 },
          { title: "שלד הבניין", dueDate: inDays(30), done: false, order: 2 },
          { title: "עבודות גמר", dueDate: inDays(120), done: false, order: 3 },
          { title: "מסירת דירות", dueDate: inDays(180), done: false, order: 4 },
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
  console.log("פרטי התחברות:");
  console.log(`  ${ron.email} / ${DEFAULT_PASSWORD}`);
  console.log(`  ${guy.email} / ${DEFAULT_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
