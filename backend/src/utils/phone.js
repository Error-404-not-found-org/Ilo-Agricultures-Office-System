export const normalizePhilippineMobileNumber = (value) => {
  const raw = String(value || "").trim();
  const digits = raw.replace(/\D/g, "");

  if (/^09\d{9}$/.test(raw)) {
    return {
      local: raw,
      international: `63${raw.slice(1)}`,
      normalized: `+63${raw.slice(1)}`,
    };
  }

  if (/^9\d{9}$/.test(digits)) {
    return {
      local: `0${digits}`,
      international: `63${digits}`,
      normalized: `+63${digits}`,
    };
  }

  if (/^639\d{9}$/.test(digits)) {
    return {
      local: `0${digits.slice(2)}`,
      international: digits,
      normalized: `+${digits}`,
    };
  }

  throw Object.assign(
    new Error("Phone number must be a valid Philippine mobile number."),
    { statusCode: 400 },
  );
};

export const maskPhoneNumber = (value) => {
  try {
    const { local } = normalizePhilippineMobileNumber(value);
    return `${local.slice(0, 4)}***${local.slice(-4)}`;
  } catch {
    return "";
  }
};
