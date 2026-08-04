export const CALVING_OUTCOMES = Object.freeze({
  LIVE_BIRTH: "live_birth",
  MIXED: "mixed",
  STILLBIRTH: "stillbirth",
  ABORTION: "abortion",
});

const LIVE_BIRTH_EASES = new Set(["Natural", "Normal", "Difficult", "Cesarean"]);

export const inferCalvingOutcome = ({ outcome, calvingEase } = {}) => {
  if (Object.values(CALVING_OUTCOMES).includes(outcome)) return outcome;
  if (calvingEase === "Abortion") return CALVING_OUTCOMES.ABORTION;
  if (calvingEase === "Stillbirth") return CALVING_OUTCOMES.STILLBIRTH;
  if (LIVE_BIRTH_EASES.has(calvingEase) || !calvingEase) return CALVING_OUTCOMES.LIVE_BIRTH;
  return null;
};

export const isDeliveryOutcome = (outcome) => outcome !== CALVING_OUTCOMES.ABORTION;
