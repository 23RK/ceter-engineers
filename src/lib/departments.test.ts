import { test } from "node:test";
import assert from "node:assert/strict";
import {
  autoDepartment,
  isGenericProjectName,
  suggestDepartment,
} from "./departments";

test("automatic assignment only for unambiguous names", () => {
  assert.equal(autoDepartment("וילה פרטית - כפר שמריהו"), "VILLA");
  assert.equal(autoDepartment("ווילה בהרצליה"), "VILLA");
  assert.equal(autoDepartment("פיקוח יזם"), "DEVELOPER");
  assert.equal(autoDepartment("פרויקט יזמי נתניה"), "DEVELOPER");
  // Mentions both - left for manual assignment.
  assert.equal(autoDepartment("וילה משפחת כהן - פיקוח יזם"), null);
  // Mentions neither.
  assert.equal(autoDepartment("שיפוץ משרדים - מגדל עזריאלי"), null);
  assert.equal(autoDepartment('בניין מגורים - רח" הרצל 12'), null);
});

test("suggestions use weaker hints but never decide ambiguous names", () => {
  assert.equal(suggestDepartment({ name: 'בניין מגורים - רח" הרצל 12' }), "DEVELOPER");
  assert.equal(suggestDepartment({ name: "בית פרטי בכפר ורדים" }), "VILLA");
  assert.equal(
    suggestDepartment({ name: "הרצל 5", client: 'יזמי הרצל בע"מ' }),
    "DEVELOPER"
  );
  assert.equal(suggestDepartment({ name: "וילה משפחת כהן - פיקוח יזם" }), null);
  assert.equal(suggestDepartment({ name: "פרויקט חדש" }), null);
});

test("generic type-only names are flagged for renaming", () => {
  assert.equal(isGenericProjectName("פיקוח יזם"), true);
  assert.equal(isGenericProjectName("ניהול ופיקוח – וילה"), true);
  assert.equal(isGenericProjectName("פיקוח וילות"), true);
  assert.equal(isGenericProjectName("וילה פרטית - כפר שמריהו"), false);
  assert.equal(isGenericProjectName("פיקוח יזם - הרצל 12"), false);
});
