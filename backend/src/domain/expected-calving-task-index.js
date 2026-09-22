export const AUTOMATIC_EXPECTED_CALVING_INDEX = Object.freeze({
  name: "uniq_automatic_expected_calving_per_pregnancy",
  key: Object.freeze({
    taskType: 1,
    sourceType: 1,
    "metadata.pregnancyId": 1,
  }),
  unique: true,
  partialFilterExpression: Object.freeze({
    taskType: "CD",
    sourceType: "automatic_expected_calving",
    "metadata.pregnancyId": Object.freeze({ $exists: true }),
  }),
});

export const automaticExpectedCalvingIndexOptions = () => ({
  name: AUTOMATIC_EXPECTED_CALVING_INDEX.name,
  unique: AUTOMATIC_EXPECTED_CALVING_INDEX.unique,
  partialFilterExpression: AUTOMATIC_EXPECTED_CALVING_INDEX.partialFilterExpression,
});
