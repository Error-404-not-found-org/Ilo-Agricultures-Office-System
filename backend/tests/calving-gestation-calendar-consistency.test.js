import test from "node:test";
import assert from "node:assert/strict";
import { getCalvingReadiness } from "../src/services/calving.service.js";
import {
  toManilaCalendarDay,
  differenceInManilaCalendarDays,
  toManilaDateKey,
} from "../src/domain/service-date-time.js";

const context = {
  mother: {
    species: "Beef Cattle",
  },
  pregnancy: {
    pregnancyDiagnosis: {
      result: "Pregnant",
    },
    targetCalvingDate: new Date("2027-01-19T00:00:00.000Z"),
  },
  insemination: {
    inseminationDate: new Date("2026-04-11T00:00:00.000Z"),
  },
};

test("Reproductive gestation: Day-0 semantics and boundary calendar dates", () => {
  // A. Apr 11 (insemination day = Day 0)
  const day0 = getCalvingReadiness({
    ...context,
    at: new Date("2026-04-11T00:00:00.000Z"),
  });
  assert.equal(day0.gestationDays, 0);
  assert.equal(day0.minimumDays, 253);
  assert.equal(day0.averageGestationDays, 283);
  assert.equal(day0.daysRemaining, 253);
  assert.equal(day0.expectedCalvingDaysRemaining, 283);
  assert.equal(day0.isEligible, false);

  // B. Apr 12 (next calendar date = Day 1)
  const day1 = getCalvingReadiness({
    ...context,
    at: new Date("2026-04-12T00:00:00.000Z"),
  });
  assert.equal(day1.gestationDays, 1);
  assert.equal(day1.daysRemaining, 252);
  assert.equal(day1.expectedCalvingDaysRemaining, 282);
  assert.equal(day1.isEligible, false);

  // C. Sep 8 (Day 150, min remaining = 103, exp remaining = 133)
  const sep8 = getCalvingReadiness({
    ...context,
    at: new Date("2026-09-08T00:00:00.000Z"),
  });
  assert.equal(sep8.gestationDays, 150);
  assert.equal(sep8.minimumDays, 253);
  assert.equal(sep8.averageGestationDays, 283);
  assert.equal(sep8.daysRemaining, 103);
  assert.equal(sep8.expectedCalvingDaysRemaining, 133);
  assert.equal(sep8.isEligible, false);
  // Invariant check: 150 + 103 = 253, 150 + 133 = 283
  assert.equal(sep8.gestationDays + sep8.daysRemaining, sep8.minimumDays);
  assert.equal(sep8.gestationDays + sep8.expectedCalvingDaysRemaining, sep8.averageGestationDays);

  // D. Sep 9 (Day 151, min remaining = 102, exp remaining = 132)
  const sep9 = getCalvingReadiness({
    ...context,
    at: new Date("2026-09-09T00:00:00.000Z"),
  });
  assert.equal(sep9.gestationDays, 151);
  assert.equal(sep9.minimumDays, 253);
  assert.equal(sep9.averageGestationDays, 283);
  assert.equal(sep9.daysRemaining, 102);
  assert.equal(sep9.expectedCalvingDaysRemaining, 132);
  assert.equal(sep9.isEligible, false);
  // Invariant check: 151 + 102 = 253, 151 + 132 = 283
  assert.equal(sep9.gestationDays + sep9.daysRemaining, sep9.minimumDays);
  assert.equal(sep9.gestationDays + sep9.expectedCalvingDaysRemaining, sep9.averageGestationDays);

  // E. Dec 19 (Day 252, min remaining = 1, isEligible = false)
  const dec19 = getCalvingReadiness({
    ...context,
    at: new Date("2026-12-19T00:00:00.000Z"),
  });
  assert.equal(dec19.gestationDays, 252);
  assert.equal(dec19.daysRemaining, 1);
  assert.equal(dec19.isEligible, false);
  assert.equal(dec19.code, "CALVING_TOO_EARLY");

  // F. Dec 20 (Day 253, min remaining = 0, isEligible = true)
  const dec20 = getCalvingReadiness({
    ...context,
    at: new Date("2026-12-20T00:00:00.000Z"),
  });
  assert.equal(dec20.gestationDays, 253);
  assert.equal(dec20.daysRemaining, 0);
  assert.equal(dec20.isEligible, true);
  assert.equal(dec20.code, "CALVING_WINDOW_OPEN");

  // G. Jan 19, 2027 (Day 283, expected remaining = 0)
  const jan19 = getCalvingReadiness({
    ...context,
    at: new Date("2027-01-19T00:00:00.000Z"),
  });
  assert.equal(jan19.gestationDays, 283);
  assert.equal(jan19.expectedCalvingDaysRemaining, 0);
  assert.equal(jan19.isEligible, true);

  // Earliest eligible date remains Dec 20, 2026
  assert.equal(toManilaDateKey(sep8.earliestEligibleDate), "2026-12-20");
  assert.equal(toManilaDateKey(sep9.earliestEligibleDate), "2026-12-20");

  // Expected calving date remains Jan 19, 2027
  assert.equal(toManilaDateKey(sep8.expectedCalvingDate), "2027-01-19");
  assert.equal(toManilaDateKey(sep9.expectedCalvingDate), "2027-01-19");
});

