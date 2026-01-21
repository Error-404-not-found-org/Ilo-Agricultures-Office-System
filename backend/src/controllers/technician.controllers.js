export const getTechnicianInseminations = async (req, res) => {
  res.status(200).send({ inseminations: [] });
};

export const getTechnicianProfile = async (req, res) => {
  res.status(200).send({ profile: {} });
};

export const getTechnicianReInseminations = async (req, res) => {
  res.status(200).send({ reInseminations: [] });
};

export const getTechnicianPregnancyChecks = async (req, res) => {
  res.status(200).send({ pregnancyChecks: [] });
};

export const getTechnicianCalvings = async (req, res) => {
  res.status(200).send({ calvings: [] });
};

export const getTechnicianFarmers = async (req, res) => {
  res.status(200).send({ farmers: [] });
};

export const getTechnicianNotifications = async (req, res) => {
  res.status(200).send({ notifications: [] });
};

// Post functions for technician

export const createFarmerByTechnician = async (req, res) => {
  try {
    const { email, name, phoneNumber, address } = req.body;

    const { clerkId } = req.params;
  } catch (error) {}
};

// Delete functions for technician

export const deleteFarmerProfile = async (req, res) => {
  res.status(200).send({ message: "Farmer profile deleted successfully" });
};

export const deleteTechnicianInsemination = async (req, res) => {
  res.status(200).send({ message: "Insemination record deleted successfully" });
};

export const deleteTechnicianReInsemination = async (req, res) => {
  res
    .status(200)
    .send({ message: "Re-insemination record deleted successfully" });
};

export const deleteTechnicianPregnancyCheck = async (req, res) => {
  res
    .status(200)
    .send({ message: "Pregnancy check record deleted successfully" });
};

export const deleteTechnicianCalving = async (req, res) => {
  res.status(200).send({ message: "Calving record deleted successfully" });
};
