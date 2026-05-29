import { 
  calculateAgeInMonths, 
  checkInseminationAgeEligibility, 
  calculateTargetCalvingDate, 
  verifyPostpartumWindow, 
  generatePregnancyTimeline 
} from "./src/utils/cattleCore.js";

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ Pass: ${message}`);
}

try {
  console.log("=== RUNNING CATTLECORE UNIT TESTS ===");

  // 1. Age Calculation
  assert(calculateAgeInMonths(new Date(Date.now() + 1000 * 60 * 60 * 24 * 35)) === 0, "Future date age calculation safe");
  const tenMonthsAgo = new Date();
  tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
  assert(calculateAgeInMonths(tenMonthsAgo) === 10, "Ten months ago calculation correct");

  // 2. Insemination Age Eligibility
  const newbornDate = new Date();
  const newbornCheck = checkInseminationAgeEligibility(newbornDate, "Beef Cattle");
  assert(newbornCheck.isEligible === false, "Newborn beef cattle blocked");
  assert(newbornCheck.reason.includes("Beef Cattle is 12 months"), "Reason mentions min age");

  const eligibleDate = new Date();
  eligibleDate.setMonth(eligibleDate.getMonth() - 15);
  const eligibleCheck = checkInseminationAgeEligibility(eligibleDate, "Beef Cattle");
  assert(eligibleCheck.isEligible === true, "15-month beef cattle is eligible");

  // 3. Dynamic Gestation target calving calculation
  const inseminDate = new Date("2026-01-01");
  const beefCalvingDate = calculateTargetCalvingDate(inseminDate, "Beef Cattle");
  // 283 days from Jan 1 2026 is Oct 11 2026 (non-leap year)
  assert(beefCalvingDate.toISOString().startsWith("2026-10-11"), "Beef Cattle calving date is correct (283 days)");

  const beefCalvingMale = calculateTargetCalvingDate(inseminDate, "Beef Cattle", "M");
  // 283 + 1.5 = 284.5 days (rounds to 285) => Oct 13 2026
  assert(beefCalvingMale.toISOString().startsWith("2026-10-13"), "Male calf offset (+1.5 gestation days rounded) is correct");

  const goatCalvingDate = calculateTargetCalvingDate(inseminDate, "Goat");
  // 150 days from Jan 1 2026 is May 31 2026
  assert(goatCalvingDate.toISOString().startsWith("2026-05-31"), "Goat calving date is correct (150 days)");

  // 4. Postpartum voluntary recovery window
  const lastCalving = new Date("2026-01-01");
  const tooEarlyAction = new Date("2026-01-15");
  const earlyCheck = verifyPostpartumWindow(lastCalving, tooEarlyAction, "Beef Cattle");
  assert(earlyCheck.isSafe === false, "Action within voluntary waiting window is unsafe");
  assert(earlyCheck.daysPassed === 14, "Correct days passed calculated");

  const safeAction = new Date("2026-03-01");
  const safeCheck = verifyPostpartumWindow(lastCalving, safeAction, "Beef Cattle");
  assert(safeCheck.isSafe === true, "Action after voluntary waiting window is safe");

  // 5. Timeline generation
  const timeline = generatePregnancyTimeline(inseminDate, "Dairy Cattle");
  assert(timeline.heatReturnCheckDate.toISOString().startsWith("2026-01-22"), "Estrus cycle watch is on Day 21");
  assert(timeline.ultrasoundCheckDate.toISOString().startsWith("2026-02-05"), "Ultrasound scan check is on Day 35");
  assert(timeline.palpationCheckDate.toISOString().startsWith("2026-03-02"), "Palpation check is on Day 60");
  assert(timeline.dryOffDate !== undefined, "Dairy cattle has dry off date generated");
  assert(timeline.dryOffDate.toISOString().startsWith("2026-08-08"), "Dairy dry off date is 60 days before calving");

  console.log("=== ALL CATTLECORE TESTS PASSED SUCCESSFULLY ===");
} catch (error) {
  console.error("❌ TEST FAILED:", error);
  process.exit(1);
}