test("Reproductive gestation: Time-of-day insensitivity in Asia/Manila", () => {
  const aiTimeVariations = [
    new Date("2026-04-10T16:01:00.000Z"), // 00:01 Manila Apr 11
    new Date("2026-04-10T23:30:00.000Z"), // 07:30 Manila Apr 11
    new Date("2026-04-11T06:00:00.000Z"), // 14:00 Manila Apr 11
    new Date("2026-04-11T15:59:00.000Z"), // 23:59 Manila Apr 11
  ];

  const checkTimeVariationsSep9 = [
    new Date("2026-09-08T16:01:00.000Z"), // 00:01 Manila Sep 9
    new Date("2026-09-09T00:00:00.000Z"), // 08:00 Manila Sep 9
    new Date("2026-09-09T06:00:00.000Z"), // 14:00 Manila Sep 9
    new Date("2026-09-09T15:59:00.000Z"), // 23:59 Manila Sep 9
  ];

  for (const aiTime of aiTimeVariations) {
    for (const checkTime of checkTimeVariationsSep9) {
      const result = getCalvingReadiness({
        ...context,
        insemination: { inseminationDate: aiTime },
        at: checkTime,
      });
      assert.equal(
        result.gestationDays,
        151,
        `AI ${aiTime.toISOString()} vs Check ${checkTime.toISOString()} should be Day 151`,
      );
      assert.equal(result.daysRemaining, 102);
      assert.equal(result.expectedCalvingDaysRemaining, 132);
      assert.equal(result.isEligible, false);
    }
  }
});

test("Reproductive gestation: Manila midnight boundary transition", () => {
  const aiDate = new Date("2026-04-11T04:00:00.000Z"); // 12:00 Manila

  // Exactly 23:59:59.999 Manila on Sep 8 (15:59:59.999 UTC)
  const justBeforeMidnight = new Date("2026-09-08T15:59:59.999Z");
  const resultBefore = getCalvingReadiness({
    ...context,
    insemination: { inseminationDate: aiDate },
    at: justBeforeMidnight,
  });
  assert.equal(resultBefore.gestationDays, 150);
  assert.equal(resultBefore.daysRemaining, 103);
  assert.equal(resultBefore.expectedCalvingDaysRemaining, 133);

  // Exactly 00:00:00.000 Manila on Sep 9 (16:00:00.000 UTC)
  const atMidnight = new Date("2026-09-08T16:00:00.000Z");
  const resultAfter = getCalvingReadiness({
    ...context,
    insemination: { inseminationDate: aiDate },
    at: atMidnight,
  });
  assert.equal(resultAfter.gestationDays, 151);
  assert.equal(resultAfter.daysRemaining, 102);
  assert.equal(resultAfter.expectedCalvingDaysRemaining, 132);
});
